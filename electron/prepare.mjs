import { cp, mkdir, stat } from "node:fs/promises"
import path from "node:path"

const standalone = path.resolve(".next/standalone")
await stat(path.join(standalone, "server.js"))
await mkdir(path.join(standalone, ".next"), { recursive: true })
await cp(path.resolve(".next/static"), path.join(standalone, ".next/static"), {
  recursive: true,
  force: true,
})

try {
  await stat("public")
  await cp(path.resolve("public"), path.join(standalone, "public"), {
    recursive: true,
    force: true,
  })
} catch (error) {
  if (error.code !== "ENOENT") throw error
}
