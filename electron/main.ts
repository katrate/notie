import { app, BrowserWindow, ipcMain, dialog, shell, protocol } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, copyFileSync, mkdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Register custom scheme as privileged before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'notie-attachment',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      // corsEnabled must be false (default) so fetch from localhost works without CORS headers
      corsEnabled: false,
    },
  },
])

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
  // Register custom protocol to serve attachment files as URLs
  protocol.handle('notie-attachment', async (request) => {
    const url = new URL(request.url)
    // The filename is in the hostname (not pathname) for URLs like:
    // notie-attachment://filename.pdf/
    let storedName = url.hostname
    if (!storedName) {
      // Fallback: try pathname (without leading slash)
      storedName = url.pathname.slice(1)
    }
    // Safe percent-decode
    if (storedName.includes('%')) {
      try { storedName = decodeURIComponent(storedName) } catch { /* keep as-is */ }
    }
    // Remove trailing slash if present
    storedName = storedName.replace(/\/+$/, '')
    // Prevent path traversal attacks
    if (storedName.includes('..') || storedName.includes(':') || storedName.includes('\\')) {
      return new Response('Forbidden', { status: 403 })
    }
    if (!storedName) {
      return new Response('Not Found', { status: 404 })
    }
    const attachmentsDir = join(app.getPath('userData'), 'attachments')
    const filePath = join(attachmentsDir, storedName)
    try {
      const data = await readFile(filePath)
      return new Response(data, {
        headers: { 'Content-Type': 'application/pdf' },
      })
    } catch {
      return new Response('Not Found', { status: 404 })
    }
  })

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

