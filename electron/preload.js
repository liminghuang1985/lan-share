const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的方法给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  getServerUrl: () => ipcRenderer.invoke('get-server-url'),
  restartServer: () => ipcRenderer.invoke('restart-server'),
  openClient: () => ipcRenderer.invoke('open-client'),
  openAdmin: () => ipcRenderer.invoke('open-admin'),
  platform: process.platform
});
