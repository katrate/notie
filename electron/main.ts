import { app, BrowserWindow, ipcMain, dialog, shell, protocol, Menu } from 'electron'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { existsSync, copyFileSync, mkdirSync, statSync, readFileSync, writeFileSync, rmSync } from 'fs'
import { readFile } from 'fs/promises'
import { autoUpdater } from 'electron-updater'
import { createClient, type Session, type User } from '@supabase/supabase-js'
import WebSocket from 'ws'

const __dirname = dirname(fileURLToPath(import.meta.url))
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key'
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: false,
    detectSessionInUrl: false,
  },
  realtime: {
    transport: WebSocket,
  },
})

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
let authSession: Session | null = null

type CacheEntry<T> = { data: T; expiresAt: number }
const CACHE_TTL_MS = 60_000
const readCache = new Map<string, CacheEntry<unknown>>()

function sessionPath() {
  return join(app.getPath('userData'), 'supabase-session.json')
}

function publicUser(user: User | null | undefined) {
  if (!user) return null
  return {
    id: user.id,
    email: user.email,
    app_metadata: user.app_metadata,
    user_metadata: user.user_metadata,
  }
}

function publicSession(session: Session | null) {
  if (!session) return null
  return {
    expires_at: session.expires_at,
    user: publicUser(session.user),
  }
}

function broadcastAuthState() {
  mainWindow?.webContents.send('auth:state-changed', publicSession(authSession))
}

function clearReadCache(prefix?: string) {
  if (!prefix) {
    readCache.clear()
    return
  }
  for (const key of readCache.keys()) {
    if (key.startsWith(prefix)) readCache.delete(key)
  }
}

async function cached<T>(key: string, loader: () => Promise<T>, ttl = CACHE_TTL_MS): Promise<T> {
  const entry = readCache.get(key) as CacheEntry<T> | undefined
  if (entry && entry.expiresAt > Date.now()) return entry.data
  const data = await loader()
  readCache.set(key, { data, expiresAt: Date.now() + ttl })
  return data
}

async function restoreAuthSession() {
  try {
    if (!existsSync(sessionPath())) return
    const stored = JSON.parse(readFileSync(sessionPath(), 'utf-8')) as Session
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    })
    if (error) throw error
    authSession = data.session
  } catch {
    authSession = null
    try { rmSync(sessionPath()) } catch { /* ignore */ }
  }
}

function persistAuthSession(session: Session | null) {
  authSession = session
  clearReadCache()
  if (!session) {
    try { rmSync(sessionPath()) } catch { /* ignore */ }
    broadcastAuthState()
    return
  }
  writeFileSync(sessionPath(), JSON.stringify(session), 'utf-8')
  broadcastAuthState()
}

async function requireUser() {
  if (!authSession) throw new Error('Not authenticated')
  const { data, error } = await supabase.auth.getUser(authSession.access_token)
  if (error || !data.user) throw new Error(error?.message || 'Not authenticated')
  return data.user
}

function throwIfError(error: { message?: string } | null) {
  if (error) throw new Error(error.message || 'Request failed')
}

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

app.whenReady().then(async () => {
  await restoreAuthSession()

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

  Menu.setApplicationMenu(null)
  createWindow()
  broadcastAuthState()

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

ipcMain.handle('auth:getSession', async () => publicSession(authSession))

ipcMain.handle('auth:getUser', async () => publicUser(authSession?.user))

ipcMain.handle('auth:signIn', async (_event, credentials: { email: string; password: string }) => {
  const { data, error } = await supabase.auth.signInWithPassword(credentials)
  if (error) return { error: error.message }
  persistAuthSession(data.session)
  return { session: publicSession(data.session), user: publicUser(data.user) }
})

ipcMain.handle('auth:signUp', async (_event, credentials: { email: string; password: string }) => {
  const { data, error } = await supabase.auth.signUp(credentials)
  if (error) return { error: error.message }
  if (data.session) persistAuthSession(data.session)
  return { session: publicSession(data.session), user: publicUser(data.user) }
})

ipcMain.handle('auth:signOut', async () => {
  const { error } = await supabase.auth.signOut()
  persistAuthSession(null)
  if (error) return { error: error.message }
  return { success: true }
})

ipcMain.handle('data:fetchProjects', async () => {
  try {
    await requireUser()
    const data = await cached('projects', async () => {
      const result = await supabase
        .from('projects')
        .select('*')
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })
      throwIfError(result.error)
      return result.data || []
    })
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch projects' }
  }
})

