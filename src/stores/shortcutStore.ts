import { create } from 'zustand'

export interface ShortcutCombo {
  key: string
  ctrl: boolean
  alt: boolean
  shift: boolean
  meta: boolean
}

export interface ShortcutDef {
  id: string
  label: string
  category: 'general' | 'page-creation'
  default: ShortcutCombo
}

// All configurable shortcuts with their defaults
export const SHORTCUT_DEFS: ShortcutDef[] = [
  // General
  { id: 'commandPalette', label: 'Command Palette / Search', category: 'general', default: { key: 'p', ctrl: true, alt: false, shift: false, meta: false } },
  { id: 'toggleSidebar', label: 'Toggle left sidebar', category: 'general', default: { key: '\\', ctrl: true, alt: false, shift: false, meta: false } },
  { id: 'createProject', label: 'Create Project', category: 'general', default: { key: 'n', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'cycleViewMode', label: 'Cycle view mode (Editor ↔ Both ↔ Graph)', category: 'general', default: { key: 'v', ctrl: true, alt: true, shift: false, meta: false } },

  // Page creation
  { id: 'createTextPage', label: 'Create Text page', category: 'page-creation', default: { key: 't', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createBoardPage', label: 'Create Board page', category: 'page-creation', default: { key: 'b', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createTablePage', label: 'Create Table page', category: 'page-creation', default: { key: 'l', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createGalleryPage', label: 'Create Gallery page', category: 'page-creation', default: { key: 'g', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createChartPage', label: 'Create Chart page', category: 'page-creation', default: { key: 'c', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createChecklistPage', label: 'Create Checklist page', category: 'page-creation', default: { key: 'k', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createFolderPage', label: 'Create Folder page', category: 'page-creation', default: { key: 'f', ctrl: true, alt: true, shift: false, meta: false } },
  { id: 'createCanvasPage', label: 'Create Canvas page', category: 'page-creation', default: { key: 'd', ctrl: true, alt: true, shift: false, meta: false } },
]

const STORAGE_KEY = 'notie-shortcuts'

function loadOverrides(): Record<string, ShortcutCombo> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* ignore */ }
  return {}
}

function saveOverrides(overrides: Record<string, ShortcutCombo>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch { /* ignore */ }
}

interface ShortcutState {
  overrides: Record<string, ShortcutCombo>
  getCombo: (id: string) => ShortcutCombo
  getDisplayString: (id: string) => string
  setShortcut: (id: string, combo: ShortcutCombo) => void
  resetShortcut: (id: string) => void
  resetAll: () => void
  matchEvent: (id: string, e: KeyboardEvent) => boolean
}

export const useShortcutStore = create<ShortcutState>((set, get) => ({
  overrides: loadOverrides(),

  getCombo: (id: string) => {
    const def = SHORTCUT_DEFS.find(d => d.id === id)
    if (!def) return { key: '', ctrl: false, alt: false, shift: false, meta: false }
    return get().overrides[id] || def.default
  },

  getDisplayString: (id: string) => {
    const combo = get().getCombo(id)
    const parts: string[] = []
    if (combo.ctrl) parts.push(getCtrlLabel())
    if (combo.alt) parts.push('Alt')
    if (combo.shift) parts.push('Shift')
    if (combo.meta) parts.push(getMetaLabel())
    if (combo.key) {
      const keyLabel = combo.key === ' ' ? 'Space' : combo.key === '\\' ? '\\' : combo.key.toUpperCase()
      parts.push(keyLabel)
    }
    return parts.join('+')
  },

  setShortcut: (id: string, combo: ShortcutCombo) => {
    set(state => {
      const overrides = { ...state.overrides, [id]: combo }
      saveOverrides(overrides)
      return { overrides }
    })
  },

  resetShortcut: (id: string) => {
    set(state => {
      const overrides = { ...state.overrides }
      delete overrides[id]
      saveOverrides(overrides)
      return { overrides }
    })
  },

  resetAll: () => {
    set({ overrides: {} })
    saveOverrides({})
  },

  matchEvent: (id: string, e: KeyboardEvent) => {
    const combo = get().getCombo(id)
    const keyMatch = e.key.toLowerCase() === combo.key.toLowerCase()

    // On macOS, the primary modifier is Cmd (metaKey), so treat `ctrl` in the
    // shortcut definition as matching either Cmd or the actual Ctrl key.
    // This allows default shortcuts (defined as Ctrl+X) to work with Cmd+X on Mac.
    const isMac = isMacPlatform()
    // On Mac, `ctrl` in the shortcut definition maps to Cmd (metaKey).
    // When the shortcut requires Ctrl (ctrl:true), accept EITHER Cmd or Ctrl.
    // When it requires no Ctrl (ctrl:false), reject BOTH Cmd and Ctrl.
    const ctrlMatch = isMac
      ? combo.ctrl
        ? (!!e.metaKey || !!e.ctrlKey)
        : (!e.metaKey && !e.ctrlKey)
      : !!e.ctrlKey === combo.ctrl

    const altMatch = !!e.altKey === combo.alt
    const shiftMatch = !!e.shiftKey === combo.shift
    // On Mac, the `meta` flag is subsumed by `ctrl` matching above (Cmd is the
    // primary modifier). Skipping the meta check avoids double-matching issues.
    const metaMatch = isMac ? true : !!e.metaKey === combo.meta

    return keyMatch && ctrlMatch && altMatch && shiftMatch && metaMatch
  },
}))

/** Convert a KeyboardEvent to a ShortcutCombo */
export function eventToCombo(e: React.KeyboardEvent | KeyboardEvent): ShortcutCombo {
  const isMac = isMacPlatform()
  return {
    key: e.key === ' ' ? ' ' : e.key.length === 1 ? e.key.toLowerCase() : e.key,
    // On Mac, Cmd (metaKey) is the primary modifier — map it to `ctrl`
    ctrl: isMac ? !!e.metaKey || !!e.ctrlKey : !!e.ctrlKey,
    alt: !!e.altKey,
    shift: !!e.shiftKey,
    // On Mac, `meta` is unused (Cmd is already captured as `ctrl`)
    meta: isMac ? false : !!e.metaKey,
  }
}

/** Check if a combo includes at least one modifier (Ctrl/Alt/Cmd) — used to validate user-set combos */
export function hasModifier(combo: ShortcutCombo): boolean {
  return combo.ctrl || combo.alt || combo.meta
}

/** Detect if the current platform is macOS */
export function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform || navigator.userAgent)
}

/** Get the platform-appropriate label for the Ctrl / Cmd modifier key */
export function getCtrlLabel(): string {
  return isMacPlatform() ? '⌘' : 'Ctrl'
}

/** Get the platform-appropriate label for the meta (Cmd/Windows) modifier key */
export function getMetaLabel(): string {
  return isMacPlatform() ? '⌘' : 'Cmd'
}

/**
 * Replace the Ctrl prefix in a shortcut string with the platform-appropriate
 * label (⌘ on Mac, Ctrl on Windows).
 * Example: platformShortcut('Ctrl+B') → '⌘B' on Mac, 'Ctrl+B' on Windows.
 */
export function platformShortcut(shortcut: string): string {
  return shortcut.replace(/^Ctrl/, getCtrlLabel())
}
