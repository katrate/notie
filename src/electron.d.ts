interface ElectronAPI {
  openFileDialog(options: { multiple?: boolean; title?: string }): Promise<string[]>
  attachFile(sourcePath: string): Promise<{ name: string; size: number }>
  fileExists(filePath: string): Promise<boolean>
  openPath(filePath: string): Promise<void>
  resolveAttachmentPath(storedName: string): Promise<string>
}

interface Window {
  electronAPI?: ElectronAPI
}
