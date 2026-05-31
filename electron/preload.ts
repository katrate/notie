const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  openFileDialog: (options: { multiple?: boolean; title?: string }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  attachFile: (sourcePath: string) =>
    ipcRenderer.invoke('file:attach', sourcePath),
  fileExists: (filePath: string) =>
    ipcRenderer.invoke('file:exists', filePath),
  openPath: (filePath: string) =>
    ipcRenderer.invoke('file:openPath', filePath),
  resolveAttachmentPath: (storedName: string) =>
    ipcRenderer.invoke('file:resolveAttachmentPath', storedName),

  // Auto-update
  checkForUpdates: () =>
    ipcRenderer.invoke('update:check'),
  downloadUpdate: () =>
    ipcRenderer.invoke('update:download'),
  installUpdate: () =>
    ipcRenderer.invoke('update:install'),
  getAppVersion: () =>
    ipcRenderer.invoke('update:getVersion'),
  onUpdateChecking: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('update:checking', handler)
    return () => ipcRenderer.removeListener('update:checking', handler)
  },
  onUpdateAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info)
    ipcRenderer.on('update:available', handler)
    return () => ipcRenderer.removeListener('update:available', handler)
  },
  onUpdateNotAvailable: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info)
    ipcRenderer.on('update:not-available', handler)
    return () => ipcRenderer.removeListener('update:not-available', handler)
  },
  onUpdateDownloadProgress: (callback: (progress: any) => void) => {
    const handler = (_event: any, progress: any) => callback(progress)
    ipcRenderer.on('update:download-progress', handler)
    return () => ipcRenderer.removeListener('update:download-progress', handler)
  },
  onUpdateDownloaded: (callback: (info: any) => void) => {
    const handler = (_event: any, info: any) => callback(info)
    ipcRenderer.on('update:downloaded', handler)
    return () => ipcRenderer.removeListener('update:downloaded', handler)
  },
  onUpdateError: (callback: (error: string) => void) => {
    const handler = (_event: any, error: string) => callback(error)
    ipcRenderer.on('update:error', handler)
    return () => ipcRenderer.removeListener('update:error', handler)
  },
})
