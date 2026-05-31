const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getConfig: () => ipcRenderer.invoke('get-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  loadToday: () => ipcRenderer.invoke('load-today'),
  appendMessage: (text, images) => ipcRenderer.invoke('append-message', text, images),
  deleteImage: (msgIndex, imgIndex) => ipcRenderer.invoke('delete-image', { msgIndex, imgIndex }),
  deleteEmptyMessage: (msgIndex) => ipcRenderer.invoke('delete-empty-message', { msgIndex }),
  updateMessage: (index, date, text) => ipcRenderer.invoke('update-message', { index, date, text }),
  saveFile: (content) => ipcRenderer.invoke('save-file', content),
  readFile: () => ipcRenderer.invoke('read-file'),
  openDirectory: (dirPath) => ipcRenderer.invoke('open-directory', dirPath),
  showConfirmDialog: (title, message) => ipcRenderer.invoke('show-confirm-dialog', { title, message }),
  getAppName: () => ipcRenderer.invoke('get-app-name'),
});
