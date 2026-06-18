import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import { CenterWorkspace } from '../workspace/CenterWorkspace'
import { useProjectStore } from '../../stores/projectStore'
import { Panel, Group, Separator } from 'react-resizable-panels'
import { Tooltip } from '../Tooltip'
import { platformShortcut } from '../../stores/shortcutStore'
import type { ViewMode } from '../../stores/projectStore'
import { useThemeStore } from '../../stores/themeStore'

function ViewModeToggle() {
  const { viewMode, setViewMode, activeProjectId, sidebarVisible, setSidebarVisible } = useProjectStore()
  const { themeMode, setThemeMode } = useThemeStore()

  if (!activeProjectId) return null

  const modes: { mode: ViewMode; icon: string; label: string }[] = [
    { mode: 'editor', icon: 'edit_note', label: 'Editor' },
    { mode: 'both', icon: 'view_sidebar', label: 'Both' },
    { mode: 'graph', icon: 'grain', label: 'Graph' },
  ]

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 flex items-center bg-surface/80 border border-outline/15 rounded-full p-0.5 gap-0.5 shadow-lg backdrop-blur-xl">
      {/* Sidebar toggle */}
      <Tooltip label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'} shortcut={platformShortcut('Ctrl+\\')} position="bottom">
        <button
          onClick={() => setSidebarVisible(!sidebarVisible)}
          className={`flex items-center justify-center w-6 h-6 rounded-full text-[13px] transition-all duration-200 ${
            sidebarVisible
              ? 'text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-variant/30'
              : 'bg-primary/20 text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[13px]">
            {sidebarVisible ? 'side_navigation' : 'menu'}
          </span>
        </button>
      </Tooltip>

      {/* Divider */}
      <div className="w-px h-4 bg-outline/15 mx-0.5" />

      {/* View mode buttons */}
      {modes.map(({ mode, icon, label }) => {
        const active = viewMode === mode
        return (
          <Tooltip key={mode} label={label} shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
            <button
              onClick={() => setViewMode(mode)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all duration-200 ${
                active
                  ? 'bg-primary/20 text-primary'
                  : 'text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-variant/30'
              }`}
            >
              <span className={`material-symbols-outlined text-[13px]`}>{icon}</span>
              <span className="hidden md:inline">{label}</span>
            </button>
          </Tooltip>
        )
      })}

      {/* Divider */}
      <div className="w-px h-4 bg-outline/15 mx-0.5" />

      {/* Theme toggle */}
      <Tooltip label={themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} position="bottom">
        <button
          onClick={() => setThemeMode(themeMode === 'dark' ? 'light' : 'dark')}
          className="flex items-center justify-center w-6 h-6 rounded-full text-[13px] text-on-surface-variant/50 hover:text-on-surface-variant hover:bg-surface-variant/30 transition-all duration-200"
        >
          <span className="material-symbols-outlined text-[13px]">
            {themeMode === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
      </Tooltip>
    </div>
  )
}

export function MainLayout() {
  const { viewMode, sidebarVisible, activeProjectId } = useProjectStore()

  return (
    <div className="flex h-screen w-screen overflow-hidden relative">
      <ViewModeToggle />
      <Group orientation="horizontal">
        {/* Left Sidebar */}
        {sidebarVisible && (
          <>
            <Panel id="sidebar" defaultSize="256px" minSize="180px" maxSize="400px" groupResizeBehavior="preserve-pixel-size">
              <Sidebar />
            </Panel>
            <Separator className="w-1 bg-outline/10 hover:bg-primary/50 active:bg-primary/70 transition-colors cursor-col-resize z-30" />
          </>
        )}

        {/* Center Main Workspace */}
        {viewMode !== 'graph' && (
          <Panel id="editor" minSize="250px">
            <div className={`flex flex-col relative z-0 min-w-0 h-full w-full ${activeProjectId ? 'pt-[44px]' : ''}`}>
              <CenterWorkspace />
            </div>
          </Panel>
        )}

        {viewMode === 'both' && (
          <Separator className="w-1 bg-outline/10 hover:bg-primary/50 active:bg-primary/70 transition-colors cursor-col-resize z-30" />
        )}

        {/* Right Graph Panel — only shows for project pages */}
        {viewMode !== 'editor' && activeProjectId && (
          <Panel id="graph" defaultSize={viewMode === 'both' ? '30%' : undefined} minSize="200px">
            <RightPanel />
          </Panel>
        )}
      </Group>
    </div>
  )
}
