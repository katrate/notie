import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, copyFileSync, mkdirSync, statSync } from 'fs'
import { autoUpdater } from 'electron-updater'

const __dirname = dirname(fileURLToPath(import.meta.url))

let mainWindow: BrowserWindow | null = null

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    maximized: true,
    icon: join(__dirname, process.env.VITE_DEV_SERVER_URL ? '../public/logo.png' : '../dist/logo.png'),
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }
}

/* ── Auto Updater ── */

const isDev = !!process.env.VITE_DEV_SERVER_URL

if (!isDev) {
  autoUpdater.autoDownload = false

  autoUpdater.on('checking-for-update', () => {
    mainWindow?.webContents.send('update:checking')
  })

  autoUpdater.on('update-available', (info) => {
    mainWindow?.webContents.send('update:available', info)
  })

  autoUpdater.on('update-not-available', (info) => {
    mainWindow?.webContents.send('update:not-available', info)
  })

  autoUpdater.on('download-progress', (progress) => {
    mainWindow?.webContents.send('update:download-progress', progress)
  })

  autoUpdater.on('update-downloaded', (info) => {
    mainWindow?.webContents.send('update:downloaded', info)
  })

  autoUpdater.on('error', (err) => {
    mainWindow?.webContents.send('update:error', err?.message || 'Unknown error')
  })
}

app.whenReady().then(() => {
  createWindow()

  // Check for updates shortly after startup (only in production)
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        // Silently ignore network errors during startup check
      })
    }, 5000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

/* ── IPC Handlers ── */

ipcMain.handle('update:check', async () => {
  if (isDev) return { error: 'Cannot check for updates in development mode' }
  try {
    const result = await autoUpdater.checkForUpdates()
    return { result }
  } catch (err: any) {
    return { error: err?.message || 'Failed to check for updates' }
  }
})

ipcMain.handle('update:download', async () => {
  if (isDev) return { error: 'Cannot download updates in development mode' }
  try {
    autoUpdater.downloadUpdate()
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to start download' }
  }
})

ipcMain.handle('update:install', async () => {
  autoUpdater.quitAndInstall()
  return { success: true }
})

ipcMain.handle('update:getVersion', async () => {
  return app.getVersion()
})

/* ── Other IPC Handlers ── */

ipcMain.handle('dialog:openFile', async (_event, options: { multiple?: boolean; title?: string }) => {
  const result = await dialog.showOpenDialog({
    multiple: options.multiple ?? false,
    title: options.title ?? 'Select a file',
  })
  return result.filePaths
})

ipcMain.handle('file:attach', async (_event, sourcePath: string) => {
  const attachmentsDir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true })
  }
  const origName = sourcePath.split(/[\\/]/).pop() || 'file'
  const destName = `${Date.now()}_${origName}`
  copyFileSync(sourcePath, join(attachmentsDir, destName))
  const stats = statSync(join(attachmentsDir, destName))
  return { name: destName, size: stats.size }
})

ipcMain.handle('file:exists', async (_event, filePath: string) => {
  return existsSync(filePath)
})

ipcMain.handle('file:openPath', async (_event, filePath: string) => {
  await shell.openPath(filePath)
})

ipcMain.handle('file:resolveAttachmentPath', async (_event, storedName: string) => {
  const attachmentsDir = join(app.getPath('userData'), 'attachments')
  return join(attachmentsDir, storedName)
})
