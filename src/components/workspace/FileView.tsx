import { useState, useEffect, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useToastStore } from '../../stores/toastStore'
import { Tooltip } from '../Tooltip'

export interface FileItem {
  id: string
  name: string      // stored filename (timestamp-prefixed, relative)
  originalName: string
  addedAt: string
  size: number
}

// Map common extensions to Material Symbols icons
function getFileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    pdf: 'picture_as_pdf',
    doc: 'description',
    docx: 'description',
    xls: 'table_chart',
    xlsx: 'table_chart',
    ppt: 'slideshow',
    pptx: 'slideshow',
    txt: 'text_snippet',
    csv: 'table_rows',
    json: 'code',
    xml: 'code',
    js: 'javascript',
    ts: 'javascript',
    jsx: 'javascript',
    tsx: 'javascript',
    py: 'code',
    rs: 'code',
    go: 'code',
    java: 'code',
    cpp: 'code',
    c: 'code',
    h: 'code',
    html: 'html',
    css: 'css',
    scss: 'css',
    sass: 'css',
    md: 'article',
    yaml: 'data_object',
    yml: 'data_object',
    toml: 'data_object',
    zip: 'folder_zip',
    tar: 'folder_zip',
    gz: 'folder_zip',
    rar: 'folder_zip',
    '7z': 'folder_zip',
    exe: 'terminal',
    dmg: 'install_desktop',
    app: 'install_desktop',
    iso: 'disc',
    mp3: 'audio_file',
    wav: 'audio_file',
    flac: 'audio_file',
    ogg: 'audio_file',
    mp4: 'video_file',
    mov: 'video_file',
    avi: 'video_file',
    mkv: 'video_file',
    png: 'image',
    jpg: 'image',
    jpeg: 'image',
    gif: 'image',
    webp: 'image',
    svg: 'image',
    ico: 'image',
    bmp: 'image',
  }
  return iconMap[ext] || 'insert_drive_file'
}

// Format bytes to human-readable
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return `${Math.floor(days / 30)}mo ago`
}

export function FileView() {
  const { pages, activePageId, updatePageContent } = useProjectStore()
  const activePage = pages.find(p => p.id === activePageId)

  const [files, setFiles] = useState<FileItem[]>([])
  const [search, setSearch] = useState('')
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Sync from page content
  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setFiles(activePage.content as FileItem[])
    } else {
      setFiles([])
    }
  }, [activePage?.content, activePageId])

  const saveFiles = (newFiles: FileItem[]) => {
    setFiles(newFiles)
    if (activePageId) updatePageContent(activePageId, newFiles)
  }

  // Resolve stored name to full path
  const resolvePath = async (stored: string): Promise<string> => {
    if (stored.startsWith('/') || stored.includes(':/') || stored.includes(':\\') || stored.startsWith('\\\\')) {
      return stored
    }
    const { appLocalDataDir, join } = await import('@tauri-apps/api/path')
    return join(await appLocalDataDir(), 'attachments', stored)
  }

  const handleAddFiles = async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog')
      const selected = await open({
        multiple: true,
        title: 'Select files',
      })
      if (!selected || (selected as string[]).length === 0) return
      const srcPaths = selected as string[]

      const { invoke } = await import('@tauri-apps/api/core')

      const newFiles: FileItem[] = []
      for (const srcPath of srcPaths) {
        const result: { name: string; size: number } = await invoke('attach_file', { sourcePath: srcPath })
        const origName = srcPath.split(/[\\/]/).pop() || result.name
        newFiles.push({
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          name: result.name,
          originalName: origName,
          addedAt: new Date().toISOString(),
          size: result.size,
        })
      }

      saveFiles([...newFiles, ...files])
      useToastStore.getState().toast(
        `${newFiles.length} file${newFiles.length !== 1 ? 's' : ''} added.`,
        'success'
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('add files error:', msg)
      useToastStore.getState().toast(`Failed to add files: ${msg}`, 'error')
    }
  }

  const handleOpenFile = async (file: FileItem) => {
    try {
      const fullPath = await resolvePath(file.name)
      const { invoke } = await import('@tauri-apps/api/core')
      const fileExists: boolean = await invoke('file_exists', { path: fullPath })
      if (!fileExists) {
        useToastStore.getState().toast(
          `File "${file.originalName}" not found. It may have been moved or deleted.`,
          'error'
        )
        return
      }
      const { openPath } = await import('@tauri-apps/plugin-opener')
      await openPath(fullPath)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('openPath error:', msg, 'file:', file.name)
      useToastStore.getState().toast(`Failed to open file: ${msg}`, 'error')
    }
  }

  const handleDeleteFile = (fileId: string) => {
    const updated = files.filter(f => f.id !== fileId)
    saveFiles(updated)
    useToastStore.getState().toast('File removed from list.', 'info')
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return files
    const q = search.toLowerCase()
    return files.filter(f =>
      f.originalName.toLowerCase().includes(q)
    )
  }, [files, search])

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-shrink-0">
        <span className="material-symbols-outlined text-[22px] text-primary">folder</span>
        <h2 className="text-lg font-bold text-on-surface">Files</h2>
        <span className="text-[11px] text-on-surface-variant/60">{files.length} file{files.length !== 1 ? 's' : ''}</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[14px] absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search files..."
              className="w-36 md:w-48 bg-surface/50 border border-outline/20 focus:border-primary/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
            />
          </div>

          <button
            onClick={handleAddFiles}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add Files
          </button>
        </div>
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-2xl bg-surface/50 border border-outline/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[32px] opacity-40">folder_open</span>
            </div>
            {search ? (
              <p className="text-sm opacity-60">No results for "{search}"</p>
            ) : (
              <>
                <p className="text-sm font-medium opacity-60 mb-1">No files yet</p>
                <p className="text-xs opacity-40">Add files from your system to get started</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(file => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 rounded-xl border border-outline/5 bg-surface/20 hover:bg-surface/40 hover:border-outline/15 transition-all duration-150 group cursor-pointer"
                onMouseEnter={() => setHoveredId(file.id)}
                onMouseLeave={() => setHoveredId(null)}
                onDoubleClick={() => handleOpenFile(file)}
              >
                {/* File icon */}
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[22px] text-primary">
                    {getFileIcon(file.originalName)}
                  </span>
                </div>

                {/* File info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{file.originalName}</p>
                  <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
                    {formatSize(file.size)} · {timeAgo(file.addedAt)}
                  </p>
                </div>

                {/* Actions */}
                <div className={`flex items-center gap-1 transition-all duration-150 ${hoveredId === file.id ? 'opacity-100' : 'opacity-0'}`}>
                  <Tooltip label="Open file">
                    <button
                      onClick={() => handleOpenFile(file)}
                      className="p-1.5 rounded-lg hover:bg-primary/10 text-on-surface-variant hover:text-primary transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                    </button>
                  </Tooltip>
                  <Tooltip label="Remove from list">
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1.5 rounded-lg hover:bg-red-500/15 text-on-surface-variant hover:text-red-400 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
