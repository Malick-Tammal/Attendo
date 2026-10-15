import { shell, BrowserWindow, session } from "electron"
import { join } from "path"
import { is } from "@electron-toolkit/utils"
import icon from "../../resources/icon.png?asset"

export function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1050,
    height: 650,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === "linux" ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  })

  // Automatically grant camera permissions
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    callback(permission === "media")
  })

  mainWindow.on("ready-to-show", () => {
    mainWindow.show()
  })

  // Open external links in the OS browser, not inside Electron
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: "deny" }
  })

  if (is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"])
  } else {
    mainWindow.loadFile(join(__dirname, "../renderer/index.html"))
  }
}
