import { create } from 'zustand'

export type ThemeMode = 'dark' | 'light'

export interface AccentColor {
  name: string
  hex: string
}

export const ACCENT_COLORS: AccentColor[] = [
  { name: 'Blue', hex: '#98cbff' },
  { name: 'Purple', hex: '#a78bfa' },
  { name: 'Pink', hex: '#f472b6' },
  { name: 'Red', hex: '#f87171' },
  { name: 'Orange', hex: '#fb923c' },
  { name: 'Yellow', hex: '#facc15' },
  { name: 'Green', hex: '#4ade80' },
  { name: 'Teal', hex: '#2dd4bf' },
  { name: 'Cyan', hex: '#22d3ee' },
]

interface ThemeState {
  theme: ThemeMode
  accentColor: string
  setTheme: (theme: ThemeMode) => void
  setAccentColor: (color: string) => void
}

function getInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('notie-theme')
    if (stored === 'light' || stored === 'dark') return stored
  } catch {}
  return 'dark'
}

function getInitialAccent(): string {
  try {
    return localStorage.getItem('notie-accent') || '#98cbff'
  } catch {
    return '#98cbff'
  }
}

export const DARK_GRADIENTS: Record<string, string> = {
  gradient1: 'linear-gradient(135deg, #0f0f1a, #1a0a2e, #0f0f1a)',
  gradient2: 'linear-gradient(135deg, #1a0a0a, #2e1a0a, #1a0a1a)',
  gradient3: 'linear-gradient(135deg, #0a1a0a, #0a2e1a, #0a0f1a)',
  gradient4: 'linear-gradient(135deg, #0a0a1a, #0a1a2e, #0a0f1a)',
}

export const LIGHT_GRADIENTS: Record<string, string> = {
  'light-gradient1': 'linear-gradient(135deg, #fef7ff, #f0e6ff, #fef7ff)',
  'light-gradient2': 'linear-gradient(135deg, #fef7f0, #ffe6cc, #fff0f0)',
  'light-gradient3': 'linear-gradient(135deg, #f4fff4, #d4f5d4, #eef7ee)',
  'light-gradient4': 'linear-gradient(135deg, #f0f7ff, #d4e5f5, #eef4fa)',
}

export interface BackgroundColor {
  id: string
  label: string
  hex: string
}

export const DARK_BACKGROUND_OPTIONS = [
  { id: 'default', label: 'Default', isSolid: false },
  { id: 'gradient1', label: 'Cosmic', isSolid: false },
  { id: 'gradient2', label: 'Sunset', isSolid: false },
  { id: 'gradient3', label: 'Forest', isSolid: false },
  { id: 'gradient4', label: 'Ocean', isSolid: false },
]

export const LIGHT_BACKGROUND_OPTIONS = [
  { id: 'default', label: 'Default', isSolid: false },
  { id: 'light-gradient1', label: 'Lavender', isSolid: false },
  { id: 'light-gradient2', label: 'Peach', isSolid: false },
  { id: 'light-gradient3', label: 'Mint', isSolid: false },
  { id: 'light-gradient4', label: 'Sky', isSolid: false },
]

export const DARK_BACKGROUND_COLORS: BackgroundColor[] = [
  { id: 'bg-charcoal', label: 'Charcoal', hex: '#1a1a1a' },
  { id: 'bg-slate', label: 'Slate', hex: '#1e293b' },
  { id: 'bg-stone', label: 'Stone', hex: '#292524' },
  { id: 'bg-neutral', label: 'Neutral', hex: '#262626' },
  { id: 'bg-zinc', label: 'Zinc', hex: '#27272a' },
  { id: 'bg-gray', label: 'Gray', hex: '#1f2937' },
  { id: 'bg-red', label: 'Red', hex: '#2d1517' },
  { id: 'bg-rose', label: 'Rose', hex: '#2d1520' },
  { id: 'bg-orange', label: 'Orange', hex: '#2d1f15' },
  { id: 'bg-amber', label: 'Amber', hex: '#2d2415' },
  { id: 'bg-yellow', label: 'Yellow', hex: '#2d2915' },
  { id: 'bg-lime', label: 'Lime', hex: '#1f2d15' },
  { id: 'bg-green', label: 'Green', hex: '#152d1a' },
  { id: 'bg-emerald', label: 'Emerald', hex: '#152d24' },
  { id: 'bg-teal', label: 'Teal', hex: '#152d2d' },
  { id: 'bg-cyan', label: 'Cyan', hex: '#15282d' },
  { id: 'bg-sky', label: 'Sky', hex: '#15222d' },
  { id: 'bg-blue', label: 'Blue', hex: '#151f2d' },
  { id: 'bg-indigo', label: 'Indigo', hex: '#1a152d' },
  { id: 'bg-violet', label: 'Violet', hex: '#23152d' },
  { id: 'bg-purple', label: 'Purple', hex: '#2d152d' },
  { id: 'bg-fuchsia', label: 'Fuchsia', hex: '#2d1525' },
  { id: 'bg-pink', label: 'Pink', hex: '#2d151f' },
]

