const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  startTracking: () => ipcRenderer.invoke('start-tracking'),
  stopTracking: () => ipcRenderer.invoke('stop-tracking'),
  getResults: () => ipcRenderer.invoke('get-results'),
  clearResults: () => ipcRenderer.invoke('clear-results'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),

  onTrackingState: (cb) => ipcRenderer.on('tracking-state', (_, val) => cb(val)),
  onTrackingProgress: (cb) => ipcRenderer.on('tracking-progress', (_, val) => cb(val)),
  onNewResult: (cb) => ipcRenderer.on('new-result', (_, val) => cb(val)),
  onMLProcessing: (cb) => ipcRenderer.on('ml-processing', (_, val) => cb(val)),
});
