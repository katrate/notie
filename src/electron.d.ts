interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
  path?: string
  files?: Array<{ url: string; sha512?: string }>
}

interface DownloadProgress {
  bytesPerSecond: number
  percent: number
  total: number
  transferred: number
}

interface PublicUser {
  id: string
  email?: string
  app_metadata?: Record<string, any>
  user_metadata?: Record<string, any>
}

interface PublicSession {
  expires_at?: number
  user: PublicUser | null
}

interface ApiResult<T = any> {
  data?: T
  session?: PublicSession | null
  user?: PublicUser | null
  success?: boolean
  error?: string
}

interface ElectronAPI {
  // Auth and remote data
  getSession(): Promise<PublicSession | null>
  getCurrentUser(): Promise<PublicUser | null>
  signIn(email: string, password: string): Promise<ApiResult>
  signUp(email: string, password: string): Promise<ApiResult>
  signOut(): Promise<ApiResult>
  onAuthStateChanged(callback: (session: PublicSession | null) => void): () => void
  fetchProjects(): Promise<ApiResult>
  fetchPages(projectId: string): Promise<ApiResult>
  fetchStandalonePages(): Promise<ApiResult>
  getProfileSettings(): Promise<ApiResult<Record<string, any>>>
  mergeProfileSettings(settings: Record<string, any>): Promise<ApiResult<Record<string, any>>>
  checkNeedsOnboarding(): Promise<ApiResult<boolean>>
  createProject(payload: { name: string; layout_type: string }): Promise<ApiResult>
  createPage(payload: { projectId: string | null; title: string; type: string; metadata?: any; icon?: string | null }): Promise<ApiResult>
  updatePage(payload: { pageId: string; updates: Record<string, any> }): Promise<ApiResult>
  updateProject(payload: { projectId: string; updates: Record<string, any> }): Promise<ApiResult>
  deleteProject(projectId: string): Promise<ApiResult>
  deletePages(pageIds: string[]): Promise<ApiResult>
  fetchTemplates(): Promise<ApiResult>
  createTemplate(payload: Record<string, any>): Promise<ApiResult>
  updateTemplate(payload: { templateId: string; updates: Record<string, any> }): Promise<ApiResult>
  deleteTemplate(templateId: string): Promise<ApiResult>
  fetchGraphData(projectId: string): Promise<ApiResult>
  addGraphNode(node: Record<string, any>): Promise<ApiResult>

  // File operations
  openFileDialog(options: { multiple?: boolean; title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string[]>
  attachFile(sourcePath: string): Promise<{ name: string; size: number }>
  fileExists(filePath: string): Promise<boolean>
  openPath(filePath: string): Promise<void>
  resolveAttachmentPath(storedName: string): Promise<string>
  convertToPdf(sourcePath: string): Promise<{ name: string; size?: number; originalName?: string; error?: string; ocrWords?: { text: string; x: number; y: number; w: number; h: number }[]; sourceFormat?: string }>
  deleteAttachment(storedName: string): Promise<{ success: boolean }>

  // Auto-update
  checkForUpdates(): Promise<{ result?: any; error?: string }>
  downloadUpdate(): Promise<{ success?: boolean; error?: string }>
  installUpdate(): Promise<{ success?: boolean }>
  getAppVersion(): Promise<string>
  onUpdateChecking(callback: () => void): () => void
  onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void
  onUpdateNotAvailable(callback: (info: any) => void): () => void
  onUpdateDownloadProgress(callback: (progress: DownloadProgress) => void): () => void
  onUpdateDownloaded(callback: (info: UpdateInfo) => void): () => void
  onUpdateError(callback: (error: string) => void): () => void
}

interface Window {
  electronAPI?: ElectronAPI
}
