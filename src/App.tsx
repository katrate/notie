import { useEffect, useState, useCallback, useRef } from 'react'
import { check } from '@tauri-apps/plugin-updater'
import { useAuthStore } from './stores/authStore'
import { useThemeStore, applyBackgroundForTheme } from './stores/themeStore'
import { useProjectStore, fetchLastSession, checkNeedsOnboarding } from './stores/projectStore'
import { AuthScreen } from './components/auth/AuthScreen'
import { OnboardingScreen } from './components/auth/OnboardingScreen'
import { ToastContainer } from './components/Toast'
import { MainLayout } from './components/layout/MainLayout'
import { CommandPalette } from './components/CommandPalette'
import { UpdateModal } from './components/updater/UpdateModal'
import { useToastStore } from './stores/toastStore'
import { useCommandStore } from './stores/commandStore'
import { useShortcutStore, SHORTCUT_DEFS } from './stores/shortcutStore'
import {
  DARK_GRADIENTS,
  LIGHT_GRADIENTS,
  DARK_BACKGROUND_COLORS,
  LIGHT_BACKGROUND_COLORS,
} from './stores/themeStore'

function App() {
  const { session, loading, user } = useAuthStore()
  const { theme, accentColor } = useThemeStore()
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const activeProject = useProjectStore(
    s => s.activeProjectId ? s.projects.find(p => p.id === s.activeProjectId) ?? null : null
  )
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState<'checking' | 'show' | 'hidden'>('checking')
  const [showUpdateModal, setShowUpdateModal] = useState(false)

  // First-login detection: after session is confirmed, check if onboarding is needed
  useEffect(() => {
    if (loading) return;
    if (!session || !user) {
      setShowOnboarding('hidden');
      return;
    }
    checkNeedsOnboarding(user.id).then((needsIt) => {
      setShowOnboarding(needsIt ? 'show' : 'hidden');
    });
  }, [loading, session, user]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.setProperty('--color-primary', accentColor)
    applyBackgroundForTheme(theme)
  }, [])

  const toast = useToastStore(s => s.toast)

  // Check if the user is focused on an editable element (input, textarea, contenteditable)
  const isInEditableArea = useCallback((target: EventTarget | null) => {
    if (!target || !(target instanceof HTMLElement)) return false
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return true
    if (target.isContentEditable) return true
    if (target.closest('[contenteditable="true"]')) return true
    if (target.closest('.ProseMirror')) return true
    return false
  }, [])

  // ── Apply project-specific theme overrides ──
  // Whenever the active project changes, apply its theme settings (accent, background, mode)
  // falling back to global settings when not configured per-project.
  // Subscribes to activeProject so that changes made in the Dashboard apply immediately.
  useEffect(() => {
    const settings = activeProject?.settings || {};

    // Theme mode
    const themeMode = settings.themeMode as string | null;
    if (themeMode === 'dark' || themeMode === 'light') {
      document.documentElement.setAttribute('data-theme', themeMode);
    } else {
      const globalTheme = (() => { try { return localStorage.getItem('notie-theme') } catch { return null } })() || 'dark';
      document.documentElement.setAttribute('data-theme', globalTheme);
    }

    // Accent color
    const accentColor = settings.accentColor as string | null;
    if (accentColor) {
      document.documentElement.style.setProperty('--color-primary', accentColor);
    } else {
      const globalAccent = (() => { try { return localStorage.getItem('notie-accent') } catch { return null } })() || '#98cbff';
      document.documentElement.style.setProperty('--color-primary', globalAccent);
    }

    // Background
    const background = settings.background as string | null;
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';

    // Clear all background styles first
    document.body.style.background = '';
    document.body.style.backgroundColor = '';
    document.body.style.backgroundImage = '';
    document.body.style.backgroundAttachment = '';

    if (background && background !== 'default') {
      // Apply project-specific background
      const gradients = currentTheme === 'light' ? LIGHT_GRADIENTS : DARK_GRADIENTS;
      const gradCSS = gradients[background];
      if (gradCSS) {
        document.body.style.background = gradCSS;
        document.body.style.backgroundAttachment = 'fixed';
      } else {
        // Look up solid colors
        const bgColors = currentTheme === 'light' ? LIGHT_BACKGROUND_COLORS : DARK_BACKGROUND_COLORS;
        const bg = bgColors.find(c => c.id === background);
        if (bg) {
          document.body.style.backgroundColor = bg.hex;
        }
      }
    } else {
      // No project background → fall back to global background
      const themeForBg = currentTheme as 'dark' | 'light';
      applyBackgroundForTheme(themeForBg);
    }
  }, [theme, accentColor, activeProjectId, activeProject]);

  // Global context menu: prevent browser default right-click menu everywhere
  // Custom context menus (like the editor's) handle their own contextmenu events
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // Global keyboard shortcuts from the customizable shortcut store
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isInEditableArea(e.target)) return

      const store = useShortcutStore.getState()

      // Command palette
      if (store.matchEvent('commandPalette', e)) {
        e.preventDefault()
        setShowCommandPalette(v => !v)
        return
      }

      // Toggle sidebar
      if (store.matchEvent('toggleSidebar', e)) {
        e.preventDefault()
        const state = useProjectStore.getState()
        state.setSidebarVisible(!state.sidebarVisible)
        return
      }

      // Cycle view mode
      if (store.matchEvent('cycleViewMode', e)) {
        e.preventDefault()
        const state = useProjectStore.getState()
        const next = state.viewMode === 'editor' ? 'both' : state.viewMode === 'both' ? 'graph' : 'editor'
        state.setViewMode(next)
        toast(`Switched to ${next} view`, 'info', 1500)
        return
      }

      // Create project
      if (store.matchEvent('createProject', e)) {
        e.preventDefault()
        useCommandStore.getState().setOpenCreateProjectModal(true)
        toast('Creating new project…', 'info', 1500)
        return
      }

      // Page creation shortcuts — match via shortcut store to support remapping
      const pageIdToType: Record<string, { type: string; label: string; icon: string }> = {
        createTextPage: { type: 'text', label: 'Text', icon: 'article' },
        createBoardPage: { type: 'board', label: 'Board', icon: 'dashboard' },
        createTablePage: { type: 'table', label: 'Table', icon: 'grid_on' },
        createGalleryPage: { type: 'gallery', label: 'Gallery', icon: 'photo_library' },
        createChartPage: { type: 'chart', label: 'Chart', icon: 'bar_chart' },
        createChecklistPage: { type: 'checklist', label: 'Checklist', icon: 'checklist' },
        createFolderPage: { type: 'folder', label: 'Folder', icon: 'folder' },
        createCanvasPage: { type: 'canvas', label: 'Canvas', icon: 'gesture' },
      }

      for (const def of SHORTCUT_DEFS) {
        if (def.category === 'page-creation' && store.matchEvent(def.id, e)) {
          e.preventDefault()
          const pageInfo = pageIdToType[def.id]
          if (!pageInfo) break
          const state = useProjectStore.getState()
          if (state.activeProjectId) {
            state.createPage(state.activeProjectId, `Untitled ${pageInfo.label}`, pageInfo.type, {}, pageInfo.icon)
            toast(`Creating ${pageInfo.label} page`, 'success', 1500)
          } else {
            state.createStandalonePage(`Untitled ${pageInfo.label}`, pageInfo.type, pageInfo.icon)
            toast(`Creating standalone ${pageInfo.label} page`, 'success', 1500)
          }
          break
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [isInEditableArea, toast])



  if (loading || showOnboarding === 'checking') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (!session) {
    return <>
      <AuthScreen />
      <ToastContainer />
    </>
  }

  if (showOnboarding === 'show') {
    return <>
      <OnboardingScreen onComplete={() => setShowOnboarding('hidden')} />
      <ToastContainer />
    </>
  }

  return <>
    <MainLayout />
    <SessionRestorer />
    <ToastContainer />
    {showCommandPalette && <CommandPalette onClose={() => setShowCommandPalette(false)} />}
    {showUpdateModal && <UpdateModal onClose={() => setShowUpdateModal(false)} />}
    <UpdateChecker onUpdateAvailable={() => setShowUpdateModal(true)} />
  </>
}

