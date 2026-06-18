import { create } from 'zustand'
import { useProjectStore } from './projectStore'
import { useTemplateStore } from './templateStore'
import { useGraphStore } from './graphStore'
import { useThemeStore, loadThemeFromProfile, applyCustomTheme } from './themeStore'

interface AuthState {
  user: PublicUser | null
  session: PublicSession | null
  loading: boolean
  error: string | null
  setUser: (user: PublicUser | null) => void
  setSession: (session: PublicSession | null) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  signOut: () => Promise<void>
}

function clearAllDataStores() {
  useProjectStore.getState().reset()
  useTemplateStore.getState().reset()
  useGraphStore.getState().reset()
  useThemeStore.getState().resetToDefault()
  try {
    localStorage.removeItem('notie_recent_colors')
  } catch {}
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  loading: true,
  error: null,
  setUser: (user) => set({ user }),
  setSession: (session) => set({ session }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  signOut: async () => {
    set({ loading: true })
    const result = await window.electronAPI?.signOut()
    if (result?.error) {
      set({ error: result.error, loading: false })
    } else {
      clearAllDataStores()
      set({ user: null, session: null, loading: false })
    }
  },
}))

window.electronAPI?.getSession().then(async (session) => {
  if (session?.user) {
    const profileTheme = await loadThemeFromProfile()
    if (profileTheme) {
      useThemeStore.setState({ customTheme: profileTheme.customTheme, themeMode: profileTheme.themeMode })
      applyCustomTheme(profileTheme.customTheme === 'none' ? null : profileTheme.customTheme, profileTheme.themeMode)
    }
  }
  useAuthStore.getState().setSession(session)
  useAuthStore.getState().setUser(session?.user ?? null)
  useAuthStore.getState().setLoading(false)
})

let knownUserId: string | null = null

window.electronAPI?.onAuthStateChanged(async (session) => {
  const newUserId = session?.user?.id ?? null

  // If switching users or logging out, wipe cached data
  if (newUserId !== knownUserId) {
    knownUserId = newUserId
    clearAllDataStores()
  }

  // If logging in, load theme preferences from the user's profile
  if (session?.user) {
    const profileTheme = await loadThemeFromProfile()
    if (profileTheme) {
      useThemeStore.setState({ customTheme: profileTheme.customTheme, themeMode: profileTheme.themeMode })
      applyCustomTheme(profileTheme.customTheme === 'none' ? null : profileTheme.customTheme, profileTheme.themeMode)
    }
  }

  useAuthStore.getState().setSession(session)
  useAuthStore.getState().setUser(session?.user ?? null)
  useAuthStore.getState().setLoading(false)
})
