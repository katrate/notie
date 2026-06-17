import { useProjectStore } from '../../stores/projectStore'
import { GraphCanvas } from '../workspace/GraphCanvas'

export function RightPanel() {
  const { activeProjectId } = useProjectStore()

  return (
    <aside className="flex-shrink-0 flex flex-col h-full w-full border-l border-outline/30 shadow-[-2px_0_15px_rgba(0,0,0,0.3)] bg-surface/30 backdrop-blur-md z-30">
      <div className="h-10 border-b border-outline/10 flex items-center px-4 justify-between">
        <span className="font-headline-sm text-[13px] font-semibold flex items-center gap-2">
          <span className="material-symbols-outlined text-[16px] text-primary">grain</span>
          Graph View
        </span>
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
