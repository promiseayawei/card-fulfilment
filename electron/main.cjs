const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')

const DEV_SERVER_URL = process.env.ELECTRON_RENDERER_URL

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 880,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  if (DEV_SERVER_URL) {
    win.loadURL(DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// Printer list + silent print (no OS print dialog/preview) for the "Files"
// print flow. Falls back to window.print() in the renderer when this API
// isn't present, i.e. when running as a plain web app instead of Electron.
ipcMain.handle('printers:list', async (event) => {
  return event.sender.getPrintersAsync()
})

ipcMain.handle('printers:print-silent', (event, deviceName) => {
  return new Promise((resolve) => {
    event.sender.print(
      {
        silent: true,
        printBackground: true,
        deviceName: deviceName || undefined,
      },
      (success, failureReason) => {
        resolve({ success, failureReason })
      },
    )
  })
})