export const LIGHT_BACKGROUND_COLORS: BackgroundColor[] = [
  { id: 'light-white', label: 'White', hex: '#ffffff' },
  { id: 'light-off-white', label: 'Off White', hex: '#fef7ff' },
  { id: 'light-ice', label: 'Ice', hex: '#f4f9ff' },
  { id: 'light-snow', label: 'Snow', hex: '#fffafa' },
  { id: 'light-cream', label: 'Cream', hex: '#fffcf0' },
  { id: 'light-eggshell', label: 'Eggshell', hex: '#fcf5e8' },
  { id: 'light-warm-white', label: 'Warm White', hex: '#fef7f0' },
  { id: 'light-soft-pink', label: 'Soft Pink', hex: '#fef0f6' },
  { id: 'light-soft-lavender', label: 'Soft Lavender', hex: '#f8f0ff' },
  { id: 'light-soft-blue', label: 'Soft Blue', hex: '#f0f5ff' },
  { id: 'light-soft-sky', label: 'Soft Sky', hex: '#f0faff' },
  { id: 'light-soft-mint', label: 'Soft Mint', hex: '#f0fff4' },
  { id: 'light-soft-green', label: 'Soft Green', hex: '#f4fff4' },
  { id: 'light-soft-peach', label: 'Soft Peach', hex: '#fff4f0' },
  { id: 'light-soft-yellow', label: 'Soft Yellow', hex: '#fffff0' },
  { id: 'light-soft-amber', label: 'Soft Amber', hex: '#fff8f0' },
  { id: 'light-soft-coral', label: 'Soft Coral', hex: '#fff0f0' },
  { id: 'light-soft-lilac', label: 'Soft Lilac', hex: '#fceefc' },
  { id: 'light-soft-teal', label: 'Soft Teal', hex: '#f0fcfc' },
  { id: 'light-soft-rose', label: 'Soft Rose', hex: '#fef0f4' },
  { id: 'light-barely-gray', label: 'Barely Gray', hex: '#f8f8f8' },
  { id: 'light-warm-gray', label: 'Warm Gray', hex: '#f5f4f0' },
  { id: 'light-cool-gray', label: 'Cool Gray', hex: '#f0f2f5' },
]

export function applyBackgroundForTheme(theme: ThemeMode) {
  const bgKey = `notie-bg-${theme}`
  const solidKey = `notie-bg-${theme}-solid`
  const bgId = (() => { try { return localStorage.getItem(bgKey) } catch { return null } })()

  document.body.style.background = ''
  document.body.style.backgroundColor = ''
  document.body.style.backgroundImage = ''
  document.body.style.backgroundAttachment = ''

  if (!bgId || bgId === 'default') return

  const gradients = theme === 'dark' ? DARK_GRADIENTS : LIGHT_GRADIENTS
  const gradCSS = gradients[bgId]
  if (gradCSS) {
    document.body.style.background = gradCSS
    document.body.style.backgroundAttachment = 'fixed'
    return
  }

  const hex = (() => { try { return localStorage.getItem(solidKey) } catch { return null } })()
  if (hex) {
    document.body.style.backgroundColor = hex
  }
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: getInitialTheme(),
  accentColor: getInitialAccent(),
  setTheme: (theme) => {
    set({ theme })
    try { localStorage.setItem('notie-theme', theme) } catch {}
    document.documentElement.setAttribute('data-theme', theme)
    applyBackgroundForTheme(theme)
  },
  setAccentColor: (color) => {
    set({ accentColor: color })
    try { localStorage.setItem('notie-accent', color) } catch {}
    document.documentElement.style.setProperty('--color-primary', color)
  },
}))