ipcMain.handle('dialog:openFile', async (_event, options: { multiple?: boolean; title?: string; filters?: { name: string; extensions: string[] }[] }) => {
  const result = await dialog.showOpenDialog({
    multiple: options.multiple ?? false,
    title: options.title ?? 'Select a file',
    filters: options.filters,
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

/**
 * Convert a source file to PDF and save to attachments directory.
 * Supports: images (PNG, JPEG, BMP, TIFF, GIF), text/code files, Office docs (via LibreOffice)
 */
ipcMain.handle('file:convertToPdf', async (_event, sourcePath: string) => {
  const attachmentsDir = join(app.getPath('userData'), 'attachments')
  if (!existsSync(attachmentsDir)) {
    mkdirSync(attachmentsDir, { recursive: true })
  }

  const ext = sourcePath.split('.').pop()?.toLowerCase() || ''
  const origName = sourcePath.split(/[\\/]/).pop() || 'document'
  const pdfName = `${Date.now()}_${origName.replace(/\.[^.]+$/, '')}.pdf`
  const pdfPath = join(attachmentsDir, pdfName)

  // ── Image formats that pdf-lib handles directly ──
  const imageDirectExts = ['png', 'jpg', 'jpeg']
  // ── Image formats that need Sharp conversion ──
  const imageConversionExts = ['bmp', 'gif', 'tiff', 'tif', 'webp', 'svg', 'ico']
  // ── Text/code formats (read as UTF-8, rendered with Courier) ──
  const textExts = ['txt', 'csv', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'bat', 'sh', 'ps1']
  // ── Rich formats (require LibreOffice) ──
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf']
  // ── Adobe/other formats ──
  const otherExts = ['psd', 'ai', 'eps', 'ps', 'prn', 'indd']

  try {
    // Case 1: Direct image → PDF via pdf-lib
    if (imageDirectExts.includes(ext)) {
      const { PDFDocument } = await import('pdf-lib')
      const imgBuffer = readFileSync(sourcePath)
      const doc = await PDFDocument.create()
      const page = doc.addPage()
      const { width, height } = page.getSize()

      let image
      if (ext === 'png') {
        image = await doc.embedPng(imgBuffer)
      } else {
        image = await doc.embedJpg(imgBuffer)
      }

      const imgDims = image.scaleToFit(width - 40, height - 40)
      page.drawImage(image, {
        x: (width - imgDims.width) / 2,
        y: (height - imgDims.height) / 2,
        width: imgDims.width,
        height: imgDims.height,
      })

      const pdfBytes = await doc.save()
      writeFileSync(pdfPath, Buffer.from(pdfBytes))
      const stats = statSync(pdfPath)
      return { name: pdfName, size: stats.size, originalName: origName }
    }

    // Case 2: Complex image → convert to PNG with Sharp → pdf-lib
    if (imageConversionExts.includes(ext)) {
      const sharp = (await import('sharp')).default
      const { PDFDocument } = await import('pdf-lib')

      const pngBuffer = await sharp(sourcePath).png().toBuffer()
      const doc = await PDFDocument.create()
      const page = doc.addPage()
      const { width, height } = page.getSize()
      const image = await doc.embedPng(pngBuffer)
      const imgDims = image.scaleToFit(width - 40, height - 40)
      page.drawImage(image, {
        x: (width - imgDims.width) / 2,
        y: (height - imgDims.height) / 2,
        width: imgDims.width,
        height: imgDims.height,
      })

      const pdfBytes = await doc.save()
      writeFileSync(pdfPath, Buffer.from(pdfBytes))
      const stats = statSync(pdfPath)
      return { name: pdfName, size: stats.size, originalName: origName }
    }

    // Case 3: Text/code → read text, create PDF via pdf-lib
    if (textExts.includes(ext)) {
      const { PDFDocument, StandardFonts } = await import('pdf-lib')
      const content = readFileSync(sourcePath, 'utf-8')
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Courier)
      const fontSize = 10
      const lineHeight = fontSize * 1.4
      const margin = 40
      const pageWidth = 612  // US Letter
      const pageHeight = 792
      const maxWidth = pageWidth - margin * 2
      const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight)

      // Split into words for wrapping
      const words = content.split(/(\s+)/)
      let lines: string[] = []
      let currentLine = ''

      for (const word of words) {
        const testLine = currentLine ? currentLine + word : word
        const textWidth = font.widthOfTextAtSize(testLine, fontSize)
        if (textWidth > maxWidth && currentLine) {
          lines.push(currentLine)
          currentLine = word.trim() ? word : ''
        } else {
          currentLine = testLine
        }
      }
      if (currentLine.trim()) lines.push(currentLine)

      // Create pages
      for (let i = 0; i < lines.length; i += maxLinesPerPage) {
        const pageLines = lines.slice(i, i + maxLinesPerPage)
        const page = doc.addPage([pageWidth, pageHeight])
        page.drawText(pageLines.join('\n'), {
          x: margin,
          y: pageHeight - margin - lineHeight,
          size: fontSize,
          font,
          lineHeight,
          maxWidth,
        })
      }

      if (doc.getPageCount() === 0) {
        doc.addPage()
      }

      const pdfBytes = await doc.save()
      writeFileSync(pdfPath, Buffer.from(pdfBytes))
      const stats = statSync(pdfPath)
      return { name: pdfName, size: stats.size, originalName: origName }
    }

    // Case 4: Office/Adobe formats → try LibreOffice CLI
    if (officeExts.includes(ext) || otherExts.includes(ext)) {
      const { execSync } = await import('child_process')
      try {
        execSync(`soffice --headless --convert-to pdf --outdir "${attachmentsDir}" "${sourcePath}"`,
          { timeout: 60000, stdio: 'pipe' }
        )
        // LibreOffice saves with original name .pdf, rename to our prefixed name
        const loPdfName = origName.replace(/\.[^.]+$/, '') + '.pdf'
        const loPdfPath = join(attachmentsDir, loPdfName)
        if (existsSync(loPdfPath)) {
          copyFileSync(loPdfPath, pdfPath)
          rmSync(loPdfPath)
        }
        const stats = statSync(pdfPath)
        return { name: pdfName, size: stats.size, originalName: origName }
      } catch {
        // LibreOffice not available - return a specific error
        return {
          error: `LibreOffice is required to convert ${ext.toUpperCase()} files. Please install LibreOffice and try again.`,
          name: pdfName,
        }
      }
    }

    return { error: `Unsupported format: .${ext}` }
  } catch (err: any) {
    return { error: err?.message || 'Conversion failed' }
  }
})

ipcMain.handle('file:deleteAttachment', async (_event, storedName: string) => {
  const attachmentsDir = join(app.getPath('userData'), 'attachments')
  const filePath = join(attachmentsDir, storedName)
  try {
    rmSync(filePath)
    return { success: true }
  } catch {
    return { success: false }
  }
})
