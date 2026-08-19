const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('printAPI', {
  isElectron: true,
  listPrinters: () => ipcRenderer.invoke('printers:list'),
  printSilent: (deviceName) => ipcRenderer.invoke('printers:print-silent', deviceName),
})
