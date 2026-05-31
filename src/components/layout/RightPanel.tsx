import { useProjectStore } from '../../stores/projectStore'
import { GraphCanvas } from '../workspace/GraphCanvas'
import { Tooltip } from '../Tooltip'
import { platformShortcut } from '../../stores/shortcutStore'

export function RightPanel() {
  const { activeProjectId, viewMode, setViewMode, sidebarVisible, setSidebarVisible } = useProjectStore()

  return (
    <aside className="flex-shrink-0 flex flex-col h-full w-full border-l border-outline/30 shadow-[-2px_0_15px_rgba(0,0,0,0.3)] bg-surface/30 backdrop-blur-md z-30">
      <div className="h-14 border-b border-outline/10 flex items-center px-4 justify-between">
        <span className="font-headline-sm text-[13px] font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">grain</span>
          Graph View
        </span>
        <div className="flex items-center gap-2">
          {viewMode === 'graph' && (
            <div className="flex items-center bg-surface border border-outline/10 rounded-full p-0.5 mr-2 shadow-sm">
              <Tooltip label="Editor only" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
              <button
                onClick={() => setViewMode('editor')}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${(viewMode as string) === 'editor' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                <span className="material-symbols-outlined text-[14px]">edit</span>
              </button>
              </Tooltip>
              <Tooltip label="Editor and Graph" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
              <button
                onClick={() => setViewMode('both')}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${(viewMode as string) === 'both' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                <span className="material-symbols-outlined text-[14px]">view_sidebar</span>
              </button>
              </Tooltip>
              {/* Sidebar toggle */}
              <Tooltip label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'} shortcut={platformShortcut('Ctrl+\\')} position="bottom">
                <button
                  onClick={() => setSidebarVisible(!sidebarVisible)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    sidebarVisible
                      ? 'text-on-surface-variant hover:bg-surface-variant/50'
                      : 'bg-primary text-on-primary shadow-sm'
                  }`}
                >
                  <span className="material-symbols-outlined text-[14px]">
                    {sidebarVisible ? 'menu_open' : 'menu'}
                  </span>
                </button>
              </Tooltip>
              <Tooltip label="Graph only" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
              <button
                onClick={() => setViewMode('graph')}
                className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${viewMode === 'graph' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant/50'}`}
              >
                <span className="material-symbols-outlined text-[14px]">grain</span>
              </button>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 relative p-0">
        {activeProjectId ? (
           <GraphCanvas projectId={activeProjectId} />
        ) : (
           <div className="w-full h-full flex flex-col items-center justify-center text-on-surface-variant/50 px-4 gap-2">
            <span className="material-symbols-outlined text-[32px] text-on-surface-variant/30">grain</span>
            <span className="text-sm text-center">Graph is disabled for standalone pages</span>
            <span className="text-xs text-on-surface-variant/30 text-center">Open a project to view the graph</span>
          </div>
        )}
      </div>
    </aside>
  )
}
