const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sessionManager', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  listSessions: () => ipcRenderer.invoke('sessions:list'),
  getSessionDetail: (sessionId) => ipcRenderer.invoke('sessions:detail', sessionId),
  resumeSession: (sessionId) => ipcRenderer.invoke('sessions:resume', sessionId),
  chooseSessionsFolder: () => ipcRenderer.invoke('sessions:choose-folder'),
  copyText: (text) => ipcRenderer.invoke('clipboard:write', text)
});
