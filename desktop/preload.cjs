const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  info: () => ipcRenderer.invoke('app:info'),
  window: {
    minimize: () => ipcRenderer.invoke('win:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('win:toggleMaximize'),
    close: () => ipcRenderer.invoke('win:close'),
    isMaximized: () => ipcRenderer.invoke('win:isMaximized'),
    setTitle: (title) => ipcRenderer.invoke('win:setTitle', title),
    onMaximizeChange: (callback) => {
      const listener = (_e, value) => callback(value);
      ipcRenderer.on('window:maximize', listener);
      return () => ipcRenderer.removeListener('window:maximize', listener);
    },
  },
  openFiles: () => ipcRenderer.invoke('file:open'),
  saveFile: (name, base64) => ipcRenderer.invoke('file:save', { name, base64 }),
  chooseFolder: () => ipcRenderer.invoke('folder:choose'),
  folder: {
    get: () => ipcRenderer.invoke('folder:get'),
    set: (value) => ipcRenderer.invoke('folder:set', value),
  },
  fs: {
    read: (filePath) => ipcRenderer.invoke('fs:read', filePath),
    write: (filePath, text) => ipcRenderer.invoke('fs:write', { filePath, text }),
    delete: (filePath) => ipcRenderer.invoke('fs:delete', filePath),
    readMarkdown: (dir) => ipcRenderer.invoke('fs:readMarkdown', dir),
    readBase64: (filePath) => ipcRenderer.invoke('fs:readBase64', filePath),
  },
  workspace: {
    read: () => ipcRenderer.invoke('workspace:read'),
    write: (text) => ipcRenderer.invoke('workspace:write', text),
  },
  recent: {
    add: (filePath) => ipcRenderer.invoke('app:addRecent', filePath),
  },
  openFile: (callback) => {
    const listener = (_e, item) => callback(item);
    ipcRenderer.on('app:open-file', listener);
    return () => ipcRenderer.removeListener('app:open-file', listener);
  },
  shell: {
    showItem: (filePath) => ipcRenderer.invoke('shell:showItem', filePath),
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  },
});
