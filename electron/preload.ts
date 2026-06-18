const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth and remote data run in the Electron main process.
  getSession: () =>
    ipcRenderer.invoke('auth:getSession'),
  getCurrentUser: () =>
    ipcRenderer.invoke('auth:getUser'),
  signIn: (email: string, password: string) =>
    ipcRenderer.invoke('auth:signIn', { email, password }),
  signUp: (email: string, password: string) =>
    ipcRenderer.invoke('auth:signUp', { email, password }),
  signOut: () =>
    ipcRenderer.invoke('auth:signOut'),
  onAuthStateChanged: (callback: (session: any) => void) => {
    const handler = (_event: any, session: any) => callback(session)
    ipcRenderer.on('auth:state-changed', handler)
    return () => ipcRenderer.removeListener('auth:state-changed', handler)
  },
  fetchProjects: () =>
    ipcRenderer.invoke('data:fetchProjects'),
  fetchPages: (projectId: string) =>
    ipcRenderer.invoke('data:fetchPages', projectId),
  fetchStandalonePages: () =>
    ipcRenderer.invoke('data:fetchStandalonePages'),
  getProfileSettings: () =>
    ipcRenderer.invoke('data:getProfileSettings'),
  mergeProfileSettings: (settings: Record<string, any>) =>
    ipcRenderer.invoke('data:mergeProfileSettings', settings),
  checkNeedsOnboarding: () =>
    ipcRenderer.invoke('data:checkNeedsOnboarding'),
  createProject: (payload: { name: string; layout_type: string }) =>
    ipcRenderer.invoke('data:createProject', payload),
  createPage: (payload: { projectId: string | null; title: string; type: string; metadata?: any; icon?: string | null }) =>
    ipcRenderer.invoke('data:createPage', payload),
  updatePage: (payload: { pageId: string; updates: Record<string, any> }) =>
    ipcRenderer.invoke('data:updatePage', payload),
  updateProject: (payload: { projectId: string; updates: Record<string, any> }) =>
    ipcRenderer.invoke('data:updateProject', payload),
  deleteProject: (projectId: string) =>
    ipcRenderer.invoke('data:deleteProject', projectId),
  deletePages: (pageIds: string[]) =>
    ipcRenderer.invoke('data:deletePages', pageIds),
  fetchTemplates: () =>
    ipcRenderer.invoke('data:fetchTemplates'),
  createTemplate: (payload: Record<string, any>) =>
    ipcRenderer.invoke('data:createTemplate', payload),
  updateTemplate: (payload: { templateId: string; updates: Record<string, any> }) =>
    ipcRenderer.invoke('data:updateTemplate', payload),
  deleteTemplate: (templateId: string) =>
    ipcRenderer.invoke('data:deleteTemplate', templateId),
  fetchGraphData: (projectId: string) =>
    ipcRenderer.invoke('data:fetchGraphData', projectId),
  addGraphNode: (node: Record<string, any>) =>
    ipcRenderer.invoke('data:addGraphNode', node),

  // File operations
  openFileDialog: (options: { multiple?: boolean; title?: string; filters?: { name: string; extensions: string[] }[] }) =>
    ipcRenderer.invoke('dialog:openFile', options),
  attachFile: (sourcePath: string) =>
    ipcRenderer.invoke('file:attach', sourcePath),
  fileExists: (filePath: string) =>
    ipcRenderer.invoke('file:exists', filePath),
  openPath: (filePath: string) =>
    ipcRenderer.invoke('file:openPath', filePath),
  resolveAttachmentPath: (storedName: string) =>
    ipcRenderer.invoke('file:resolveAttachmentPath', storedName),
  convertToPdf: (sourcePath: string) =>
    ipcRenderer.invoke('file:convertToPdf', sourcePath),
  deleteAttachment: (storedName: string) =>
    ipcRenderer.invoke('file:deleteAttachment', storedName),

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
