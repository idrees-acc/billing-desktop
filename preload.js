'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// The preload stays sandboxed: no node APIs here. Reading and writing the data
// file happens in the main process, over synchronous IPC so that the app's
// save-after-every-change behaviour is preserved exactly as in the browser.
contextBridge.exposeInMainWorld('desktop', {
  read: () => ipcRenderer.sendSync('data-read'),
  write: text => ipcRenderer.sendSync('data-write', text),
  backupNow: () => ipcRenderer.invoke('backup-now'),
  restore: () => ipcRenderer.invoke('restore-pick'),
  openDataFolder: () => ipcRenderer.invoke('open-data-folder'),
  openInvoiceFolder: () => ipcRenderer.invoke('open-invoice-folder'),
  paths: () => ipcRenderer.invoke('paths'),
  backupList: () => ipcRenderer.invoke('backup-list'),
  saveFile: (name, text) => ipcRenderer.invoke('save-file', { name, text }),
  savePDF: meta => ipcRenderer.invoke('save-pdf', meta),
  onMenu: cb => ipcRenderer.on('menu', (e, what) => cb(what))
});
