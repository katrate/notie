import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import MiniSearch from 'minisearch'
import { useProjectStore } from '../stores/projectStore'
import { useThemeStore } from '../stores/themeStore'
import { useCommandStore } from '../stores/commandStore'
import { useToastStore } from '../stores/toastStore'
import { useShortcutStore } from '../stores/shortcutStore'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively extract plain text from a TipTap JSON node */
function extractText(node: any): string {
  if (!node) return ''
  let text = ''
  if (node.text) text += node.text + ' '
  if (Array.isArray(node.content)) {
    for (const child of node.content) text += extractText(child)
  }
  return text
}

const PAGE_TYPE_ICON: Record<string, string> = {
  text:      'article',
  table:     'grid_on',
  board:     'dashboard',
  chart:     'bar_chart',
  gallery:   'photo_library',
  dashboard: 'dashboard_customize',
  folder:    'folder',
  checklist: 'checklist',
  canvas:    'gesture',
  audio:     'mic',
  video:     'videocam',
  file:      'description',
  project:   'folder',
}

// ── Action definitions ───────────────────────────────────────────────────────

interface ActionItem {
  id: string
  title: string
  subtitle?: string
  icon: string
  keywords: string
  section: string
  action: () => void
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface PageResult {
  id: string
  title: string
  projectId: string
  projectName: string
  type: string
  icon: string
}

type ViewState = 'default' | 'createProject'

interface CommandPaletteProps {
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const {
    projects,
    pages,
    activeProjectId,
    navigateToPage,
    createPage,
    createProject,
    setActiveProject,
    setViewMode,
    viewMode,
  } = useProjectStore()

