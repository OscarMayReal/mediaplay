import { spawn } from "node:child_process"
import { createServer } from "node:net"
import { createRequire } from "node:module"
import path from "node:path"

const require = createRequire(import.meta.url)
const electron = require("electron")
const production = process.argv.includes("--production")

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

let next
const env = { ...process.env }
if (!production) {
  const port = await availablePort()
  env.ELECTRON_START_URL = `http://127.0.0.1:${port}`
  next = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", String(port)],
    { stdio: "inherit", env },
  )

  for (let attempt = 0; attempt < 100; attempt++) {
    if (next.exitCode !== null) throw new Error("Next.js exited before it was ready")
    try {
      const response = await fetch(env.ELECTRON_START_URL)
      if (response.ok) break
    } catch {}
    if (attempt === 99) throw new Error("Timed out waiting for Next.js")
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

const desktop = spawn(electron, [path.resolve(".")], { stdio: "inherit", env })
desktop.on("exit", (code) => {
  next?.kill()
  process.exitCode = code ?? 1
})
process.on("SIGINT", () => desktop.kill())
process.on("SIGTERM", () => desktop.kill())