ipcMain.handle('data:fetchPages', async (_event, projectId: string) => {
  try {
    await requireUser()
    const data = await cached(`pages:${projectId}`, async () => {
      const result = await supabase
        .from('pages')
        .select('*')
        .eq('project_id', projectId)
        .order('position', { ascending: true })
      throwIfError(result.error)
      return result.data || []
    })
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch pages' }
  }
})

ipcMain.handle('data:fetchStandalonePages', async () => {
  try {
    await requireUser()
    const data = await cached('pages:standalone', async () => {
      const result = await supabase
        .from('pages')
        .select('*')
        .is('project_id', null)
        .order('created_at', { ascending: false })
      throwIfError(result.error)
      return result.data || []
    })
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch standalone pages' }
  }
})

ipcMain.handle('data:getProfileSettings', async () => {
  try {
    const user = await requireUser()
    const settings = await cached(`profile:${user.id}`, async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('settings')
        .eq('id', user.id)
        .maybeSingle()
      throwIfError(error)
      return (data?.settings as Record<string, any>) || {}
    })
    return { data: settings }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch profile settings' }
  }
})

ipcMain.handle('data:mergeProfileSettings', async (_event, settingsPatch: Record<string, any>) => {
  try {
    const user = await requireUser()
    const { data: profile, error: fetchError } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle()
    throwIfError(fetchError)
    const settings = { ...((profile?.settings as Record<string, any>) || {}), ...settingsPatch }
    const { error } = await supabase.from('profiles').upsert({ id: user.id, settings })
    throwIfError(error)
    readCache.set(`profile:${user.id}`, { data: settings, expiresAt: Date.now() + CACHE_TTL_MS })
    return { data: settings }
  } catch (err: any) {
    return { error: err?.message || 'Failed to save profile settings' }
  }
})

ipcMain.handle('data:checkNeedsOnboarding', async () => {
  try {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', user.id)
      .maybeSingle()
    throwIfError(error)
    if (!data || !data.settings) return { data: true }
    const settings = data.settings as Record<string, any>
    if (settings.onboardingCompleted) return { data: false }
    if (settings.lastProjectId || settings.lastPageId || settings.expandedProjects) return { data: false }
    return { data: true }
  } catch {
    return { data: false }
  }
})

ipcMain.handle('data:createProject', async (_event, payload: { name: string; layout_type: string }) => {
  try {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('projects')
      .insert({ name: payload.name, layout_type: payload.layout_type, icon: 'folder', user_id: user.id })
      .select()
      .single()
    throwIfError(error)
    clearReadCache('projects')
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create project' }
  }
})

ipcMain.handle('data:createPage', async (_event, payload: { projectId: string | null; title: string; type: string; metadata?: any; icon?: string | null }) => {
  try {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('pages')
      .insert({
        project_id: payload.projectId,
        title: payload.title,
        type: payload.type,
        metadata: payload.metadata || {},
        icon: payload.icon || null,
        user_id: user.id,
      })
      .select()
      .single()
    throwIfError(error)
    clearReadCache(payload.projectId ? `pages:${payload.projectId}` : 'pages:standalone')
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create page' }
  }
})

ipcMain.handle('data:updatePage', async (_event, payload: { pageId: string; updates: Record<string, any> }) => {
  try {
    await requireUser()
    const { error } = await supabase
      .from('pages')
      .update({ ...payload.updates, updated_at: new Date().toISOString() })
      .eq('id', payload.pageId)
    throwIfError(error)
    clearReadCache('pages:')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to update page' }
  }
})

ipcMain.handle('data:updateProject', async (_event, payload: { projectId: string; updates: Record<string, any> }) => {
  try {
    await requireUser()
    const { error } = await supabase
      .from('projects')
      .update({ ...payload.updates, updated_at: new Date().toISOString() })
      .eq('id', payload.projectId)
    throwIfError(error)
    clearReadCache('projects')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to update project' }
  }
})

ipcMain.handle('data:deleteProject', async (_event, projectId: string) => {
  try {
    await requireUser()
    const { error } = await supabase.from('projects').delete().eq('id', projectId)
    throwIfError(error)
    clearReadCache()
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete project' }
  }
})

ipcMain.handle('data:deletePages', async (_event, pageIds: string[]) => {
  try {
    await requireUser()
    const { error } = await supabase.from('pages').delete().in('id', pageIds)
    throwIfError(error)
    clearReadCache('pages:')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete pages' }
  }
})

ipcMain.handle('data:fetchTemplates', async () => {
  try {
    await requireUser()
    const data = await cached('templates', async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })
      throwIfError(error)
      return data || []
    })
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch templates' }
  }
})

