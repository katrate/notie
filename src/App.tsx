import { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from './stores/authStore'
import { useThemeStore, applyCustomTheme } from './stores/themeStore'
import { useProjectStore, fetchLastSession, checkNeedsOnboarding } from './stores/projectStore'
import { AuthScreen } from './components/auth/AuthScreen'
import { OnboardingScreen } from './components/auth/OnboardingScreen'
import { ToastContainer } from './components/Toast'
import { MainLayout } from './components/layout/MainLayout'
import { CommandPalette } from './components/CommandPalette'
import { useToastStore } from './stores/toastStore'
import { useCommandStore } from './stores/commandStore'
import { useShortcutStore, SHORTCUT_DEFS, hasModifier } from './stores/shortcutStore'

function App() {
  const { session, loading, user } = useAuthStore()
  const { customTheme } = useThemeStore()
  const [showCommandPalette, setShowCommandPalette] = useState(false)
  const [showOnboarding, setShowOnboarding] = useState<'checking' | 'show' | 'hidden'>('checking')

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

  const { themeMode } = useThemeStore()

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    applyCustomTheme(customTheme, themeMode)
  }, [customTheme, themeMode])

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

  // Background is always driven by the custom theme's CSS variables via [data-custom-theme]

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
      const inInput = isInEditableArea(e.target)
      const store = useShortcutStore.getState()

      // Command palette
      if (store.matchEvent('commandPalette', e)) {
        if (inInput && !hasModifier(store.getCombo('commandPalette'))) return
        e.preventDefault()
        setShowCommandPalette(v => !v)
        return
      }

      // Toggle sidebar
      if (store.matchEvent('toggleSidebar', e)) {
        if (inInput && !hasModifier(store.getCombo('toggleSidebar'))) return
        e.preventDefault()
        const state = useProjectStore.getState()
        state.setSidebarVisible(!state.sidebarVisible)
        return
      }

      // Cycle view mode
      if (store.matchEvent('cycleViewMode', e)) {
        if (inInput && !hasModifier(store.getCombo('cycleViewMode'))) return
        e.preventDefault()
        const state = useProjectStore.getState()
        const next = state.viewMode === 'editor' ? 'both' : state.viewMode === 'both' ? 'graph' : 'editor'
        state.setViewMode(next)
        toast(`Switched to ${next} view`, 'info', 1500)
        return
      }

      // Create project
      if (store.matchEvent('createProject', e)) {
        if (inInput && !hasModifier(store.getCombo('createProject'))) return
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
        createTimelinePage: { type: 'timeline', label: 'Timeline', icon: 'timeline' },
      }

      for (const def of SHORTCUT_DEFS) {
        if (def.category === 'page-creation' && store.matchEvent(def.id, e)) {
          if (inInput && !hasModifier(store.getCombo(def.id))) continue
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

export default App