  const { theme, setTheme } = useThemeStore()
  const { setOpenSettingsModal, setOpenSearchModal } = useCommandStore()
  const toast = useToastStore(s => s.toast)

  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const [viewState, setViewState] = useState<ViewState>('default')
  const [projectName, setProjectName] = useState('')
  const [creating, setCreating] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input on mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const t = setTimeout(() => inputRef.current?.focus(), 30)
    return () => clearTimeout(t)
  }, [])

  // ── MiniSearch index for pages & projects ──
  const miniSearch = useMemo(() => {
    const ms = new MiniSearch<{
      id: string
      title: string
      content: string
      projectId: string
      projectName: string
      type: string
      icon: string
    }>({
      fields: ['title', 'content', 'projectName'],
      storeFields: ['title', 'projectId', 'projectName', 'type', 'icon', 'content'],
      searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
    })

    const pageDocs = pages.map(page => {
      const project = projects.find(p => p.id === page.project_id)
      return {
        id: page.id,
        title: page.title || 'Untitled',
        content: extractText(page.content).slice(0, 1500),
        projectId:   page.project_id || '',
        projectName: project?.name ?? '',
        type: page.type ?? 'text',
        icon: page.icon || PAGE_TYPE_ICON[page.type ?? 'text'] || 'article',
      }
    })

    const projectDocs = projects.map(project => ({
      id: `proj-${project.id}`,
      title: project.name,
      content: project.description || '',
      projectId: project.id,
      projectName: project.name,
      type: 'project',
      icon: project.icon || 'folder',
    }))

    const allDocs = [...pageDocs, ...projectDocs]
    if (allDocs.length > 0) ms.addAll(allDocs)
    return ms
  }, [pages, projects])

  // ── Build action list dynamically ──
  const actions = useMemo((): ActionItem[] => {
    const activeProject = projects.find(p => p.id === activeProjectId)
    const hasActiveProject = !!activeProject

    const items: ActionItem[] = []

    // Creation actions (only if a project is active)
    if (hasActiveProject) {
      items.push(
        {
          id: 'create-text',
          title: 'Create Text Page',
          subtitle: 'New blank document',
          icon: 'article',
          keywords: 'new page text document create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Text', 'text', {}, 'article')
            onClose()
          },
        },
        {
          id: 'create-table',
          title: 'Create Table Page',
          subtitle: 'Spreadsheet-like grid',
          icon: 'grid_on',
          keywords: 'new page table spreadsheet grid create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Table', 'table', {}, 'grid_on')
            onClose()
          },
        },
        {
          id: 'create-board',
          title: 'Create Board Page',
          subtitle: 'Kanban-style columns',
          icon: 'dashboard',
          keywords: 'new page board kanban columns create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Board', 'board', {}, 'dashboard')
            onClose()
          },
        },
        {
          id: 'create-chart',
          title: 'Create Chart Page',
          subtitle: 'Visual data charts',
          icon: 'bar_chart',
          keywords: 'new page chart graph data create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Chart', 'chart', {}, 'bar_chart')
            onClose()
          },
        },
        {
          id: 'create-gallery',
          title: 'Create Gallery Page',
          subtitle: 'Image gallery layout',
          icon: 'photo_library',
          keywords: 'new page gallery images photos create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Gallery', 'gallery', {}, 'photo_library')
            onClose()
          },
        },
        {
          id: 'create-checklist',
          title: 'Create Checklist Page',
          subtitle: 'To-do and task list',
          icon: 'checklist',
          keywords: 'new page checklist todo tasks create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Checklist', 'checklist', {}, 'checklist')
            onClose()
          },
        },
        {
          id: 'create-folder',
          title: 'Create Folder Page',
          subtitle: 'Group child pages',
          icon: 'folder',
          keywords: 'new page folder group organize create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Folder', 'folder', {}, 'folder')
            onClose()
          },
        },
        {
          id: 'create-canvas',
          title: 'Create Canvas Page',
          subtitle: 'Free-form drawing canvas',
          icon: 'gesture',
          keywords: 'new page canvas draw sketch create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Canvas', 'canvas', {}, 'gesture')
            onClose()
          },
        },
        {
          id: 'create-audio',
          title: 'Create Audio Page',
          subtitle: 'Record and manage audio notes',
          icon: 'mic',
          keywords: 'new page audio record microphone create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Audio', 'audio', {}, 'mic')
            onClose()
          },
        },
        {
          id: 'create-file',
          title: 'Create Files Page',
          subtitle: 'Attach and manage system files',
          icon: 'description',
          keywords: 'new page files attachments attach system create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Files', 'file', {}, 'description')
            onClose()
          },
        },
        {
          id: 'create-video',
          title: 'Create Video Page',
          subtitle: 'Record and manage video notes',
          icon: 'videocam',
          keywords: 'new page video record camera create',
          section: 'Create',
          action: async () => {
            await createPage(activeProjectId!, 'Untitled Video', 'video', {}, 'videocam')
            onClose()
          },
        }
      )
    }

    // Always available actions
    items.push(
      {
        id: 'new-project',
        title: 'Create New Project',
        subtitle: 'New workspace with a dashboard',
        icon: 'add_box',
        keywords: 'new project workspace create',
        section: 'Actions',
        action: () => setViewState('createProject'),
      },
      {
        id: 'toggle-theme',
        title: theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
        subtitle: theme === 'dark' ? 'Light background theme' : 'Dark background theme',
        icon: theme === 'dark' ? 'light_mode' : 'dark_mode',
        keywords: 'theme dark light mode toggle switch appearance',
        section: 'Actions',
        action: () => {
          setTheme(theme === 'dark' ? 'light' : 'dark')
          toast(`Switched to ${theme === 'dark' ? 'light' : 'dark'} mode`, 'success', 2000)
          onClose()
        },
      },
      {
        id: 'toggle-view',
        title: `View: ${viewMode === 'editor' ? 'Editor' : viewMode === 'graph' ? 'Graph' : 'Both'}`,
        subtitle: viewMode === 'editor'
          ? 'Switch to split view'
          : viewMode === 'graph'
            ? 'Switch to editor view'
            : 'Switch to graph-only view',
        icon: viewMode === 'editor'
          ? 'view_sidebar'
          : viewMode === 'graph'
            ? 'edit'
            : 'grain',
        keywords: 'view editor graph layout toggle mode switch both split',
        section: 'Actions',
        action: () => {
          const next = viewMode === 'editor' ? 'both' : viewMode === 'both' ? 'graph' : 'editor'
          setViewMode(next)
          toast(`Switched to ${next} view`, 'info', 2000)
          onClose()
        },
      },
      {
        id: 'open-search',
        title: 'Open Search',
        subtitle: 'Full search modal',
        icon: 'search',
        keywords: 'search find lookup open',
        section: 'Actions',
        action: () => {
          setOpenSearchModal(true)
          onClose()
        },
      },
      {
        id: 'open-settings',
        title: 'Open Settings',
        subtitle: 'Account, appearance, shortcuts, templates',
        icon: 'settings',
        keywords: 'settings preferences account appearance configure',
        section: 'Actions',
        action: () => {
          setOpenSettingsModal(true)
          onClose()
        },
      }
    )

    return items
  }, [projects, activeProjectId, theme, viewMode, setTheme, setViewMode, setOpenSettingsModal, setOpenSearchModal, onClose, createPage, toast])

  // ── Filter actions by query ──
  const filteredActions = useMemo(() => {
    if (!query.trim()) return actions
    const q = query.toLowerCase()
    return actions.filter(a =>
      a.title.toLowerCase().includes(q) ||
      a.keywords.toLowerCase().includes(q) ||
      (a.subtitle && a.subtitle.toLowerCase().includes(q))
    )
  }, [actions, query])

  // ── Search results from MiniSearch ──
  const pageResults: PageResult[] = useMemo(() => {
    if (!query.trim()) return []
    const hits = miniSearch.search(query, { boost: { title: 3 }, prefix: true, fuzzy: 0.2 })
    // Limit results after search since MiniSearch types may not include limit
    return hits.slice(0, 8).map(r => ({
      id: r.id,
      title: r.title,
      projectId: r.projectId,
      projectName: r.projectName,
      type: r.type,
      icon: r.icon || PAGE_TYPE_ICON[r.type] || 'article',
    }))
  }, [query, miniSearch])

  // ── Flattened items list for keyboard navigation ──
  // We combine actions + pages into a single array
  const flatItems = useMemo(() => {
    const items: Array<{ kind: 'action'; item: ActionItem } | { kind: 'page'; item: PageResult }> = []
    for (const a of filteredActions) {
      items.push({ kind: 'action', item: a })
    }
    for (const p of pageResults) {
      items.push({ kind: 'page', item: p })
    }
    return items
  }, [filteredActions, pageResults])

  // Reset selection when results change
  useEffect(() => {
    setSelected(0)
  }, [query])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const el = listRef.current.querySelector(`[data-index="${selected}"]`) as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected])

  const activateItem = useCallback((index: number) => {
    const item = flatItems[index]
    if (!item) return
    if (item.kind === 'action') {
      item.item.action()
    } else {
      const { id, projectId } = item.item
      // If it's a project result (prefixed with proj-), set active project instead
      if (id.startsWith('proj-')) {
        setActiveProject(projectId)
      } else {
        navigateToPage(projectId, id)
      }
      onClose()
    }
  }, [flatItems, navigateToPage, setActiveProject, onClose])

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected(i => Math.min(i + 1, flatItems.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      activateItem(selected)
    } else if (e.key === 'Escape') {
      if (viewState === 'createProject') {
        setViewState('default')
        setProjectName('')
      } else {
        onClose()
      }
    }
  }

  // ── Create project handler ──
  const handleCreateProject = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const name = projectName.trim() || 'New Project'
    setCreating(true)
    await createProject(name)
    setCreating(false)
    setViewState('default')
    setProjectName('')
    onClose()
  }

  // ── Render: Create Project sub-view ──
  if (viewState === 'createProject') {
    return (
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center px-4"
        onClick={() => { setViewState('default'); setProjectName('') }}
      >
        <div
          className="w-full max-w-[420px] bg-surface border border-outline/20 rounded-2xl shadow-2xl"
          style={{ animation: 'searchPop 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-5 py-4 border-b border-outline/10">
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => { setViewState('default'); setProjectName('') }}
                className="p-1 rounded-lg hover:bg-on-surface/10 text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              </button>
              <span className="text-sm font-medium text-on-surface">Create New Project</span>
            </div>
            <form onSubmit={handleCreateProject}>
              <input
                autoFocus
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="Project name…"
                className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  type="button"
                  onClick={() => { setViewState('default'); setProjectName('') }}
                  className="px-4 py-1.5 rounded-lg text-xs text-on-surface-variant hover:bg-on-surface/10 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {creating ? (
                    <div className="w-3.5 h-3.5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[14px]">add</span>
                      Create
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
        <style>{`@keyframes searchPop { from { opacity: 0; transform: scale(0.95) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
      </div>
    )
  }

  // ── Render: Default view ──
  const showActions = filteredActions.length > 0
  const showPages = pageResults.length > 0
  const hasResults = showActions || showPages

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-start justify-center pt-[12vh] px-4 pb-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[540px] bg-surface border border-outline/20 rounded-2xl shadow-2xl overflow-hidden"
        style={{ animation: 'searchPop 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Input row ── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-outline/10">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant flex-shrink-0">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages, create pages, run actions…"
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/50 outline-none text-[15px]"
          />
          <ShortcutHint />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* ── Results list ── */}
        <div
          ref={listRef}
          className="max-h-[460px] overflow-y-auto"
        >
          {!hasResults && query ? (
            <div className="px-5 py-12 text-center text-on-surface-variant text-sm">
              <span className="material-symbols-outlined text-[32px] block mb-2 text-on-surface-variant/30">search_off</span>
              No results for &ldquo;<span className="text-on-surface font-medium">{query}</span>&rdquo;
            </div>
          ) : !hasResults && !query ? null : (
            <>
              {/* Actions section */}
              {showActions && (
                <>
                  <div className="px-5 pt-3 pb-1 text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[12px]">bolt</span>
                    Quick Actions
                  </div>
                  <div className="px-2 pb-1">
                    {filteredActions.map((action, i) => {
                      const globalIndex = i
                      return (
                        <button
                          key={action.id}
                          data-index={globalIndex}
                          onClick={() => activateItem(globalIndex)}
                          onMouseEnter={() => setSelected(globalIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selected === globalIndex ? 'bg-primary/10' : 'hover:bg-on-surface/5'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[18px] flex-shrink-0 transition-colors ${
                              selected === globalIndex ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            {action.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className={`text-[13px] font-body-md transition-colors ${
                              selected === globalIndex ? 'text-primary' : 'text-on-surface'
                            }`}>
                              {action.title}
                            </div>
                            {action.subtitle && (
                              <div className="text-[11px] text-on-surface-variant/60 truncate">{action.subtitle}</div>
                            )}
                          </div>
                          {selected === globalIndex && (
                            <span className="material-symbols-outlined text-[14px] text-primary/70 flex-shrink-0">arrow_forward</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Pages section */}
              {showPages && (
                <>
                  <div className="px-5 pt-1 pb-1 text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/60 flex items-center gap-2 border-t border-outline/5 mt-1">
                    <span className="material-symbols-outlined text-[12px]">article</span>
                    Pages & Projects
                  </div>
                  <div className="px-2 pb-2">
                    {pageResults.map((page, i) => {
                      const globalIndex = filteredActions.length + i
                      return (
                        <button
                          key={page.id}
                          data-index={globalIndex}
                          onClick={() => activateItem(globalIndex)}
                          onMouseEnter={() => setSelected(globalIndex)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                            selected === globalIndex ? 'bg-primary/10' : 'hover:bg-on-surface/5'
                          }`}
                        >
                          <span
                            className={`material-symbols-outlined text-[18px] flex-shrink-0 transition-colors ${
                              selected === globalIndex ? 'text-primary' : 'text-on-surface-variant'
                            }`}
                          >
                            {page.icon}
                          </span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[13px] font-body-md truncate transition-colors ${
                                selected === globalIndex ? 'text-primary' : 'text-on-surface'
                              }`}>
                                {page.title}
                              </span>
                              {page.projectName && (
                                <span className="flex-shrink-0 text-[10px] text-on-surface-variant/60 bg-surface-variant/50 px-1.5 py-0.5 rounded font-body-md">
                                  {page.projectName}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-on-surface-variant/40 px-1 truncate max-w-[60px]">
                            {page.type === 'project' ? 'Project' : page.type}
                          </span>
                          {selected === globalIndex && (
                            <span className="material-symbols-outlined text-[14px] text-primary/70 flex-shrink-0">arrow_forward</span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </>
          )}

          {/* Empty state (no query, no results) */}
          {!hasResults && !query && (
            <div className="px-5 py-8 text-center">
              <span className="material-symbols-outlined text-[36px] text-on-surface-variant/20 block mb-2">keyboard_command</span>
              <p className="text-xs text-on-surface-variant/50">
                Type to search pages or filter actions
              </p>
              <div className="flex items-center justify-center gap-4 mt-4 text-[11px] text-on-surface-variant/40">
                <span className="flex items-center gap-1">
                  <kbd className="bg-on-surface/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-outline/5">↑↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-on-surface/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-outline/5">↵</kbd>
                  select
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="bg-on-surface/10 px-1.5 py-0.5 rounded font-mono text-[10px] border border-outline/5">Esc</kbd>
                  close
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes searchPop { from { opacity: 0; transform: scale(0.95) translateY(-8px); } to { opacity: 1; transform: scale(1) translateY(0); } }`}</style>
    </div>
  )
}

/** Badge showing the keyboard shortcut to open the command palette (Ctrl+P / ⌘P) */
function ShortcutHint() {
  const shortcut = useShortcutStore(s => s.getDisplayString('commandPalette'))
  return (
    <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-on-surface/10 rounded text-[10px] text-on-surface-variant/60 font-mono">
      <span>{shortcut}</span>
    </kbd>
  )
}
