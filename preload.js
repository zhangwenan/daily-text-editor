const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  loadToday: () => ipcRenderer.invoke('load-today'),
  appendMessage: (text) => ipcRenderer.invoke('append-message', text),
  updateMessage: (index, date, text) => ipcRenderer.invoke('update-message', { index, date, text }),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  readFile: () => ipcRenderer.invoke('read-file'),
});
