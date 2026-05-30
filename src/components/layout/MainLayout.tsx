import { Sidebar } from './Sidebar'
import { RightPanel } from './RightPanel'
import { CenterWorkspace } from '../workspace/CenterWorkspace'
import { useProjectStore } from '../../stores/projectStore'
import { Panel, Group, Separator } from 'react-resizable-panels'

export function MainLayout() {
  const { viewMode, sidebarVisible } = useProjectStore()

  return (
    <div className="flex h-screen w-screen overflow-hidden">
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
            <div className="flex flex-col relative z-0 min-w-0 h-full w-full">
              <CenterWorkspace />
            </div>
          </Panel>
        )}

        {viewMode === 'both' && (
          <Separator className="w-1 bg-outline/10 hover:bg-primary/50 active:bg-primary/70 transition-colors cursor-col-resize z-30" />
        )}

        {/* Right Graph Panel */}
        {viewMode !== 'editor' && (
          <Panel id="graph" defaultSize={viewMode === 'both' ? '30%' : undefined} minSize="200px">
            <RightPanel />
          </Panel>
        )}
      </Group>
    </div>
  )
}
