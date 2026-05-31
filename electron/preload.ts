import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
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
})
