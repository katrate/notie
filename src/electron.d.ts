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

interface ElectronAPI {
  // File operations
  openFileDialog(options: { multiple?: boolean; title?: string; filters?: { name: string; extensions: string[] }[] }): Promise<string[]>
  attachFile(sourcePath: string): Promise<{ name: string; size: number }>
  fileExists(filePath: string): Promise<boolean>
  openPath(filePath: string): Promise<void>
  resolveAttachmentPath(storedName: string): Promise<string>
  convertToPdf(sourcePath: string): Promise<{ name: string; size?: number; originalName?: string; error?: string }>
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