/** Runs once on app load to restore the last session */
function SessionRestorer() {
  useEffect(() => {
    const init = async () => {
      const store = useProjectStore.getState();
      await store.fetchProjects();
      const { projects } = useProjectStore.getState();

      // Always fetch standalone pages so they're visible regardless of project state
      await store.fetchStandalonePages();

      if (projects.length === 0) {
        // No projects exist — try restoring a standalone page
        const saved = await fetchLastSession();
        if (saved.lastPageId) {
          const { pages } = useProjectStore.getState();
          if (pages.some(p => p.id === saved.lastPageId)) {
            useProjectStore.setState({ activeProjectId: null, activePageId: saved.lastPageId });
          }
        }
        useProjectStore.getState().setSessionRestored(true);
        return;
      }

      const saved = await fetchLastSession();

      // Case 1: Last session was on a standalone page
      if (!saved.lastProjectId && saved.lastPageId) {
        const { pages } = useProjectStore.getState();
        if (pages.some(p => p.id === saved.lastPageId)) {
          useProjectStore.setState({ activeProjectId: null, activePageId: saved.lastPageId });
          useProjectStore.getState().setSessionRestored(true);
          return;
        }
        // Standalone page was deleted — fall through to project restore
      }

      // Case 2: Restore a project session
      let targetProjectId: string;
      let targetPageId: string | null = null;

      if (saved.lastProjectId && projects.some(p => p.id === saved.lastProjectId)) {
        targetProjectId = saved.lastProjectId;
        targetPageId = saved.lastPageId;
      } else {
        targetProjectId = projects[0].id;
      }

      // Keep existing standalone pages when setting the project — don't wipe pages:[]
      const currentPages = useProjectStore.getState().pages;
      const standalonePages = currentPages.filter(p => !p.project_id);
      useProjectStore.setState({ activeProjectId: targetProjectId, activePageId: null, pages: standalonePages });

      await store.fetchPages(targetProjectId);
      const { pages } = useProjectStore.getState();
      const projectPages = pages.filter(p => p.project_id === targetProjectId);

      if (projectPages.length > 0) {
        const resolvedPageId = (targetPageId && projectPages.some(p => p.id === targetPageId))
          ? targetPageId
          : projectPages[0].id;
        useProjectStore.setState({ activePageId: resolvedPageId });
      }

      useProjectStore.getState().setSessionRestored(true);
    };
    init();
  }, []);

  return null;
}

/** Silently checks for updates on startup and notifies the user if available */
function UpdateChecker({ onUpdateAvailable }: { onUpdateAvailable: () => void }) {
  const toast = useToastStore(s => s.toast)
  const onUpdateRef = useRef(onUpdateAvailable)
  onUpdateRef.current = onUpdateAvailable

  useEffect(() => {
    let cancelled = false

    const runCheck = async () => {
      try {
        const update = await check()
        if (cancelled) return

        if (update?.version) {
          toast(`Update v${update.version} is available! Open Settings → Updates to install.`, 'info', 8000)
          onUpdateRef.current()
        }
      } catch {
        // Silently fail — user can check manually in Settings
      }
    }

    // Wait a bit for the app to fully load before checking
    const timer = setTimeout(runCheck, 5000)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}

export default App
