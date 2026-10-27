import { app, BrowserWindow, ipcMain, shell } from "electron"
import { spawn } from "node:child_process"
import { createServer } from "node:net"
import path from "node:path"

let serverProcess
let serverUrl

const libraryPaths = new Set(["music", "videos", "pictures", "documents", "downloads"])

ipcMain.on("app:getLibraryPath", (event, name) => {
  event.returnValue = libraryPaths.has(name) ? app.getPath(name) : null
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

async function createWindow() {
  const url = await appUrl()
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
  await window.loadURL(url)
}

app.whenReady().then(createWindow).catch((error) => {
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