ipcMain.handle('data:createTemplate', async (_event, payload: Record<string, any>) => {
  try {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('templates')
      .insert({ ...payload, user_id: user.id })
      .select()
      .single()
    throwIfError(error)
    clearReadCache('templates')
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to create template' }
  }
})

ipcMain.handle('data:updateTemplate', async (_event, payload: { templateId: string; updates: Record<string, any> }) => {
  try {
    await requireUser()
    const { error } = await supabase
      .from('templates')
      .update({ ...payload.updates, updated_at: new Date().toISOString() })
      .eq('id', payload.templateId)
    throwIfError(error)
    clearReadCache('templates')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to update template' }
  }
})

ipcMain.handle('data:deleteTemplate', async (_event, templateId: string) => {
  try {
    await requireUser()
    const { error } = await supabase.from('templates').delete().eq('id', templateId)
    throwIfError(error)
    clearReadCache('templates')
    return { success: true }
  } catch (err: any) {
    return { error: err?.message || 'Failed to delete template' }
  }
})

ipcMain.handle('data:fetchGraphData', async (_event, projectId: string) => {
  try {
    await requireUser()
    const data = await cached(`graph:${projectId}`, async () => {
      const [nodes, edges] = await Promise.all([
        supabase.from('graph_nodes').select('*').eq('project_id', projectId),
        supabase.from('graph_edges').select('*').eq('project_id', projectId),
      ])
      throwIfError(nodes.error)
      throwIfError(edges.error)
      return { nodes: nodes.data || [], edges: edges.data || [] }
    })
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to fetch graph data' }
  }
})

ipcMain.handle('data:addGraphNode', async (_event, node: Record<string, any>) => {
  try {
    const user = await requireUser()
    const { data, error } = await supabase
      .from('graph_nodes')
      .insert({ ...node, user_id: user.id })
      .select()
      .single()
    throwIfError(error)
    if (node.project_id) clearReadCache(`graph:${node.project_id}`)
    return { data }
  } catch (err: any) {
    return { error: err?.message || 'Failed to add graph node' }
  }
})

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

/** ── Helpers ── */

/** Replace non-WinAnsi characters that Courier (StandardFonts) can't encode.
 *  WinAnsi supports: 0x20-0x7E (ASCII printable), 0xA0-0xFF (extended Latin).
 *  Everything else (newlines, arrows, emoji, CJK, etc.) gets replaced with spaces. */
function sanitizeForPdfText(text: string): string {
  return text
    .replace(/\r?\n/g, ' ')        // newlines
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '') // other control chars
    .replace(/\t/g, ' ')             // tabs
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, ' ')  // any non-WinAnsi Unicode
    .replace(/  +/g, ' ')            // collapse multiple spaces
    .trim()
}

/** ── Types ── */

interface OcrWord {
  text: string
  x: number  // PDF point coords (US Letter space 612x792)
  y: number
  w: number
  h: number
}

/**
 * Extract text from an image via OCR and return word bounding boxes
 * in PDF coordinate space (US Letter, 612x792 pts, image centered with 40pt margins).
 */
async function runImageOcr(
  imagePath: string,
  imgWidth: number,
  imgHeight: number,
): Promise<OcrWord[]> {
  try {
    const Tesseract = await import('tesseract.js')
    const worker = await Tesseract.createWorker('eng')
    const { data } = await worker.recognize(imagePath)
    await worker.terminate()

    if (!data.words || data.words.length === 0) return []

    const pageWidth = 612
    const pageHeight = 792
    const margin = 40
    const fitW = pageWidth - margin * 2
    const fitH = pageHeight - margin * 2
    const scale = Math.min(fitW / imgWidth, fitH / imgHeight)
    const renderedW = imgWidth * scale
    const renderedH = imgHeight * scale
    const imgX = (pageWidth - renderedW) / 2
    const imgY = (pageHeight - renderedH) / 2

    // Filter out very short text (likely noise)
    const goodWords = data.words.filter((w: any) => w.text && w.text.length >= 2 && w.bbox)

    return goodWords.map((w: any) => ({
      text: w.text,
      x: imgX + w.bbox.x0 * scale,
      y: imgY + (imgHeight - w.bbox.y1) * scale,   // flip Y: image top → PDF bottom
      w: (w.bbox.x1 - w.bbox.x0) * scale,
      h: (w.bbox.y1 - w.bbox.y0) * scale,
    }))
  } catch {
    return []  // OCR is best-effort
  }
}

