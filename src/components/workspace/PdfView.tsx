import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { useToastStore } from '../../stores/toastStore'
import { Tooltip } from '../Tooltip'
import { pdfjs, Document as PdfDoc, Page } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

// Configure pdf.js worker — use bundled copy from react-pdf's pdfjs-dist (v5.4.296)
// The file is in public/ and works with both dev server and Electron's file:// protocol
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs'

/* ── Types ── */

interface Highlight {
  id: string
  pageNumber: number
  rects: { x: number; y: number; w: number; h: number }[]
  color: string
  note?: string
  text?: string
  captureScale?: number
}

interface OcrWord {
  text: string
  x: number  // PDF point coords (US Letter 612x792)
  y: number
  w: number
  h: number
}

interface PdfFileState {
  id: string
  /** Stored attachment name (relative path) */
  name: string
  /** Original file name shown to user */
  originalName: string
  pageCount: number
  addedAt: string
}

const HIGHLIGHT_COLORS = [
  '#fef08a', // yellow
  '#86efac', // green
  '#93c5fd', // blue
  '#fca5a5', // red
  '#d8b4fe', // purple
  '#fdba74', // orange
  '#99f6e4', // teal
  '#f9a8d4', // pink
]

function genId() {
  return `pdf_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`
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

/* ── Component ── */

export function PdfView() {
  const { pages, activePageId, updatePageContent, sidebarVisible, setSidebarVisible } = useProjectStore()
  const activePage = pages.find(p => p.id === activePageId)

  // ── State ──
  const [pdfFile, setPdfFile] = useState<PdfFileState | null>(null)
  const [numPages, setNumPages] = useState(0)
  const [pageNumber, setPageNumber] = useState(1)
  const [scale, setScale] = useState(1.0)
  const [rotation, setRotation] = useState(0)
  const [highlights, setHighlights] = useState<Highlight[]>([])
  const [activeHighlightColor, setActiveHighlightColor] = useState(HIGHLIGHT_COLORS[0])
  const [showHighlightPicker, setShowHighlightPicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [searchResults, setSearchResults] = useState<{ pageNumber: number }[]>([])
  const [currentSearchIdx, setCurrentSearchIdx] = useState(-1)
  const [showSidebar, setShowSidebar] = useState(true)
  const [sidebarTab, setSidebarTab] = useState<'thumbnails' | 'highlights'>('thumbnails')
  const [editingHighlight, setEditingHighlight] = useState<string | null>(null)
  const [editingHighlightNote, setEditingHighlightNote] = useState('')
  const [pdfUrl, setPdfUrl] = useState<string | undefined>(undefined)
  const [highlightHistory, setHighlightHistory] = useState<Highlight[][]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [convertStatus, setConvertStatus] = useState('')
  const [ocrWords, setOcrWords] = useState<OcrWord[]>([])
  const [sourceFormat, setSourceFormat] = useState<string | undefined>(undefined)
  const highlightHistoryRef = useRef<Highlight[][]>([])
  const searchInputRef = useRef<HTMLInputElement>(null)
  const pageContainerRef = useRef<HTMLDivElement>(null)

  // ── Load from page content ──
  useEffect(() => {
    if (activePage?.content && typeof activePage.content === 'object' && activePage.content !== null) {
      const content = activePage.content as any
      if (content.pdfFile) setPdfFile(content.pdfFile)
      if (content.highlights) {
        setHighlights(content.highlights)
      }
      if (content.pageNumber) setPageNumber(content.pageNumber)
      if (content.scale) setScale(content.scale)
      if (content.rotation) setRotation(content.rotation)
      if (content.ocrWords) setOcrWords(content.ocrWords)
      if (content.sourceFormat) setSourceFormat(content.sourceFormat)
    } else {
      setPdfFile(null)
      setHighlights([])
      setHighlightHistory([])
      setOcrWords([])
      setSourceFormat(undefined)
      setNumPages(0)
      setPageNumber(1)
      setScale(1.0)
      setRotation(0)
    }
  }, [activePageId, activePage?.content])

  // ── Save state ──
  const saveState = useCallback((updates: Record<string, any>) => {
    if (!activePageId) return
    const current = activePage?.content && typeof activePage.content === 'object' ? (activePage.content as any) : {}
    updatePageContent(activePageId, { ...current, ...updates })
  }, [activePageId, activePage?.content, updatePageContent])

  const getAttachmentUrl = (storedName: string): string => {
    return `notie-attachment://${storedName}`
  }

  // ── Open PDF from system ──
  const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'bmp', 'gif', 'tiff', 'tif', 'webp', 'svg', 'ico', 'psd']
  const OFFICE_FORMATS = ['doc', 'docx', 'xls', 'xlsx', 'xlxs', 'ppt', 'pptx', 'odt', 'ods', 'odp', 'csv', 'rtf']
  const TEXT_FORMATS = ['txt', 'xml', 'html', 'htm', 'css', 'js', 'ts', 'jsx', 'tsx', 'json', 'md', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'log', 'bat', 'sh', 'ps1']
  const OTHER_FORMATS = ['ai', 'eps', 'ps', 'prn', 'indd']
  const ALL_FORMATS = ['pdf', ...IMAGE_FORMATS, ...OFFICE_FORMATS, ...TEXT_FORMATS, ...OTHER_FORMATS]

  const handleOpenPdf = async () => {
    try {
      const api = window.electronAPI
      if (!api) { useToastStore.getState().toast('File system not available.', 'error'); return }
      const selected = await api.openFileDialog({
        multiple: false,
        title: 'Open Document',
        filters: [
          { name: 'All Supported Documents', extensions: ALL_FORMATS },
          { name: 'PDF', extensions: ['pdf'] },
          { name: 'Images', extensions: IMAGE_FORMATS },
          { name: 'Office Documents', extensions: OFFICE_FORMATS },
          { name: 'Text & Code', extensions: TEXT_FORMATS },
          { name: 'All Files', extensions: ['*'] },
        ],
      })
      if (!selected || selected.length === 0) return

      const srcPath = selected[0]
      const origName = srcPath.split(/[\\\\/]/).pop() || 'document'
      const ext = origName.split('.').pop()?.toLowerCase() || ''

      // Clean up previous temp PDF if any
      const prevPdfFile = pdfFile

      setIsConverting(true)
      setConvertStatus(`Opening ${origName}...`)

      let pdfResult: { name: string; size?: number; originalName?: string; error?: string; ocrWords?: OcrWord[]; sourceFormat?: string }

      if (ext === 'pdf') {
        // Direct PDF — just attach
        pdfResult = await api.attachFile(srcPath)
        pdfResult.originalName = origName
      } else {
        // Convert to PDF first
        setConvertStatus(`Converting ${origName} to PDF...`)
        pdfResult = await api.convertToPdf(srcPath)

        if (pdfResult.error) {
          setIsConverting(false)
          useToastStore.getState().toast(pdfResult.error, 'error')
          return
        }
      }

      // Delete previous temp PDF
      if (prevPdfFile?.name && prevPdfFile.name !== pdfResult.name) {
        api.deleteAttachment(prevPdfFile.name).catch(() => {})
      }

      const newFile: PdfFileState = {
        id: genId(),
        name: pdfResult.name,
        originalName: pdfResult.originalName || origName,
        pageCount: 0,
        addedAt: new Date().toISOString(),
      }

      setPdfFile(newFile)
      setPageNumber(1)
      setScale(1.0)
      setRotation(0)
      setHighlights([])
      setOcrWords(pdfResult.ocrWords || [])
      setSourceFormat(pdfResult.sourceFormat)
      highlightHistoryRef.current = []
      setHighlightHistory([])
      setNumPages(0)
      setPdfUrl(undefined)
      setIsConverting(false)
      setConvertStatus('')
      saveState({
        pdfFile: newFile,
        highlights: [],
        ocrWords: pdfResult.ocrWords || [],
        sourceFormat: pdfResult.sourceFormat || (ext !== 'pdf' ? ext : undefined),
        sourceName: ext !== 'pdf' ? origName : undefined,
        pageNumber: 1,
        scale: 1.0,
        rotation: 0,
      })
      useToastStore.getState().toast(`Opened "${origName}"`, 'success')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setIsConverting(false)
      setConvertStatus('')
      useToastStore.getState().toast(`Failed to open document: ${msg}`, 'error')
    }
  }

  // ── Construct PDF URL when pdfFile changes ──
  useEffect(() => {
    if (!pdfFile) {
      setPdfUrl(undefined)
      return
    }
    setPdfUrl(getAttachmentUrl(pdfFile.name))
  }, [pdfFile])

  // ── PDF callbacks ──
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    setNumPages(pdf.numPages)
    if (pdfFile) {
      saveState({ pdfFile: { ...pdfFile, pageCount: pdf.numPages } })
    }
  }, [pdfFile, saveState])

  // ── Navigation ──
  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(page, numPages))
    setPageNumber(p)
    saveState({ pageNumber: p })
  }

  const zoomIn = () => {
    const s = Math.min(scale * 1.2, 4.0)
    setScale(s)
    saveState({ scale: s })
  }

  const zoomOut = () => {
    const s = Math.max(scale / 1.2, 0.3)
    setScale(s)
    saveState({ scale: s })
  }

  const rotateCW = () => {
    const r = (rotation + 90) % 360
    setRotation(r)
    saveState({ rotation: r })
  }

  // ── Undo for highlights ──
  const pushHighlightState = useCallback(() => {
    highlightHistoryRef.current = [
      ...highlightHistoryRef.current.slice(-49),
      [...highlights],
    ]
    setHighlightHistory(highlightHistoryRef.current)
  }, [highlights])

  const undoHighlight = useCallback(() => {
    if (highlightHistoryRef.current.length === 0) return
    const prev = highlightHistoryRef.current[highlightHistoryRef.current.length - 1]
    highlightHistoryRef.current = highlightHistoryRef.current.slice(0, -1)
    setHighlightHistory(highlightHistoryRef.current)
    setHighlights(prev)
    saveState({ highlights: prev })
    useToastStore.getState().toast('Undo highlight', 'info')
  }, [saveState])

  // ── Highlighting ──
  const handleTextSelection = useCallback(() => {
    const selection = window.getSelection()
    if (!selection || selection.isCollapsed || !selection.toString().trim()) return

    // Get the page container element
    const pageEl = pageContainerRef.current?.querySelector('.react-pdf__Page')
    if (!pageEl) return

    // Get the selected text
    const selectedText = selection.toString().trim()
    if (!selectedText) return

    // Get bounding rects of the selection within the page
    const range = selection.getRangeAt(0)
    const rects = range.getClientRects()
    const pageRect = pageEl.getBoundingClientRect()

    const highlightRects: { x: number; y: number; w: number; h: number }[] = []
    for (const rect of Array.from(rects)) {
      if (rect.width === 0 || rect.height === 0) continue
      highlightRects.push({
        x: (rect.left - pageRect.left),
        y: (rect.top - pageRect.top),
        w: rect.width,
        h: rect.height,
      })
    }

    if (highlightRects.length === 0) return

    const newHighlight: Highlight = {
      id: genId(),
      pageNumber,
      rects: highlightRects,
      color: activeHighlightColor,
      text: selectedText.substring(0, 200),
      captureScale: scale,
    }

    pushHighlightState()
    const updated = [...highlights, newHighlight]
    setHighlights(updated)
    saveState({ highlights: updated })
    selection.removeAllRanges()
  }, [pageNumber, scale, highlights, activeHighlightColor, saveState, pushHighlightState])

  // Highlight from text selection via button or shortcut
  const addHighlight = useCallback(() => {
    handleTextSelection()
  }, [handleTextSelection])

  const removeHighlight = (id: string) => {
    pushHighlightState()
    const updated = highlights.filter(h => h.id !== id)
    setHighlights(updated)
    saveState({ highlights: updated })
  }

  const updateHighlightNote = (id: string, note: string) => {
    pushHighlightState()
    const updated = highlights.map(h => h.id === id ? { ...h, note } : h)
    setHighlights(updated)
    saveState({ highlights: updated })
    setEditingHighlight(null)
  }

  const changeHighlightColor = (id: string, color: string) => {
    pushHighlightState()
    const updated = highlights.map(h => h.id === id ? { ...h, color } : h)
    setHighlights(updated)
    saveState({ highlights: updated })
  }

  // ── Search ──
  const performSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setCurrentSearchIdx(-1)
      return
    }
    // Simple search using highlights and text layer - we'll search the highlights text
    const q = searchQuery.toLowerCase()
    const results: { pageNumber: number }[] = []
    highlights.forEach(h => {
      if (h.text && h.text.toLowerCase().includes(q)) {
        if (!results.some(r => r.pageNumber === h.pageNumber)) {
          results.push({ pageNumber: h.pageNumber })
        }
      }
    })
    // Also check all pages - we'll add a "page found" for pages that have any highlight matching
    setSearchResults(results)
    setCurrentSearchIdx(results.length > 0 ? 0 : -1)
    if (results.length > 0) {
      goToPage(results[0].pageNumber)
    }
  }, [searchQuery, highlights])

  const goToNextSearchResult = () => {
    if (searchResults.length === 0) return
    const next = (currentSearchIdx + 1) % searchResults.length
    setCurrentSearchIdx(next)
    goToPage(searchResults[next].pageNumber)
  }

  const goToPrevSearchResult = () => {
    if (searchResults.length === 0) return
    const prev = (currentSearchIdx - 1 + searchResults.length) % searchResults.length
    setCurrentSearchIdx(prev)
    goToPage(searchResults[prev].pageNumber)
  }

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') return

      if (e.key === 'ArrowLeft' && e.altKey) { e.preventDefault(); goToPage(pageNumber - 1) }
      if (e.key === 'ArrowRight' && e.altKey) { e.preventDefault(); goToPage(pageNumber + 1) }
      if (e.key === '+' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomIn() }
      if (e.key === '-' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); zoomOut() }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); undoHighlight() }
      if ((e.key === 'h' || e.key === 'H') && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); addHighlight() }
      if (e.key === 'f' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        setShowSearch(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      if (e.key === 'Escape') {
        setShowSearch(false)
        setSearchQuery('')
        setSearchResults([])
        setCurrentSearchIdx(-1)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [pageNumber, numPages, scale, addHighlight, undoHighlight])

  // ── Touchpad pinch-to-zoom on the PDF container ──
  // Use a ref for scale so the wheel handler stays stable during rapid zoom events
  const scaleRef = useRef(scale)
  scaleRef.current = scale

  const handleWheel = useCallback((e: WheelEvent) => {
    if (!e.ctrlKey && !e.metaKey) return
    e.preventDefault()
    // Make zoom proportional to scroll distance for natural feel
    const direction = e.deltaY > 0 ? -1 : 1
    const absDelta = Math.abs(e.deltaY)
    const factor = 1 + direction * Math.min(absDelta / 100, 0.3)
    const newScale = Math.max(0.3, Math.min(4.0, scaleRef.current * factor))
    scaleRef.current = newScale
    setScale(newScale)
    saveState({ scale: newScale })
  }, [saveState])

  // Attach wheel listener to the PDF scroll container
  useEffect(() => {
    const el = pageContainerRef.current
    if (!el) return
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, [handleWheel])

  // ── Render ──

  const currentPageHighlights = useMemo(() => {
    return highlights.filter(h => h.pageNumber === pageNumber)
  }, [highlights, pageNumber])

  // Memoize the file prop so react-pdf doesn't re-load on every render
  const fileProp = useMemo(() => {
    return pdfUrl || undefined
  }, [pdfUrl])

  if (!activePage) return null

  // ── No PDF loaded: show file picker (or converting state) ──
  if (!pdfFile) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-surface/20 rounded-xl border border-outline/10 mx-auto w-full max-w-3xl min-h-[400px] p-8">
        {isConverting ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
            <h2 className="text-lg font-bold text-on-surface mb-2">Converting Document</h2>
            <p className="text-sm text-on-surface-variant/70 text-center max-w-md">{convertStatus}</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
              <span className="material-symbols-outlined text-[48px] text-primary">picture_as_pdf</span>
            </div>
            <h2 className="text-xl font-bold text-on-surface mb-2">Document Viewer</h2>
            <p className="text-sm text-on-surface-variant/70 mb-8 text-center max-w-md">
              Open PDFs, images, Office documents, and more. Supported files are converted to PDF for viewing and annotation.
            </p>
            <button
              onClick={handleOpenPdf}
              className="flex items-center gap-2.5 px-6 py-3 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:opacity-90 transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            >
              <span className="material-symbols-outlined text-[20px]">folder_open</span>
              Open Document from System
            </button>
            <p className="mt-4 text-[10px] text-on-surface-variant/40">
              Supports PDF, images, Office docs, text, and more
            </p>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-surface/10 rounded-xl border border-outline/10 overflow-hidden">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-surface/40 border-b border-outline/10 flex-shrink-0 flex-wrap">
        {/* App sidebar toggle (page tree / projects) */}
        <Tooltip label={sidebarVisible ? 'Hide page panel' : 'Show page panel'}>
          <button
            onClick={() => setSidebarVisible(!sidebarVisible)}
            className={`p-1.5 rounded-lg transition-colors ${sidebarVisible ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10'}`}
          >
            <span className="material-symbols-outlined text-[16px]">{sidebarVisible ? 'left_panel_open' : 'left_panel_close'}</span>
          </button>
        </Tooltip>

        {/* PDF internal sidebar toggle (thumbnails / highlights) */}
        <Tooltip label={showSidebar ? 'Hide PDF sidebar' : 'Show PDF sidebar'}>
          <button
            onClick={() => setShowSidebar(!showSidebar)}
            className={`p-1.5 rounded-lg transition-colors ${showSidebar ? 'bg-primary/15 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10'}`}
          >
            <span className="material-symbols-outlined text-[16px]">menu</span>
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-outline/10 mx-1" />

        {/* File info */}
        <span className="text-xs text-on-surface font-medium truncate max-w-[180px]">{pdfFile.originalName}</span>
        {numPages > 0 && (
          <span className="text-[10px] text-on-surface-variant/60">{numPages} pages</span>
        )}

        {/* Open another PDF */}
        <Tooltip label="Open another PDF">
          <button
            onClick={handleOpenPdf}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">folder_open</span>
          </button>
        </Tooltip>

        <div className="flex-1" />

        {/* Search */}
        <div className="flex items-center gap-1">
          {showSearch ? (
            <div className="flex items-center gap-1 bg-surface/50 border border-outline/20 rounded-lg px-2 py-1">
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">search</span>
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') performSearch() }}
                placeholder="Search..."
                className="w-28 bg-transparent outline-none text-xs text-on-surface placeholder:text-on-surface-variant/30"
              />
              {searchResults.length > 0 && (
                <span className="text-[10px] text-on-surface-variant/50 tabular-nums">
                  {currentSearchIdx + 1}/{searchResults.length}
                </span>
              )}
              <button onClick={goToPrevSearchResult} className="p-0.5 rounded text-on-surface-variant hover:text-on-surface" disabled={searchResults.length === 0}>
                <span className="material-symbols-outlined text-[14px]">chevron_left</span>
              </button>
              <button onClick={goToNextSearchResult} className="p-0.5 rounded text-on-surface-variant hover:text-on-surface" disabled={searchResults.length === 0}>
                <span className="material-symbols-outlined text-[14px]">chevron_right</span>
              </button>
              <button onClick={() => { setShowSearch(false); setSearchQuery(''); setSearchResults([]); setCurrentSearchIdx(-1) }} className="p-0.5 rounded text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ) : (
            <Tooltip label="Search (Ctrl+F)">
              <button onClick={() => setShowSearch(true)} className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors">
                <span className="material-symbols-outlined text-[16px]">search</span>
              </button>
            </Tooltip>
          )}
        </div>

        {/* Highlight */}
        <div className="relative">
          <Tooltip label="Highlight selected text (Ctrl+Shift+H)">
            <button
              onClick={addHighlight}
              className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">highlight</span>
            </button>
          </Tooltip>
          <Tooltip label="Change highlight color">
            <button
              onClick={() => setShowHighlightPicker(!showHighlightPicker)}
              className="ml-0.5 w-4 h-4 rounded border border-outline/20 inline-block align-middle"
              style={{ backgroundColor: activeHighlightColor }}
            />
          </Tooltip>
          {showHighlightPicker && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-surface border border-outline/15 rounded-xl shadow-2xl p-1.5 backdrop-blur-xl min-w-[160px]">
              <p className="text-[9px] text-on-surface-variant/50 font-medium px-1.5 pb-1.5 uppercase tracking-wider">Highlight Color</p>
              <div className="flex flex-col gap-0.5">
                {HIGHLIGHT_COLORS.map(color => {
                  const names: Record<string, string> = {
                    '#fef08a': 'Yellow',
                    '#86efac': 'Green',
                    '#93c5fd': 'Blue',
                    '#fca5a5': 'Red',
                    '#d8b4fe': 'Purple',
                    '#fdba74': 'Orange',
                    '#99f6e4': 'Teal',
                    '#f9a8d4': 'Pink',
                  }
                  return (
                    <button
                      key={color}
                      onClick={() => { setActiveHighlightColor(color); setShowHighlightPicker(false) }}
                      className={`flex items-center gap-2.5 w-full px-2 py-1.5 rounded-lg transition-all ${
                        activeHighlightColor === color
                          ? 'bg-primary/10 ring-1 ring-primary/30'
                          : 'hover:bg-on-surface/5'
                      }`}
                    >
                      <span
                        className={`w-4 h-4 rounded-md border transition-all flex-shrink-0 ${activeHighlightColor === color ? 'border-primary/40 scale-110' : 'border-outline/20'}`}
                        style={{ backgroundColor: color }}
                      />
                      <span className="text-xs text-on-surface font-medium">{names[color] || color}</span>
                      {activeHighlightColor === color && (
                        <span className="material-symbols-outlined text-[12px] text-primary ml-auto">check</span>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="w-px h-5 bg-outline/10 mx-1" />

        {/* Undo */}
        <Tooltip label="Undo highlight (Ctrl+Z)">
          <button
            onClick={undoHighlight}
            disabled={highlightHistory.length === 0}
            className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">undo</span>
          </button>
        </Tooltip>

        <div className="w-px h-5 bg-outline/10 mx-1" />

        {/* Page navigation */}
        <div className="flex items-center gap-1">
          <Tooltip label="Previous page (Alt+←)">
            <button onClick={() => goToPage(pageNumber - 1)} disabled={pageNumber <= 1} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
              <span className="material-symbols-outlined text-[14px]">navigate_before</span>
            </button>
          </Tooltip>
          <input
            type="number"
            value={pageNumber}
            onChange={e => goToPage(Number(e.target.value))}
            min={1}
            max={numPages || 1}
            className="w-10 bg-surface/50 border border-outline/20 rounded text-xs text-center text-on-surface outline-none focus:border-primary py-0.5 tabular-nums"
          />
          <span className="text-[11px] text-on-surface-variant/60">/ {numPages}</span>
          <Tooltip label="Next page (Alt+→)">
            <button onClick={() => goToPage(pageNumber + 1)} disabled={pageNumber >= numPages} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
              <span className="material-symbols-outlined text-[14px]">navigate_next</span>
            </button>
          </Tooltip>
        </div>

        <div className="w-px h-5 bg-outline/10 mx-1" />

        {/* Zoom */}
        <Tooltip label="Zoom out (Ctrl+-)">
          <button onClick={zoomOut} disabled={scale <= 0.3} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined text-[14px]">zoom_out</span>
          </button>
        </Tooltip>
        <span className="text-[10px] text-on-surface-variant/60 min-w-[38px] text-center tabular-nums">{Math.round(scale * 100)}%</span>
        <Tooltip label="Zoom in (Ctrl+=)">
          <button onClick={zoomIn} disabled={scale >= 4.0} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-30">
            <span className="material-symbols-outlined text-[14px]">zoom_in</span>
          </button>
        </Tooltip>
        <Tooltip label="Rotate">
          <button onClick={rotateCW} className="p-1 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors">
            <span className="material-symbols-outlined text-[14px]">rotate_right</span>
          </button>
        </Tooltip>
      </div>

      {/* ── Format warning banner ── */}
      {sourceFormat && (
        <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] text-amber-400 mt-0.5 flex-shrink-0">info</span>
          <p className="text-[11px] text-amber-300/80 leading-relaxed">
            This document was converted from <strong className="text-amber-200 uppercase">{sourceFormat}</strong>.
            Some formatting, layout, or images may not perfectly match the original.
            For best results, open the original file in its native application.
          </p>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex min-h-0">
        {/* ── Sidebar ── */}
        {showSidebar && (
          <div className="w-48 flex-shrink-0 border-r border-outline/10 bg-surface/20 overflow-y-auto">
            <div className="flex border-b border-outline/10">
              <button
                onClick={() => setSidebarTab('thumbnails')}
                className={`flex-1 py-2 text-[10px] font-medium text-center transition-colors ${sidebarTab === 'thumbnails' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Pages
              </button>
              <button
                onClick={() => setSidebarTab('highlights')}
                className={`flex-1 py-2 text-[10px] font-medium text-center transition-colors ${sidebarTab === 'highlights' ? 'text-primary border-b-2 border-primary' : 'text-on-surface-variant hover:text-on-surface'}`}
              >
                Highlights
              </button>
            </div>
            <div className="p-2 space-y-1">
              {sidebarTab === 'thumbnails' && (
                Array.from({ length: numPages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => goToPage(p)}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                      pageNumber === p
                        ? 'bg-primary/15 text-primary font-medium'
                        : 'text-on-surface-variant hover:bg-on-surface/10'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[12px]">description</span>
                    Page {p}
                    {highlights.some(h => h.pageNumber === p) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 ml-auto" />
                    )}
                  </button>
                ))
              )}
              {sidebarTab === 'highlights' && (
                highlights.length === 0 ? (
                  <p className="text-[10px] text-on-surface-variant/50 text-center py-4">
                    No highlights yet.<br />
                    Select text and click the highlighter tool.
                  </p>
                ) : (
                  highlights.map(h => (
                    <div key={h.id} className="p-2 rounded-lg bg-surface/30 border border-outline/10 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded flex-shrink-0" style={{ backgroundColor: h.color }} />
                        <button
                          onClick={() => goToPage(h.pageNumber)}
                          className="text-[10px] text-on-surface-variant hover:text-primary transition-colors"
                        >
                          Page {h.pageNumber}
                        </button>
                        <div className="ml-auto flex gap-0.5">
                          <button
                            onClick={() => {
                              setEditingHighlight(h.id)
                              setEditingHighlightNote(h.note || '')
                            }}
                            className="p-0.5 rounded text-on-surface-variant/40 hover:text-primary transition-colors"
                            title="Add note"
                          >
                            <span className="material-symbols-outlined text-[10px]">edit_note</span>
                          </button>
                          <button
                            onClick={() => removeHighlight(h.id)}
                            className="p-0.5 rounded text-on-surface-variant/40 hover:text-error transition-colors"
                          >
                            <span className="material-symbols-outlined text-[10px]">close</span>
                          </button>
                        </div>
                      </div>
                      {h.text && (
                        <p className="text-[9px] text-on-surface-variant/60 line-clamp-2 leading-tight">&ldquo;{h.text}&rdquo;</p>
                      )}
                      {h.note && (
                        <p className="text-[9px] text-on-surface/70 italic mt-0.5">{h.note}</p>
                      )}
                      {editingHighlight === h.id && (
                        <div className="flex gap-1 mt-1">
                          <input
                            type="text"
                            value={editingHighlightNote}
                            onChange={e => setEditingHighlightNote(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') updateHighlightNote(h.id, editingHighlightNote) }}
                            placeholder="Add a note..."
                            className="flex-1 bg-surface/50 border border-outline/20 rounded px-1.5 py-0.5 text-[9px] outline-none"
                            autoFocus
                          />
                          <button onClick={() => updateHighlightNote(h.id, editingHighlightNote)} className="text-[9px] text-primary font-medium px-1">Save</button>
                        </div>
                      )}
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        )}

        {/* ── PDF View ── */}
        <div ref={pageContainerRef} className="flex-1 overflow-y-auto p-4 flex justify-center bg-surface-variant/5">
          <div className="relative">
            <PdfDoc
              file={fileProp}
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center justify-center py-20">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              }
              onLoadError={(err) => console.error('[PdfView] react-pdf load error:', err)}
              error={
                <div className="flex flex-col items-center justify-center py-20 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[36px] mb-2">error_outline</span>
                  <p className="text-sm">Failed to load PDF</p>
                </div>
              }
            >
              <div className="relative shadow-xl rounded-lg overflow-hidden bg-white mb-4" style={{ maxWidth: '100%' }}>
                <Page
                  pageNumber={pageNumber}
                  scale={scale}
                  rotate={rotation}
                  renderTextLayer={true}
                  renderAnnotationLayer={true}
                  className="!bg-white"
                  width={undefined}
                />
                {/* OCR text overlays (invisible selectable text for images) */}
                {ocrWords.length > 0 && (
                  <div className="absolute inset-0 pointer-events-none" style={{ userSelect: 'text' }}>
                    {ocrWords.map((word, i) => (
                      <span
                        key={i}
                        className="ocr-word"
                        style={{
                          position: 'absolute',
                          left: word.x * scale,
                          top: word.y * scale,
                          width: word.w * scale,
                          height: word.h * scale,
                          color: 'transparent',
                          pointerEvents: 'auto',
                          userSelect: 'text',
                          cursor: 'text',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          fontSize: Math.max(word.h * scale * 0.85, 4),
                          fontFamily: 'sans-serif',
                          lineHeight: word.h * scale + 'px',
                        }}
                      >
                        {word.text}
                      </span>
                    ))}
                  </div>
                )}
                {/* Highlights overlay */}
                {currentPageHighlights.map(h => {
                  const ratio = scale / (h.captureScale ?? 1)
                  return (
                    <div key={h.id} className="absolute inset-0 pointer-events-none">
                      {h.rects.map((rect, i) => (
                        <div
                          key={`${h.id}-${i}`}
                          className="absolute pointer-events-auto group cursor-pointer"
                          style={{
                            left: rect.x * ratio,
                            top: rect.y * ratio,
                            width: rect.w * ratio,
                            height: rect.h * ratio,
                            backgroundColor: h.color + '80',
                            borderBottom: `2px solid ${h.color}`,
                            borderRadius: '1px',
                            transition: 'opacity 0.15s',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            // Toggle a popover with color options and note
                          }}
                        >
                          {/* Hover actions */}
                          <div className="absolute -top-6 left-0 hidden group-hover:flex items-center gap-0.5 bg-surface border border-outline/20 rounded-lg shadow-lg px-1 py-0.5 z-10 pointer-events-auto">
                            {HIGHLIGHT_COLORS.slice(0, 5).map(c => (
                              <button
                                key={c}
                                onClick={(e) => { e.stopPropagation(); changeHighlightColor(h.id, c) }}
                                className={`w-3 h-3 rounded-sm ${h.color === c ? 'ring-1 ring-primary' : ''}`}
                                style={{ backgroundColor: c }}
                              />
                            ))}
                            <div className="w-px h-3 bg-outline/10 mx-0.5" />
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setEditingHighlight(h.id)
                                setEditingHighlightNote(h.note || '')
                              }}
                              className="p-0.5 rounded text-on-surface-variant hover:text-primary"
                            >
                              <span className="material-symbols-outlined text-[10px]">edit_note</span>
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); removeHighlight(h.id) }}
                              className="p-0.5 rounded text-on-surface-variant hover:text-error"
                            >
                              <span className="material-symbols-outlined text-[10px]">close</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })}
              </div>
            </PdfDoc>
          </div>
        </div>
      </div>

      {/* ── Status bar ── */}
      <div className="flex items-center justify-between px-3 py-1 bg-surface/40 border-t border-outline/10 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-on-surface-variant/50">{pdfFile.originalName}</span>
          <span className="text-[10px] text-on-surface-variant/30">{timeAgo(pdfFile.addedAt)}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-on-surface-variant/50">{highlights.length} highlight{highlights.length !== 1 ? 's' : ''}</span>
          <span className="text-[10px] text-on-surface-variant/50">{Math.round(scale * 100)}%</span>
        </div>
      </div>
    </div>
  )
}
