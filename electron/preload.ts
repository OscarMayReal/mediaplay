import fs from "node:fs"
import fsPromises from "node:fs/promises"
import drivelist from "node-drivelist"
import { ipcRenderer } from "electron"

type LibraryPath = "music" | "videos" | "pictures" | "documents" | "downloads"
type WindowStateEvent = "enter-full-screen" | "leave-full-screen" | "maximize" | "unmaximize" | "minimize" | "restore"

const app = {
  getPath: (name: LibraryPath): string => ipcRenderer.sendSync("app:getLibraryPath", name),
}

window.electronAPI = {
  platform: process.platform,
  onWindowStateChange: (callback: (event: WindowStateEvent) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, state: WindowStateEvent) => callback(state)
    ipcRenderer.on("window:state-changed", listener)
    return () => ipcRenderer.removeListener("window:state-changed", listener)
  },
}

window.app = app

window.fs = fs

window.fsPromises = fsPromises

window.drivelist = drivelist

declare global {
  interface Window {
    electronAPI: {
      platform: NodeJS.Platform
      onWindowStateChange: (callback: (event: WindowStateEvent) => void) => () => void
    },
    drivelist: typeof drivelist,
    fs: typeof fs,
    app: typeof app,
    fsPromises: typeof fsPromises
  }
}
