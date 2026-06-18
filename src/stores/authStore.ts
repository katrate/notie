import { create } from 'zustand'

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
      set({ user: null, session: null, loading: false })
    }
  },
}))

window.electronAPI?.getSession().then((session) => {
  useAuthStore.getState().setSession(session)
  useAuthStore.getState().setUser(session?.user ?? null)
  useAuthStore.getState().setLoading(false)
})

window.electronAPI?.onAuthStateChanged((session) => {
  useAuthStore.getState().setSession(session)
  useAuthStore.getState().setUser(session?.user ?? null)
  useAuthStore.getState().setLoading(false)
})
