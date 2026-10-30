import { app, BrowserWindow, ipcMain, net, protocol, shell } from "electron"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

protocol.registerSchemesAsPrivileged([
  { scheme: "localfile", privileges: { standard: true, secure: true, stream: true, supportFetchAPI: true, corsEnabled: true } },
])

let serverProcess
let serverUrl
let appOrigin

const libraryPaths = new Set(["music", "videos", "pictures", "documents", "downloads"])

ipcMain.on("app:getLibraryPath", (event, name) => {
  event.returnValue = libraryPaths.has(name) ? app.getPath(name) : null
})

ipcMain.handle("app:openWindow", async (_event, route) => {
  if (typeof route !== "string" || !route.startsWith("/") || route.startsWith("//")) return
  const url = await appUrl()
  const target = new URL(route, url)
  if (target.origin !== new URL(url).origin) return
  await createWindow(route)
})

function availablePort() {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.once("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })
}

async function waitForServer(url) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (serverProcess?.exitCode !== null) {
      throw new Error("The Next.js server exited before it was ready")
    }
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error("Timed out waiting for the Next.js server")
}

async function appUrl() {
  if (process.env.ELECTRON_START_URL) return process.env.ELECTRON_START_URL
  if (serverUrl) return serverUrl

  const port = await availablePort()
  const serverDirectory = app.isPackaged
    ? path.join(process.resourcesPath, "server")
    : path.join(app.getAppPath(), ".next/standalone")

  serverProcess = spawn(process.execPath, [path.join(serverDirectory, "server.js")], {
    cwd: serverDirectory,
    env: {
      ...process.env,
      ELECTRON_RUN_AS_NODE: "1",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
    },
    stdio: "inherit",
  })

  const url = `http://127.0.0.1:${port}`
  await waitForServer(url)
  serverUrl = url
  return url
}

async function createWindow(route = "/") {
  const url = await appUrl()
  appOrigin = new URL(url).origin
  const window = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 640,
    minHeight: 480,
    show: false,
    trafficLightPosition: { x: 17, y: 17 },
    titleBarOverlay: true,
    titleBarStyle: "hidden",
    webPreferences: {
      preload: path.join(app.getAppPath(), "electron/preload.cjs"),
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false,
    },
  })

  window.webContents.setWindowOpenHandler(({ url: target }) => {
    if (target.startsWith("https://")) shell.openExternal(target)
    return { action: "deny" }
  })
  window.webContents.on("will-navigate", (event, target) => {
    if (new URL(target).origin !== new URL(url).origin) event.preventDefault()
  })
  window.once("ready-to-show", () => window.show())
  for (const event of [
    "enter-full-screen",
    "leave-full-screen",
    "maximize",
    "unmaximize",
    "minimize",
    "restore",
  ]) {
    window.on(event, () => window.webContents.send("window:state-changed", event))
  }
  await window.loadURL(new URL(route, url).toString())
}

app.whenReady().then(() => {
  protocol.handle("localfile", async (request) => {
    try {
      const mediaUrl = new URL(request.url)
      if (mediaUrl.host !== "media" || !appOrigin || (request.initiatorOrigin && request.initiatorOrigin !== appOrigin)) {
        return new Response("Forbidden", { status: 403 })
      }
      const filePath = fileURLToPath(`file://${mediaUrl.pathname}`)
      const range = request.headers.get("range")
      if (range) {
        const fileStat = await stat(filePath)
        const match = /^bytes=(\d*)-(\d*)$/.exec(range)
        if (!match || fileStat.size === 0) {
          return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileStat.size}` } })
        }

        let start = match[1] ? Number(match[1]) : Math.max(0, fileStat.size - Number(match[2]))
        let end = match[2] && match[1] ? Number(match[2]) : fileStat.size - 1
        if (start >= fileStat.size || end < start) {
          return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${fileStat.size}` } })
        }
        end = Math.min(end, fileStat.size - 1)

        const fileResponse = await net.fetch(pathToFileURL(filePath).href)
        await fileResponse.body?.cancel()
        const headers = new Headers(fileResponse.headers)
        headers.set("Accept-Ranges", "bytes")
        headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`)
        headers.set("Content-Length", String(end - start + 1))
        headers.set("Access-Control-Allow-Origin", appOrigin)
        headers.set("Vary", "Origin")
        const body = Readable.toWeb(createReadStream(filePath, { start, end }))
        return new Response(body, { status: 206, headers })
      }

      const response = await net.fetch(pathToFileURL(filePath).href)
      const headers = new Headers(response.headers)
      headers.set("Accept-Ranges", "bytes")
      headers.set("Access-Control-Allow-Origin", appOrigin)
      headers.set("Vary", "Origin")
      return new Response(response.body, { status: response.status, headers })
    } catch {
      return new Response("Invalid local file URL", { status: 400 })
    }
  })
  return createWindow()
}).catch((error) => {
  console.error(error)
  app.quit()
})

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow().catch(console.error)
})

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit()
})

app.on("before-quit", () => {
  serverProcess?.kill()
})
