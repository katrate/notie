import { create } from 'zustand'

export interface CustomThemePreview {
  background: string
  text: string
  accent: string
  secondary: string
}

export interface CustomTheme {
  id: string
  name: string
  description: string
  accentColor: string
  previewColors: CustomThemePreview
}

export const CUSTOM_THEMES: CustomTheme[] = [
  {
    id: 'utopia-tokyo',
    name: 'Akai',
    description: 'Bold red accents against a clean monochrome palette',
    accentColor: '#ff1919',
    previewColors: {
      background: '#000000',
      text: '#14171f',
      accent: '#ff1919',
      secondary: '#ebe5ce',
    },
  },
  {
    id: 'sougen',
    name: 'Sumi',
    description: 'Pure black-and-white contrast inspired by Japanese ink',
    accentColor: '#ffffff',
    previewColors: {
      background: '#000000',
      text: '#ffffff',
      accent: '#ffffff',
      secondary: '#e5e7eb',
    },
  },
  {
    id: 'fallen-grape',
    name: 'Copper Vine',
    description: 'Warm earthy tones with copper accents and natural wine vibes',
    accentColor: '#e3a36e',
    previewColors: {
      background: '#e1c6ab',
      text: '#573d21',
      accent: '#e3a36e',
      secondary: '#d8deb7',
    },
  },
  {
    id: 'chainzoku',
    name: 'Zoku',
    description: 'Dark cyber-minimal theme with electric lime accents',
    accentColor: '#cdfb52',
    previewColors: {
      background: '#000000',
      text: '#fffff7',
      accent: '#cdfb52',
      secondary: '#1c1616',
    },
  },
  {
    id: 'branding-agency',
    name: 'Atelier Noir',
    description: 'Premium dark theme with gold accents and teal undertones',
    accentColor: '#bc994e',
    previewColors: {
      background: '#000000',
      text: '#ffffff',
      accent: '#bc994e',
      secondary: '#005368',
    },
  },
  {
    id: 'garden-eight',
    name: 'Eighth Garden',
    description: 'Minimal dark theme with warm cream accents',
    accentColor: '#dbd6d0',
    previewColors: {
      background: '#000000',
      text: '#ffffff',
      accent: '#dbd6d0',
      secondary: '#1e1f1f',
    },
  },
  {
    id: 'unseen-studio',
    name: 'Obscura',
    description: 'Stark black-on-white minimal theme with hidden depths',
    accentColor: '#ffffff',
    previewColors: {
      background: '#000000',
      text: '#ffffff',
      accent: '#ffffff',
      secondary: '#d6d6d6',
    },
  },
  {
    id: 'stark',
    name: 'Viola',
    description: 'Dark theme with deep purple-blue accents',
    accentColor: '#381fd1',
    previewColors: {
      background: '#000000',
      text: '#f6f6eb',
      accent: '#381fd1',
      secondary: '#10284b',
    },
  },
]

interface ThemeState {
  customTheme: string
  themeMode: 'dark' | 'light'
  setCustomTheme: (id: string) => void
  setThemeMode: (mode: 'dark' | 'light') => void
}

function getInitialCustomTheme(): string {
  try {
    return localStorage.getItem('notie-custom-theme') || 'none'
  } catch {
    return 'none'
  }
}

function getInitialThemeMode(): 'dark' | 'light' {
  try {
    const saved = localStorage.getItem('notie-theme-mode')
    if (saved === 'light' || saved === 'dark') return saved
    return 'dark'
  } catch {
    return 'dark'
  }
}

export function applyCustomTheme(themeId: string | null, mode?: 'dark' | 'light') {
  if (themeId && themeId !== 'none') {
    document.documentElement.setAttribute('data-custom-theme', themeId)
    const theme = CUSTOM_THEMES.find(t => t.id === themeId)
    if (theme) {
      document.documentElement.style.setProperty('--color-primary', theme.accentColor)
    }
  } else {
    document.documentElement.removeAttribute('data-custom-theme')
    document.documentElement.style.removeProperty('--color-primary')
  }
  // Apply theme mode attribute
  const effectiveMode = mode || getInitialThemeMode()
  document.documentElement.setAttribute('data-theme-mode', effectiveMode)
}

export const useThemeStore = create<ThemeState>((set) => ({
  customTheme: getInitialCustomTheme(),
  themeMode: getInitialThemeMode(),
  setCustomTheme: (id) => {
    const state = useThemeStore.getState()
    // Obscura is a stark monochrome theme — always force dark mode
    const desiredMode = id === 'unseen-studio' ? 'dark' : state.themeMode

    set({ customTheme: id, themeMode: desiredMode })
    try {
      localStorage.setItem('notie-custom-theme', id)
      localStorage.setItem('notie-theme-mode', desiredMode)
    } catch {}
    applyCustomTheme(id === 'none' ? null : id, desiredMode)
  },
  setThemeMode: (mode) => {
    set({ themeMode: mode })
    try { localStorage.setItem('notie-theme-mode', mode) } catch {}
    document.documentElement.setAttribute('data-theme-mode', mode)
  },
}))
