import { useState, useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'

/* ═══════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════ */

interface Point { x: number; y: number }

type Tool = 'select' | 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text'

interface Stroke {
  id: string
  type: 'pen' | 'eraser' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'text'
  points: Point[]
  color: string
  width: number
  completed: boolean
  filled?: boolean
  text?: string
  fontSize?: number
}

/* ═══════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════ */

const COLORS = [
  '#000000', '#ffffff', '#ff4444', '#ff8800', '#ffdd00',
  '#44cc44', '#4488ff', '#8844ff', '#ff44cc',
]

const WIDTHS = [
  { value: 2, label: 'XS' },
  { value: 4, label: 'S' },
  { value: 8, label: 'M' },
  { value: 16, label: 'L' },
  { value: 30, label: 'XL' },
]

const MIN_WIDTH = 1
const MAX_WIDTH = 40

const TOOLS: { id: Tool; icon: string; label: string; shortcut: string }[] = [
  { id: 'select',    icon: 'pan_tool',      label: 'Select',    shortcut: 'V' },
  { id: 'pen',       icon: 'gesture',        label: 'Pen',       shortcut: 'P' },
  { id: 'eraser',    icon: 'auto_fix_off',   label: 'Eraser',   shortcut: 'E' },
  { id: 'rectangle', icon: 'crop_square',    label: 'Rectangle', shortcut: 'R' },
  { id: 'circle',    icon: 'circle',         label: 'Circle',    shortcut: 'C' },
  { id: 'line',      icon: 'show_chart',     label: 'Line',      shortcut: 'L' },
  { id: 'arrow',     icon: 'arrow_forward',  label: 'Arrow',     shortcut: 'A' },
  { id: 'text',      icon: 'text_fields',    label: 'Text',      shortcut: 'T' },
]

const COLOR_NAMES = ['Black', 'White', 'Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Pink']

const MIN_SCALE = 0.1
const MAX_SCALE = 5
const HIT_PADDING = 8

/* ═══════════════════════════════════════════════
   Drawing Utilities
   ═══════════════════════════════════════════════ */

function getStrokeId() {
  return `stroke_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  const pts = stroke.points
  if (pts.length < 2) {
    if (pts.length === 1) {
      if (stroke.type === 'text') {
        ctx.font = `${stroke.fontSize || 20}px Inter, system-ui, sans-serif`
        ctx.fillStyle = stroke.color
        ctx.textBaseline = 'top'
        ctx.fillText(stroke.text || '', pts[0].x, pts[0].y)
      } else {
        ctx.beginPath()
        ctx.arc(pts[0].x, pts[0].y, stroke.width / 2, 0, Math.PI * 2)
        ctx.fillStyle = stroke.color
        ctx.fill()
      }
    }
    return
  }

  if (stroke.type === 'pen' || stroke.type === 'eraser') {
    ctx.beginPath()
    ctx.moveTo(pts[0].x, pts[0].y)
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y)
    }
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (stroke.type === 'eraser') {
      ctx.strokeStyle = '#1a1a2e'
      ctx.lineWidth = stroke.width
      ctx.globalCompositeOperation = 'destination-out'
      ctx.stroke()
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.strokeStyle = stroke.color
      ctx.stroke()
    }
  } else if (stroke.type === 'rectangle') {
    const x = Math.min(pts[0].x, pts[pts.length - 1].x)
    const y = Math.min(pts[0].y, pts[pts.length - 1].y)
    const w = Math.abs(pts[pts.length - 1].x - pts[0].x)
    const h = Math.abs(pts[pts.length - 1].y - pts[0].y)
    ctx.lineWidth = stroke.width
    ctx.strokeStyle = stroke.color

    if (stroke.filled) {
      ctx.fillStyle = stroke.color + '30'
      ctx.fillRect(x, y, w, h)
    }
    ctx.strokeRect(x, y, w, h)
  } else if (stroke.type === 'circle') {
    const x1 = pts[0].x
    const y1 = pts[0].y
    const x2 = pts[pts.length - 1].x
    const y2 = pts[pts.length - 1].y
    const radius = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2)
    ctx.beginPath()
    ctx.arc(x1, y1, radius, 0, Math.PI * 2)
    ctx.lineWidth = stroke.width
    ctx.strokeStyle = stroke.color

    if (stroke.filled) {
      ctx.fillStyle = stroke.color + '30'
      ctx.fill()
    }
    ctx.stroke()
  } else if (stroke.type === 'line' || stroke.type === 'arrow') {
    const sx = pts[0].x
    const sy = pts[0].y
    const ex = pts[pts.length - 1].x
    const ey = pts[pts.length - 1].y

    ctx.beginPath()
    ctx.moveTo(sx, sy)
    ctx.lineTo(ex, ey)
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.stroke()

    if (stroke.type === 'arrow') {
      const angle = Math.atan2(ey - sy, ex - sx)
      const headLen = Math.max(12, stroke.width * 3)
      ctx.beginPath()
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex - headLen * Math.cos(angle - Math.PI / 6),
        ey - headLen * Math.sin(angle - Math.PI / 6)
      )
      ctx.moveTo(ex, ey)
      ctx.lineTo(
        ex - headLen * Math.cos(angle + Math.PI / 6),
        ey - headLen * Math.sin(angle + Math.PI / 6)
      )
      ctx.stroke()
    }  } else if (stroke.type === 'text') {
    ctx.font = `${stroke.fontSize || 20}px Inter, system-ui, sans-serif`
    ctx.fillStyle = stroke.color
    ctx.textBaseline = 'top'
    ctx.fillText(stroke.text || '', pts[0].x, pts[0].y)
  }
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, isDark: boolean, scale: number) {
  const gridColor = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'
  ctx.strokeStyle = gridColor
  ctx.lineWidth = 1 / scale
  const gridSize = 20
  for (let x = 0; x < width; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = 0; y < height; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }
}

function getStrokeBounds(stroke: Stroke): { x: number; y: number; w: number; h: number } | null {
  if (stroke.points.length === 0) return null
  if (stroke.type === 'text' && stroke.points.length === 1) {
    return { x: stroke.points[0].x - 4, y: stroke.points[0].y - 4, w: 200, h: (stroke.fontSize || 20) + 8 }
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const p of stroke.points) {
    if (p.x < minX) minX = p.x
    if (p.y < minY) minY = p.y
    if (p.x > maxX) maxX = p.x
    if (p.y > maxY) maxY = p.y
  }
  const pad = stroke.width / 2 + HIT_PADDING
  return { x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 }
}

function hitTestStroke(point: Point, stroke: Stroke): boolean {
  if (stroke.type === 'text' && stroke.points.length === 1) {
    const fontSize = stroke.fontSize || 20
    const textWidth = (stroke.text?.length || 1) * fontSize * 0.6
    const bx = stroke.points[0].x - 4
    const by = stroke.points[0].y - 4
    if (point.x >= bx && point.x <= bx + textWidth + 8 &&
        point.y >= by && point.y <= by + fontSize + 8) return true
    return false
  }

  const pts = stroke.points
  // Check distance to bounding box of all points
  let minDist = Infinity
  for (const p of pts) {
    const d = Math.sqrt((point.x - p.x) ** 2 + (point.y - p.y) ** 2)
    if (d < minDist) minDist = d
  }
  // Check distance to segments for pen/eraser
  if (stroke.type === 'pen' || stroke.type === 'eraser') {
    for (let i = 1; i < pts.length; i++) {
      const dist = distToSegment(point, pts[i - 1], pts[i])
      if (dist < minDist) minDist = dist
    }
    return minDist < stroke.width + HIT_PADDING
  }

  // For shapes, check bounding box
  if (pts.length < 2) return minDist < HIT_PADDING * 2
  const bounds = getStrokeBounds(stroke)
  if (!bounds) return false
  return (
    point.x >= bounds.x && point.x <= bounds.x + bounds.w &&
    point.y >= bounds.y && point.y <= bounds.y + bounds.h
  )
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const projX = a.x + t * dx
  const projY = a.y + t * dy
  return Math.sqrt((p.x - projX) ** 2 + (p.y - projY) ** 2)
}

/** Check if a single point is covered by the eraser's sweep (accounting for point's own stroke width) */
function isPointErasedByEraser(
  point: Point,
  eraserPoints: Point[],
  eraserWidth: number,
  strokeWidth: number
): boolean {
  const threshold = (eraserWidth + strokeWidth) / 2
  for (const ep of eraserPoints) {
    if (Math.sqrt((point.x - ep.x) ** 2 + (point.y - ep.y) ** 2) < threshold) return true
  }
  for (let i = 1; i < eraserPoints.length; i++) {
    if (distToSegment(point, eraserPoints[i - 1], eraserPoints[i]) < threshold) return true
  }
  return false
}

/**
 * Split a pen stroke at erased regions, keeping only the non-erased portions.
 *
 * - Iterates each point — if it falls within the eraser brush it is dropped
 *   (sealing the current run as a sub-stroke).
 * - When the eraser crosses a segment between two non-erased points, the split
 *   creates a natural gap. The exposed ends are automatically rounded by the
 *   canvas lineCap: 'round' render style.
 *
 * Returns an array of sub-strokes (each gets a fresh ID).
 */
function splitErasedStroke(stroke: Stroke, eraserPoints: Point[], eraserWidth: number): Stroke[] {
  const result: Stroke[] = []
  let currentRun: Point[] = []
  const pts = stroke.points
  const strokeWidth = stroke.width

  for (let i = 0; i < pts.length; i++) {
    const pt = pts[i]
    const isErased = isPointErasedByEraser(pt, eraserPoints, eraserWidth, strokeWidth)

    if (isErased) {
      // Point is covered by eraser — seal current run
      if (currentRun.length > 0) {
        result.push({ ...stroke, id: getStrokeId(), points: [...currentRun] })
        currentRun = []
      }
    } else {
      currentRun.push({ ...pt })
    }

    // Check if the segment to the next point is crossed by the eraser
    // (catches eraser passes between recorded points)
    if (i < pts.length - 1 && !isErased) {
      const mid = {
        x: (pt.x + pts[i + 1].x) / 2,
        y: (pt.y + pts[i + 1].y) / 2,
      }
      if (isPointErasedByEraser(mid, eraserPoints, eraserWidth, strokeWidth)) {
        // Eraser crosses this segment — split here. The gap between the
        // current run's last point and the next point IS the erased area.
        if (currentRun.length > 0) {
          result.push({ ...stroke, id: getStrokeId(), points: [...currentRun] })
          currentRun = []
        }
      }
    }
  }

  if (currentRun.length > 0) {
    result.push({ ...stroke, id: getStrokeId(), points: [...currentRun] })
  }

  return result
}

/** Check whether any part of a stroke overlaps the eraser brush sweep.
 *  Uses precise distance-to-geometry tests (never bounding boxes) so the
 *  eraser only deletes what it actually touches.
 *  - Pen/eraser: point-to-point + point-to-segment in both directions
 *  - Line/arrow: distance from eraser to the single segment
 *  - Rectangle: distance from eraser to each of the 4 edges
 *  - Circle: distance from eraser to the circumference
 *  - Text: expanded text-rect (acceptable since text is a filled area)
 */
function eraserHits(eraserPoints: Point[], eraserWidth: number, stroke: Stroke): boolean {
  const threshold = (eraserWidth + stroke.width) / 2
  const pts = stroke.points
  if (pts.length === 0) return false

  // ── Text: check expanded bounds ──
  if (stroke.type === 'text' && pts.length === 1) {
    const fontSize = stroke.fontSize || 20
    const textWidth = (stroke.text?.length || 1) * fontSize * 0.6
    const bx = pts[0].x - 4
    const by = pts[0].y - 4
    const bw = textWidth + 8
    const bh = fontSize + 8
    for (const ep of eraserPoints) {
      if (ep.x >= bx - threshold && ep.x <= bx + bw + threshold &&
          ep.y >= by - threshold && ep.y <= by + bh + threshold) return true
    }
    return false
  }

  // ── Line / Arrow: distance to the single segment ──
  if (stroke.type === 'line' || stroke.type === 'arrow') {
    const a = pts[0]
    const b = pts[pts.length - 1]
    for (const ep of eraserPoints) {
      if (distToSegment(ep, a, b) < threshold) return true
    }
    // Also check segment endpoints against eraser sweep (catches fast drags)
    for (let i = 1; i < eraserPoints.length; i++) {
      if (distToSegment(a, eraserPoints[i - 1], eraserPoints[i]) < threshold) return true
      if (distToSegment(b, eraserPoints[i - 1], eraserPoints[i]) < threshold) return true
    }
    return false
  }

  // ── Rectangle: distance to each of the 4 edges ──
  if (stroke.type === 'rectangle') {
    const x1 = Math.min(pts[0].x, pts[pts.length - 1].x)
    const y1 = Math.min(pts[0].y, pts[pts.length - 1].y)
    const x2 = Math.max(pts[0].x, pts[pts.length - 1].x)
    const y2 = Math.max(pts[0].y, pts[pts.length - 1].y)
    const edges: [Point, Point][] = [
      [{ x: x1, y: y1 }, { x: x2, y: y1 }], // top
      [{ x: x2, y: y1 }, { x: x2, y: y2 }], // right
      [{ x: x1, y: y2 }, { x: x2, y: y2 }], // bottom
      [{ x: x1, y: y1 }, { x: x1, y: y2 }], // left
    ]
    for (const ep of eraserPoints) {
      for (const [a, b] of edges) {
        if (distToSegment(ep, a, b) < threshold) return true
      }
    }
    // Corner points against eraser segments
    for (let i = 1; i < eraserPoints.length; i++) {
      for (const c of [{ x: x1, y: y1 }, { x: x2, y: y1 }, { x: x1, y: y2 }, { x: x2, y: y2 }]) {
        if (distToSegment(c, eraserPoints[i - 1], eraserPoints[i]) < threshold) return true
      }
    }
    // Filled: any eraser point inside the rectangle counts
    if (stroke.filled) {
      for (const ep of eraserPoints) {
        if (ep.x >= x1 - threshold && ep.x <= x2 + threshold &&
            ep.y >= y1 - threshold && ep.y <= y2 + threshold) return true
      }
    }
    return false
  }

  // ── Circle: distance to circumference ──
  if (stroke.type === 'circle') {
    const cx = pts[0].x
    const cy = pts[0].y
    const radius = Math.sqrt((pts[pts.length - 1].x - cx) ** 2 + (pts[pts.length - 1].y - cy) ** 2)
    for (const ep of eraserPoints) {
      const dist = Math.sqrt((ep.x - cx) ** 2 + (ep.y - cy) ** 2)
      if (Math.abs(dist - radius) < threshold) return true
      // Filled: eraser point inside the circle counts
      if (stroke.filled && dist < radius + threshold) return true
    }
    return false
  }

  // ── Pen / Eraser: point-to-point + point-to-segment ──
  for (const ep of eraserPoints) {
    for (const p of pts) {
      if (Math.sqrt((ep.x - p.x) ** 2 + (ep.y - p.y) ** 2) < threshold) return true
    }
    for (let i = 1; i < pts.length; i++) {
      if (distToSegment(ep, pts[i - 1], pts[i]) < threshold) return true
    }
  }
  // Stroke points against eraser segments (catches eraser passing between its own recorded points)
  for (let i = 1; i < eraserPoints.length; i++) {
    for (const p of pts) {
      if (distToSegment(p, eraserPoints[i - 1], eraserPoints[i]) < threshold) return true
    }
  }

  return false
}

/* ═══════════════════════════════════════════════
   CanvasView Component
   ═══════════════════════════════════════════════ */

export function CanvasView() {
  const { activePageId, pages, updatePageContent } = useProjectStore()

  // Canvas refs
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const textAreaRef = useRef<HTMLTextAreaElement>(null)

  // Strokes
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Transform (zoom & pan)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 })
  const [spaceHeld, setSpaceHeld] = useState(false)
  const spaceHeldRef = useRef(false)
  const isPanningRef = useRef(false)
  const panStartRef = useRef<{ screenX: number; screenY: number; tx: number; ty: number } | null>(null)

  // Tool state
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(() =>
    document.documentElement.classList.contains('dark') ? '#ffffff' : '#000000'
  )
  const [width, setWidth] = useState(4)       // drawing tools (pen, shapes)
  const [eraserWidth, setEraserWidth] = useState(4)  // eraser (independent)
  const [filled, setFilled] = useState(false)

  // Active width reflects the currently relevant control based on tool
  const activeWidth = tool === 'eraser' ? eraserWidth : width
  const setActiveWidth = useCallback((v: number | ((prev: number) => number)) => {
    if (tool === 'eraser') {
      setEraserWidth(v as number)
    } else {
      setWidth(v as number)
    }
  }, [tool])

  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const dragStrokeRef = useRef<{
    stroke: Stroke
    startPos: Point
    originalPoints: Point[]
  } | null>(null)

  // Cursor position (for eraser preview)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null)

  // Text tool
  const [textPlacementPos, setTextPlacementPos] = useState<Point | null>(null)
  const [textDraft, setTextDraft] = useState('')

  // Undo / Redo
  const [undoStack, setUndoStack] = useState<Stroke[][]>([])
  const [redoStack, setRedoStack] = useState<Stroke[][]>([])
  const undoInProgressRef = useRef(false)
  const strokesRef = useRef<Stroke[]>([])
  strokesRef.current = strokes

  // Canvas size & theme
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 })
  const [isDark, setIsDark] = useState(true)
  const initializedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activePage = pages.find(p => p.id === activePageId)

  /* ── Resize observer ── */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect
        setCanvasSize({ w: Math.floor(w), h: Math.floor(h) })
      }
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  /* ── Reset when switching pages ── */
  useEffect(() => {
    initializedRef.current = false
    setStrokes([])
    setCurrentStroke(null)
    setSelectedId(null)
    setTextPlacementPos(null)
    setUndoStack([])
    setRedoStack([])
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [activePageId])

  /* ── Load saved strokes ── */
  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content) && !initializedRef.current) {
      setStrokes(activePage.content as Stroke[])
      initializedRef.current = true
    } else if (!activePage?.content) {
      initializedRef.current = true
    }
  }, [activePage?.id])

  /* ── Dark mode detection — auto-switch brush color ── */
  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains('dark')
    setIsDark(isDarkMode)
    setColor(isDarkMode ? '#ffffff' : '#000000')
    const observer = new MutationObserver(() => {
      const dark = document.documentElement.classList.contains('dark')
      setIsDark(dark)
      setColor(dark ? '#ffffff' : '#000000')
    })
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  /* ── Redraw ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h)

    // Apply transform
    ctx.save()
    ctx.translate(transform.x, transform.y)
    ctx.scale(transform.scale, transform.scale)

    // Grid
    drawGrid(ctx, canvasSize.w, canvasSize.h, isDark, transform.scale)

    // Completed strokes
    for (const s of strokes) {
      if (!s.completed) continue
      drawStroke(ctx, s)
    }

    // Selection indicator
    if (selectedId) {
      const selStroke = strokes.find(s => s.id === selectedId && s.completed)
      if (selStroke) {
        const bounds = getStrokeBounds(selStroke)
        if (bounds) {
          ctx.strokeStyle = '#4488ff'
          ctx.lineWidth = 2 / transform.scale
          ctx.setLineDash([6 / transform.scale, 4 / transform.scale])
          ctx.strokeRect(bounds.x - 4, bounds.y - 4, bounds.w + 8, bounds.h + 8)
          ctx.setLineDash([])

          // Corner handles
          const handleSize = 8 / transform.scale
          const handles = [
            { x: bounds.x - 4, y: bounds.y - 4 },
            { x: bounds.x + bounds.w + 4, y: bounds.y - 4 },
            { x: bounds.x - 4, y: bounds.y + bounds.h + 4 },
            { x: bounds.x + bounds.w + 4, y: bounds.y + bounds.h + 4 },
          ]
          ctx.fillStyle = '#4488ff'
          for (const h of handles) {
            ctx.fillRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
            ctx.strokeStyle = '#ffffff'
            ctx.lineWidth = 1.5 / transform.scale
            ctx.strokeRect(h.x - handleSize / 2, h.y - handleSize / 2, handleSize, handleSize)
          }
        }
      }
    }

    // Current stroke (being drawn)
    if (currentStroke) drawStroke(ctx, currentStroke)

    ctx.restore()
  }, [strokes, currentStroke, canvasSize, color, width, isDark, transform, selectedId])

  /* ── Auto-save ── */
  const saveStrokes = useCallback((s: Stroke[]) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      if (activePageId) {
        updatePageContent(activePageId, s.filter(st => st.completed))
      }
    }, 500)
  }, [activePageId, updatePageContent])

  /* ── Coordinate conversion ── */
  const screenToCanvas = useCallback((clientX: number, clientY: number): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left - transform.x) / transform.scale,
      y: (clientY - rect.top - transform.y) / transform.scale,
    }
  }, [transform])

  /* ── Push undo snapshot ── */
  const pushUndo = useCallback((currentStrokes: Stroke[]) => {
    if (undoInProgressRef.current) return
    setUndoStack(prev => [...prev, currentStrokes.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }))])
    setRedoStack([])
  }, [])

  /* ── Undo / Redo ── */
  const handleUndo = useCallback(() => {
    setUndoStack(prev => {
      if (prev.length === 0) return prev
      const newUndo = prev.slice(0, -1)
      const snapshot = prev[prev.length - 1]
      const currentCompleted = strokesRef.current.filter(s => s.completed)
      const currentInProgress = strokesRef.current.filter(s => !s.completed)
      setRedoStack(r => [...r, currentCompleted.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }))])
      undoInProgressRef.current = true
      setStrokes([...currentInProgress, ...snapshot])
      setSelectedId(null)
      saveStrokes([...currentInProgress, ...snapshot])
      queueMicrotask(() => { undoInProgressRef.current = false })
      return newUndo
    })
  }, [saveStrokes])

  const handleRedo = useCallback(() => {
    setRedoStack(prev => {
      if (prev.length === 0) return prev
      const newRedo = prev.slice(0, -1)
      const snapshot = prev[prev.length - 1]
      const currentCompleted = strokesRef.current.filter(s => s.completed)
      const currentInProgress = strokesRef.current.filter(s => !s.completed)
      setUndoStack(u => [...u, currentCompleted.map(s => ({ ...s, points: s.points.map(p => ({ ...p })) }))])
      undoInProgressRef.current = true
      setStrokes([...currentInProgress, ...snapshot])
      setSelectedId(null)
      saveStrokes([...currentInProgress, ...snapshot])
      queueMicrotask(() => { undoInProgressRef.current = false })
      return newRedo
    })
  }, [saveStrokes])

  /* ── Delete selected ── */
  const handleDeleteSelected = useCallback(() => {
    if (!selectedId) return
    pushUndo(strokes.filter(s => s.completed))
    const newStrokes = strokes.filter(s => s.id !== selectedId)
    setStrokes(newStrokes)
    setSelectedId(null)
    saveStrokes(newStrokes)
  }, [selectedId, strokes, pushUndo, saveStrokes])

  /* ── Clear all ── */
  const handleClear = useCallback(() => {
    const completed = strokes.filter(s => s.completed)
    if (completed.length === 0) return
    pushUndo(completed)
    setStrokes(strokes.filter(s => !s.completed))
    setCurrentStroke(null)
    setSelectedId(null)
    saveStrokes([])
  }, [strokes, pushUndo, saveStrokes])

  /* ── Export ── */
  const handleExport = useCallback(() => {
    const completed = strokes.filter(s => s.completed)
    if (completed.length === 0) return

    // Find the bounding box of all completed strokes
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    let maxStrokeWidth = 0
    for (const s of completed) {
      for (const p of s.points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
      if (s.width > maxStrokeWidth) maxStrokeWidth = s.width
    }
    // Account for the widest stroke (half-width on each side of path)
    const halfWidthPad = Math.ceil(maxStrokeWidth / 2)
    minX -= halfWidthPad
    minY -= halfWidthPad
    maxX += halfWidthPad
    maxY += halfWidthPad

    // Add padding around bounds
    const padding = 40
    const x = Math.floor(minX - padding)
    const y = Math.floor(minY - padding)
    const w = Math.ceil(maxX - minX + padding * 2)
    const h = Math.ceil(maxY - minY + padding * 2)

    // Create offscreen canvas at 1:1 scale
    const offscreen = document.createElement('canvas')
    offscreen.width = w
    offscreen.height = h
    const ctx = offscreen.getContext('2d')
    if (!ctx) return

    // Fill with background matching the theme
    ctx.fillStyle = isDark ? '#1a1a2e' : '#ffffff'
    ctx.fillRect(0, 0, w, h)

    // Translate so strokes appear at correct position
    ctx.translate(-x, -y)

    // Draw all completed strokes (no grid, no transform — clean export)
    for (const s of completed) {
      drawStroke(ctx, s)
    }

    const link = document.createElement('a')
    link.download = `${activePage?.title || 'canvas'}.png`
    link.href = offscreen.toDataURL('image/png')
    link.click()
  }, [activePage, strokes, isDark])

  /* ── Commit text ── */
  const commitText = useCallback(() => {
    if (!textPlacementPos || !textDraft.trim()) {
      setTextPlacementPos(null)
      setTextDraft('')
      return
    }
    const completedStrokes = strokes.filter(s => s.completed)
    pushUndo(completedStrokes)
    const newTextStroke: Stroke = {
      id: getStrokeId(),
      type: 'text',
      points: [{ ...textPlacementPos }],
      color,
      width: 1,
      completed: true,
      text: textDraft.trim(),
      fontSize: 20,
    }
    const allStrokes = [...completedStrokes, newTextStroke, ...strokes.filter(s => !s.completed)]
    setStrokes(allStrokes)
    setTextPlacementPos(null)
    setTextDraft('')
    setTool('select')
    setSelectedId(newTextStroke.id)
    saveStrokes(allStrokes)
  }, [textPlacementPos, textDraft, strokes, pushUndo, color, saveStrokes])

  /* ── Keyboard shortcuts ── */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for panning
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault()
        spaceHeldRef.current = true
        setSpaceHeld(true)
        return
      }

      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return

      // Delete selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (textPlacementPos) {
          setTextPlacementPos(null)
          setTextDraft('')
          return
        }
        handleDeleteSelected()
        return
      }

      // Escape — deselect / cancel text
      if (e.key === 'Escape') {
        if (textPlacementPos) {
          commitText()
          return
        }
        setSelectedId(null)
        return
      }

      // Undo/Redo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        handleUndo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        handleRedo()
        return
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        handleRedo()
        return
      }

      // Tool shortcuts
      const toolMap: Record<string, Tool> = {
        v: 'select', V: 'select',
        p: 'pen', P: 'pen',
        e: 'eraser', E: 'eraser',
        r: 'rectangle', R: 'rectangle',
        c: 'circle', C: 'circle',
        l: 'line', L: 'line',
        a: 'arrow', A: 'arrow',
        t: 'text', T: 'text',
      }
      // Width shortcuts [ ] — decrease/increase active width
      if (e.key === '[' || e.key === ']') {
        e.preventDefault()
        const setter = tool === 'eraser' ? setEraserWidth : setWidth
        setter((prev: number) => {
          const step = e.shiftKey ? 5 : 1
          return e.key === '['
            ? Math.max(MIN_WIDTH, prev - step)
            : Math.min(MAX_WIDTH, prev + step)
        })
        return
      }

      if (toolMap[e.key]) {
        // If in text placement mode, commit before switching
        if (textPlacementPos) commitText()
        setTool(toolMap[e.key])
        if (toolMap[e.key] !== 'select') setSelectedId(null)
        return
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        spaceHeldRef.current = false
        if (isPanningRef.current) return
        setSpaceHeld(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [handleUndo, handleRedo, handleDeleteSelected, commitText, textPlacementPos, tool])

  /* ── Wheel zoom ── */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? 0.92 : 1.08
      const rect = containerRef.current?.getBoundingClientRect()
      if (!rect) return
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      setTransform(prev => {
        const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, prev.scale * delta))
        const cursorCanvasX = (cursorX - prev.x) / prev.scale
        const cursorCanvasY = (cursorY - prev.y) / prev.scale
        return { scale: newScale, x: cursorX - cursorCanvasX * newScale, y: cursorY - cursorCanvasY * newScale }
      })
    }
  }, [])

  /* ── Zoom controls ── */
  const zoomIn = useCallback(() => {
    setTransform(t => {
      const newScale = Math.min(MAX_SCALE, t.scale * 1.3)
      const cx = canvasSize.w / 2
      const cy = canvasSize.h / 2
      const canvasX = (cx - t.x) / t.scale
      const canvasY = (cy - t.y) / t.scale
      return { scale: newScale, x: cx - canvasX * newScale, y: cy - canvasY * newScale }
    })
  }, [canvasSize])

  const zoomOut = useCallback(() => {
    setTransform(t => {
      const newScale = Math.max(MIN_SCALE, t.scale / 1.3)
      const cx = canvasSize.w / 2
      const cy = canvasSize.h / 2
      const canvasX = (cx - t.x) / t.scale
      const canvasY = (cy - t.y) / t.scale
      return { scale: newScale, x: cx - canvasX * newScale, y: cy - canvasY * newScale }
    })
  }, [canvasSize])

  const zoomReset = useCallback(() => {
    setTransform({ x: 0, y: 0, scale: 1 })
  }, [])

  /* ── Pointer handlers ── */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) {
      // Middle mouse button pan
      if (e.button === 1) {
        e.preventDefault()
        isPanningRef.current = true
        panStartRef.current = { screenX: e.clientX, screenY: e.clientY, tx: transform.x, ty: transform.y }
        const canvas = canvasRef.current
        if (canvas) canvas.setPointerCapture(e.pointerId)
        return
      }
      return
    }
    e.preventDefault()
    e.stopPropagation()

    // Space+drag = pan
    if (spaceHeldRef.current) {
      isPanningRef.current = true
      panStartRef.current = { screenX: e.clientX, screenY: e.clientY, tx: transform.x, ty: transform.y }
      const canvas = canvasRef.current
      if (canvas) canvas.setPointerCapture(e.pointerId)
      return
    }

    // If in text placement mode, commit text first
    if (textPlacementPos) {
      commitText()
      return
    }

    const canvas = canvasRef.current
    if (canvas) canvas.setPointerCapture(e.pointerId)
    const pos = screenToCanvas(e.clientX, e.clientY)

    if (tool === 'select') {
      // Hit test — iterate in reverse order (topmost first)
      const completed = strokes.filter(s => s.completed)
      let hitId: string | null = null
      for (let i = completed.length - 1; i >= 0; i--) {
        if (hitTestStroke(pos, completed[i])) {
          hitId = completed[i].id
          break
        }
      }
      if (hitId) {
        const hitStroke = completed.find(s => s.id === hitId)!
        setSelectedId(hitId)
        dragStrokeRef.current = {
          stroke: hitStroke,
          startPos: pos,
          originalPoints: hitStroke.points.map(p => ({ ...p })),
        }
      } else {
        setSelectedId(null)
      }
      return
    }

    // Text tool
    if (tool === 'text') {
      setTextPlacementPos(pos)
      setTextDraft('')
      setTimeout(() => textAreaRef.current?.focus(), 10)
      return
    }

    // Drawing tools
    setSelectedId(null)
    const newStroke: Stroke = {
      id: getStrokeId(),
      type: tool === 'eraser' ? 'eraser' : (tool as Stroke['type']),
      points: [pos],
      color: tool === 'eraser' ? '#1a1a2e' : color,
      width: tool === 'eraser' ? eraserWidth * 2.5 : width,
      completed: false,
      filled: (tool === 'rectangle' || tool === 'circle') ? filled : undefined,
    }
    setCurrentStroke(newStroke)
    setIsDrawing(true)
  }, [tool, color, width, filled, screenToCanvas, strokes, textPlacementPos, commitText, transform])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    // Track cursor position for brush/eraser size preview
    if (containerRef.current && tool !== 'select' && tool !== 'text') {
      const rect = containerRef.current.getBoundingClientRect()
      setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top })
    }

    // Panning
    if (isPanningRef.current && panStartRef.current) {
      e.preventDefault()
      const dx = e.clientX - panStartRef.current.screenX
      const dy = e.clientY - panStartRef.current.screenY
      setTransform({
        ...transform,
        x: panStartRef.current.tx + dx,
        y: panStartRef.current.ty + dy,
      })
      return
    }

    // Drag-move selected stroke
    if (tool === 'select' && dragStrokeRef.current) {
      e.preventDefault()
      const pos = screenToCanvas(e.clientX, e.clientY)
      const dx = pos.x - dragStrokeRef.current.startPos.x
      const dy = pos.y - dragStrokeRef.current.startPos.y
      const original = dragStrokeRef.current.originalPoints
      const movedPoints = original.map(p => ({ x: p.x + dx, y: p.y + dy }))
      setStrokes(prev => prev.map(s =>
        s.id === dragStrokeRef.current!.stroke.id
          ? { ...s, points: movedPoints }
          : s
      ))
      return
    }

    // Drawing
    if (!isDrawing || !currentStroke) return
    e.preventDefault()
    const pos = screenToCanvas(e.clientX, e.clientY)
    setCurrentStroke(prev => prev ? { ...prev, points: [...prev.points, pos] } : null)
  }, [isDrawing, currentStroke, tool, screenToCanvas, transform])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    // Stop panning
    if (isPanningRef.current) {
      isPanningRef.current = false
      panStartRef.current = null
      setSpaceHeld(false)
      return
    }

    // Stop drag-move
    if (tool === 'select' && dragStrokeRef.current) {
      const pos = screenToCanvas(e.clientX, e.clientY)
      const dx = pos.x - dragStrokeRef.current.startPos.x
      const dy = pos.y - dragStrokeRef.current.startPos.y
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        pushUndo(strokes.filter(s => s.completed))
        saveStrokes(strokes)
      }
      dragStrokeRef.current = null
      return
    }

    // Finish drawing
    if (!isDrawing || !currentStroke) return
    e.preventDefault()
    e.stopPropagation()

    // Eraser: remove only the overlapped portion of pen strokes; delete shapes/text entirely
    if (currentStroke.type === 'eraser' && currentStroke.points.length > 0) {
      const completedStrokes = strokes.filter(s => s.completed)
      const eraserPoints = currentStroke.points
      const effectiveWidth = currentStroke.width
      const newCompleted: Stroke[] = []
      let hadChanges = false

      for (const s of completedStrokes) {
        if (!eraserHits(eraserPoints, effectiveWidth, s)) {
          // No overlap — keep as-is
          newCompleted.push(s)
        } else {
          // Overlap — handle based on stroke type
          hadChanges = true
          if (s.type === 'pen') {
            const subStrokes = splitErasedStroke(s, eraserPoints, effectiveWidth)
            newCompleted.push(...subStrokes)
            // If subStrokes is empty, all points were erased — stroke disappears
          }
          // Shapes/text: not added back — fully erased (can't partially erase)
        }
      }

      if (hadChanges) {
        pushUndo(completedStrokes)
        const keptStrokes = [...newCompleted, ...strokes.filter(s => !s.completed)]
        setStrokes(keptStrokes)
        saveStrokes(keptStrokes)
      }
      setCurrentStroke(null)
      setIsDrawing(false)
      setCursorPos(null)
      return
    }

    const completed: Stroke = { ...currentStroke, completed: true }
    const completedStrokes = strokes.filter(s => s.completed)
    pushUndo(completedStrokes)
    const newStrokes = [...completedStrokes, completed, ...strokes.filter(s => !s.completed)]
    setStrokes(newStrokes)
    setCurrentStroke(null)
    setIsDrawing(false)
    saveStrokes(newStrokes)
  }, [isDrawing, currentStroke, strokes, tool, pushUndo, saveStrokes, screenToCanvas])

  /* ── Prevent context menu ── */
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
  }, [])

  /* ═══════════════════════════════════════════════
     Render
     ═══════════════════════════════════════════════ */

  return (
    <div className="flex flex-col h-full w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 bg-surface border border-outline/10 rounded-xl rounded-b-none shadow-sm flex-wrap">
        {/* Tools */}
        <div className="flex items-center gap-0.5">
          {TOOLS.map(t => (
            <Tooltip key={t.id} label={`${t.label} (${t.shortcut})`} position="bottom">
            <button
              onClick={() => {
                if (textPlacementPos) commitText()
                setTool(t.id)
                if (t.id !== 'select') setSelectedId(null)
              }}
              className={`p-1.5 rounded-lg transition-colors ${
                tool === t.id
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{t.icon}</span>
            </button>
            </Tooltip>
          ))}
        </div>

        <div className="w-px h-6 bg-outline/10 mx-1" />

        {/* Colors */}
        <div className="flex items-center gap-1">
          {COLORS.map((c, i) => (
            <Tooltip key={c} label={COLOR_NAMES[i]} position="bottom">
            <button
              onClick={() => setColor(c)}
              className={`w-5 h-5 rounded-full transition-all ${
                color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-surface scale-110' : 'hover:scale-110'
              }`}
              style={{ backgroundColor: c, border: c === '#ffffff' || c === '#000000' ? `1px solid rgba(255,255,255,0.15)` : undefined }}
            />
            </Tooltip>
          ))}
          {/* Custom color picker */}
          <Tooltip label="Custom color" position="bottom">
          <div className="relative">
            <div
              className="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform overflow-hidden"
              style={{ backgroundColor: color }}
              onClick={() => {
                const input = document.getElementById('canvas-color-picker') as HTMLInputElement
                if (input) {
                  if (input.showPicker) input.showPicker()
                  else input.click()
                }
              }}
            >
              <input
                id="canvas-color-picker"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
              />
            </div>
          </div>
          </Tooltip>
        </div>

        <div className="w-px h-6 bg-outline/10 mx-1" />

        {/* Width slider — controls drawing width or eraser width independently */}
        <div className="flex items-center gap-1.5">
          {/* Visual stroke preview */}
          <Tooltip label={tool === 'eraser'
            ? `Eraser ${Math.round(eraserWidth * 2.5)}px (control: ${eraserWidth})`
            : `${width}px`
          } position="bottom">
            <div
              className="rounded-full flex-shrink-0 transition-all"
              style={{
                width: Math.min(Math.max(activeWidth / 1.5, 6), 22),
                height: Math.min(Math.max(activeWidth / 1.5, 6), 22),
                backgroundColor: tool === 'eraser' ? 'transparent' : color,
                border: tool === 'eraser'
                  ? `2px solid ${isDark ? '#ffffff' : '#666'}`
                  : (color === '#ffffff' || color === '#000000'
                    ? `1px solid ${color === '#ffffff' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.15)'}`
                    : 'none'),
              }}
            />
          </Tooltip>

          {/* Slider */}
          <input
            type="range"
            min={MIN_WIDTH}
            max={MAX_WIDTH}
            value={activeWidth}
            onChange={(e) => setActiveWidth(Number(e.target.value))}
            className="w-16 h-1 bg-outline/20 rounded-full appearance-none cursor-pointer
              accent-primary
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary
              [&::-webkit-slider-thumb]:shadow-sm
              [&::-webkit-slider-thumb]:cursor-pointer
              [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:h-3
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-primary
              [&::-moz-range-thumb]:border-0
            "
          />

          {/* Width value */}
          <span className="text-[11px] font-mono text-on-surface-variant/70 min-w-[22px] text-center select-none tabular-nums">
            {activeWidth}
          </span>

          {/* Preset quick-select */}
          {WIDTHS.map(w => (
            <button
              key={w.value}
              onClick={() => setActiveWidth(w.value)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
                activeWidth === w.value
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant/40 hover:text-on-surface-variant hover:bg-on-surface/10'
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>

        {/* Fill toggle (only for rectangle/circle) */}
        {(tool === 'rectangle' || tool === 'circle') && (
          <>
            <div className="w-px h-6 bg-outline/10 mx-1" />
            <Tooltip label={filled ? 'Filled' : 'Outline only'} position="bottom">
            <button
              onClick={() => setFilled(!filled)}
              className={`p-1.5 rounded-lg transition-colors ${
                filled
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant hover:bg-on-surface/10'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {filled ? 'format_color_fill' : 'border_style'}
              </span>
            </button>
            </Tooltip>
          </>
        )}

        <div className="w-px h-6 bg-outline/10 mx-1" />

        {/* Actions */}
        <Tooltip label="Undo (Ctrl+Z)" position="bottom">
        <button
          onClick={handleUndo}
          disabled={undoStack.length === 0}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">undo</span>
        </button>
        </Tooltip>
        <Tooltip label="Redo (Ctrl+Shift+Z)" position="bottom">
        <button
          onClick={handleRedo}
          disabled={redoStack.length === 0}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">redo</span>
        </button>
        </Tooltip>
        {selectedId && (
          <Tooltip label="Delete (Del)" position="bottom">
          <button
            onClick={handleDeleteSelected}
            className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">delete</span>
          </button>
          </Tooltip>
        )}
        <Tooltip label="Clear canvas" position="bottom">
        <button
          onClick={handleClear}
          disabled={strokes.filter(s => s.completed).length === 0}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
        </button>
        </Tooltip>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Zoom controls */}
        <Tooltip label="Zoom in (Ctrl+Scroll)" position="bottom">
        <button
          onClick={zoomIn}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
        </button>
        </Tooltip>
        <span className="text-[11px] font-mono text-on-surface-variant/60 min-w-[48px] text-center select-none">
          {Math.round(transform.scale * 100)}%
        </span>
        <Tooltip label="Zoom out" position="bottom">
        <button
          onClick={zoomOut}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">remove</span>
        </button>
        </Tooltip>
        <Tooltip label="Reset zoom" position="bottom">
        <button
          onClick={zoomReset}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">fit_screen</span>
        </button>
        </Tooltip>

        <div className="w-px h-6 bg-outline/10 mx-1" />

        <Tooltip label="Export as PNG" position="bottom">
        <button
          onClick={handleExport}
          disabled={strokes.filter(s => s.completed).length === 0}
          className="p-1.5 rounded-lg text-on-surface-variant hover:text-on-surface hover:bg-on-surface/10 transition-colors disabled:opacity-30"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
        </button>
        </Tooltip>
      </div>

      {/* Canvas area */}
      <div className="flex-1 border border-t-0 border-outline/10 rounded-xl rounded-t-none overflow-hidden bg-surface-variant/10 flex flex-col">
        <div className="flex items-center justify-between px-3 py-1 border-b border-outline/5 shrink-0">
          <span className="text-[10px] font-medium text-on-surface-variant/40 uppercase tracking-widest select-none">
            {spaceHeld
              ? 'Pan (drag to move canvas)'
              : tool === 'select'
                ? selectedId ? 'Drag to move · Del to delete' : 'Click a stroke to select'
                : tool === 'text'
                  ? 'Click to place text'
                  : tool === 'eraser'
                    ? `Eraser · ${Math.round(eraserWidth * 2.5)}px  [ ] to adjust`
                    : `Draw · ${width}px  [ ] to adjust`}
          </span>
          <span className="text-[10px] text-on-surface-variant/30 select-none flex items-center gap-3">
            <span>{strokes.filter(s => s.completed).length} strokes</span>
            <span>{Math.round(transform.scale * 100)}%</span>
          </span>
        </div>
        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          style={{
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none',
            cursor: spaceHeld ? 'grabbing' : tool === 'select' ? 'default' : tool === 'text' ? 'text' : 'crosshair',
          }}
          onWheel={handleWheel}
          onContextMenu={handleContextMenu}
        >
          <canvas
            ref={canvasRef}
            width={canvasSize.w}
            height={canvasSize.h}
            className="absolute inset-0"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerLeave={(e) => {
              setCursorPos(null)
              handlePointerUp(e)
            }}
            onPointerCancel={handlePointerUp}
          />

          {/* Floating text input for text tool */}
          {textPlacementPos && (
            <textarea
              ref={textAreaRef}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  e.preventDefault()
                  commitText()
                } else if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  commitText()
                }
              }}
              onBlur={() => commitText()}
              placeholder="Type here..."
              className="absolute rounded-lg border-2 border-primary/60 bg-surface/90 text-on-surface p-2 outline-none resize-none shadow-lg backdrop-blur-sm"
              style={{
                left: textPlacementPos.x * transform.scale + transform.x - 4,
                top: textPlacementPos.y * transform.scale + transform.y - 4,
                minWidth: '180px',
                minHeight: '40px',
                fontSize: `${16 * transform.scale}px`,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
              autoFocus
            />
          )}
          {/* Tool cursor preview — shows the effective brush/eraser size at cursor */}
          {cursorPos && tool !== 'select' && tool !== 'text' && (
            <>
              {/* Eraser: transparent circle with border */}
              {tool === 'eraser' && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: cursorPos.x - (eraserWidth * 2.5 * transform.scale) / 2,
                    top: cursorPos.y - (eraserWidth * 2.5 * transform.scale) / 2,
                    width: eraserWidth * 2.5 * transform.scale,
                    height: eraserWidth * 2.5 * transform.scale,
                    borderRadius: '50%',
                    border: `2px solid ${isDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'}`,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    transition: 'width 0.08s ease, height 0.08s ease',
                  }}
                >
                  {/* Crosshair dot in center */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: Math.min(4 * transform.scale, 8),
                      height: Math.min(4 * transform.scale, 8),
                      backgroundColor: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)',
                    }}
                  />
                </div>
              )}
              {/* Brush: filled circle with active color */}
              {tool !== 'eraser' && (
                <div
                  className="absolute pointer-events-none z-10"
                  style={{
                    left: cursorPos.x - Math.max(width * transform.scale, 6) / 2,
                    top: cursorPos.y - Math.max(width * transform.scale, 6) / 2,
                    width: Math.max(width * transform.scale, 6),
                    height: Math.max(width * transform.scale, 6),
                    borderRadius: '50%',
                    backgroundColor: color + '40',
                    border: `1.5px solid ${color}`,
                    transition: 'width 0.08s ease, height 0.08s ease',
                  }}
                >
                  {/* Crosshair dot in center */}
                  <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                    style={{
                      width: Math.min(3 * transform.scale, 6),
                      height: Math.min(3 * transform.scale, 6),
                      backgroundColor: color === '#ffffff' ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.5)',
                    }}
                  />
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  )
}