/**
 * Convert a source file to PDF and save to attachments directory.
 * Supports: images, text/code files, Office docs (via mammoth/xlsx), PSB (via sharp)
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
  // ── Image formats that need Sharp conversion (PSD is handled here too) ──
  const imageConversionExts = ['bmp', 'gif', 'tiff', 'tif', 'webp', 'svg', 'ico', 'psd']
  // ── Text/code formats (read as UTF-8, rendered with Courier) ──
  const textExts = ['txt', 'csv', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'bat', 'sh', 'ps1']
  // ── Rich formats (handled by Node libraries) ──
  const officeExts = ['doc', 'docx', 'xls', 'xlsx', 'xlxs', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'rtf']
  // ── Adobe/other formats ──
  const otherExts = ['ai', 'eps', 'ps', 'prn', 'indd']

  try {
    // ── Check file existence & accessibility first ──
    if (!existsSync(sourcePath)) {
      return {
        error: `File not found: ${origName}. It may have been moved or deleted.`,
        name: pdfName,
      }
    }
    try {
      statSync(sourcePath)
    } catch {
      return {
        error: `Cannot access ${origName}. It may be open in another program (like Excel) or you may not have permission to read it. Close the file in any other program and try again.`,
        name: pdfName,
      }
    }

    // ────────────────────────────────────────────────
    // Case 1: Direct image → PDF via pdf-lib + OCR
    // ────────────────────────────────────────────────
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

      const imgWidth = image.width
      const imgHeight = image.height

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

      // OCR for text-in-image highlighting (best-effort)
      const ocrWords = await runImageOcr(sourcePath, imgWidth, imgHeight)

      return { name: pdfName, size: stats.size, originalName: origName, ocrWords }
    }

    // ────────────────────────────────────────────────
    // Case 2: Complex image → convert to PNG with Sharp → pdf-lib + OCR
    // ────────────────────────────────────────────────
    if (imageConversionExts.includes(ext)) {
      const sharp = (await import('sharp')).default
      const { PDFDocument } = await import('pdf-lib')

      // Get original image dimensions for OCR coordinate mapping
      const metadata = await sharp(sourcePath).metadata()
      const imgWidth = metadata.width || 0
      const imgHeight = metadata.height || 0

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

      // OCR for text-in-image highlighting (best-effort)
      const ocrWords = imgWidth > 0 && imgHeight > 0
        ? await runImageOcr(sourcePath, imgWidth, imgHeight)
        : []

      return { name: pdfName, size: stats.size, originalName: origName, ocrWords }
    }

    // ────────────────────────────────────────────────
    // Case 3: Text/code → read text, create PDF via pdf-lib
    // ────────────────────────────────────────────────
    if (textExts.includes(ext)) {
      const { PDFDocument, StandardFonts } = await import('pdf-lib')
      const rawContent = readFileSync(sourcePath, 'utf-8')
      // Sanitize for pdf-lib's WinAnsi fonts (strip newlines, tabs, non-encodable Unicode)
      const content = sanitizeForPdfText(rawContent)
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

      // Create pages (draw each line individually to avoid WinAnsi newline encoding errors)
      for (let i = 0; i < lines.length; i += maxLinesPerPage) {
        const pageLines = lines.slice(i, i + maxLinesPerPage)
        const page = doc.addPage([pageWidth, pageHeight])
        for (let j = 0; j < pageLines.length; j++) {
          // Strip any remaining newlines before drawing (WinAnsi can't encode 0x0a)
          const clean = pageLines[j].replace(/[\r\n]/g, ' ')
          page.drawText(clean, {
            x: margin,
            y: pageHeight - margin - lineHeight - j * lineHeight,
            size: fontSize,
            font,
            maxWidth,
          })
        }
      }

      if (doc.getPageCount() === 0) {
        doc.addPage()
      }

      const pdfBytes = await doc.save()
      writeFileSync(pdfPath, Buffer.from(pdfBytes))
      const stats = statSync(pdfPath)
      return { name: pdfName, size: stats.size, originalName: origName }
    }

    // ────────────────────────────────────────────────
    // Case 4: Office / document formats → extract text, render as PDF via pdf-lib
    // ────────────────────────────────────────────────
    if (officeExts.includes(ext) || otherExts.includes(ext)) {
      let text = ''

      // ── DOCX: mammoth ──
      if (ext === 'docx') {
        const mammoth = await import('mammoth')
        const result = await mammoth.extractRawText({ path: sourcePath })
        text = result.value
      }
      // ── XLSX / XLS: SheetJS ──
      else if (ext === 'xlsx' || ext === 'xlxs' || ext === 'xls') {
        const XLSX = await import('xlsx')
        const workbook = XLSX.readFile(sourcePath)
        const parts: string[] = []
        for (const sheetName of workbook.SheetNames) {
          const sheet = workbook.Sheets[sheetName]
          const csv = XLSX.utils.sheet_to_csv(sheet)
          parts.push(`── ${sheetName} ──`, '', csv, '')
        }
        text = parts.join('\n')
      }
      // ── PPTX: extract text from ZIP/XML slides ──
      else if (ext === 'pptx') {
        const JSZip = await import('jszip')
        const zip = await JSZip.loadAsync(readFileSync(sourcePath))
        const slideFiles = Object.keys(zip.files)
          .filter(f => /^ppt\/slides\/slide\d+\.xml$/.test(f))
          .sort()
        const parts: string[] = []
        for (const file of slideFiles) {
          const xml = await zip.files[file].async('text')
          const slideText = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
          if (slideText) parts.push(slideText)
        }
        text = parts.join('\n\n')
      }
      // ── RTF: strip control words ──
      else if (ext === 'rtf') {
        const content = readFileSync(sourcePath, 'utf-8')
        text = content
          .replace(/\\[a-z]+[-]?\d*\b/g, ' ')
          .replace(/\{[^}]*\}/g, ' ')
          .replace(/\\(?:'[0-9a-f]{2}|[^\s])/g, ' ')
          .replace(/[{}]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
      }
      // ── DOC / ODT / ODS / ODP: ZIP-based XML ──
      else if (['odt', 'ods', 'odp'].includes(ext)) {
        const JSZip = await import('jszip')
        const zip = await JSZip.loadAsync(readFileSync(sourcePath))
        const contentFile = zip.files['content.xml']
        if (contentFile) {
          const xml = await contentFile.async('text')
          text = xml.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
        }
      }
      // ── Legacy .doc format ──
      else if (ext === 'doc') {
        // .doc is binary — try to extract text, but likely will get garbage
        const raw = readFileSync(sourcePath, 'binary')
        // Simple heuristic: extract printable ASCII sequences
        const matches = raw.match(/[\x20-\x7E]{4,}/g)
        text = (matches || []).join(' ').trim()
      }

      if (!text) {
        return {
          error: `Could not extract content from ${ext.toUpperCase()} file. Try saving as a PDF or DOCX format instead.`,
          name: pdfName,
        }
      }

      // ── Render extracted text as PDF (same approach as Case 3) ──
      const { PDFDocument, StandardFonts } = await import('pdf-lib')
      const doc = await PDFDocument.create()
      const font = await doc.embedFont(StandardFonts.Courier)
      const fontSize = 10
      const lineHeight = fontSize * 1.4
      const margin = 40
      const pageWidth = 612
      const pageHeight = 792
      const maxWidth = pageWidth - margin * 2
      const maxLinesPerPage = Math.floor((pageHeight - margin * 2) / lineHeight)

      // Sanitize for pdf-lib's WinAnsi fonts (strip newlines, tabs, non-encodable Unicode)
      const cleaned = sanitizeForPdfText(text)

      const words = cleaned.split(/(\s+)/)
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

      // Draw each line individually to avoid WinAnsi newline encoding errors
      for (let i = 0; i < lines.length; i += maxLinesPerPage) {
        const pageLines = lines.slice(i, i + maxLinesPerPage)
        const page = doc.addPage([pageWidth, pageHeight])
        for (let j = 0; j < pageLines.length; j++) {
          // Strip any remaining newlines before drawing (WinAnsi can't encode 0x0a)
          const clean = pageLines[j].replace(/[\r\n]/g, ' ')
          page.drawText(clean, {
            x: margin,
            y: pageHeight - margin - lineHeight - j * lineHeight,
            size: fontSize,
            font,
            maxWidth,
          })
        }
      }

      if (doc.getPageCount() === 0) {
        doc.addPage()
      }

      const pdfBytes = await doc.save()
      writeFileSync(pdfPath, Buffer.from(pdfBytes))
      const stats = statSync(pdfPath)

      return {
        name: pdfName,
        size: stats.size,
        originalName: origName,
        sourceFormat: ext,
      }
    }

    return { error: `Unsupported format: .${ext}` }
  } catch (err: any) {
    const code = err?.code || 'UNKNOWN'
    const msg = err?.message || 'Conversion failed'
    return { error: `[${code}] ${msg}` }
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
