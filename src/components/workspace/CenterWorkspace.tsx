import { useEffect, useState, useRef, useLayoutEffect, Fragment } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useCommandStore } from '../../stores/commandStore';
import { DocumentEditor } from './DocumentEditor';
import { EditableTable } from './EditableTable';
import { BoardView } from './BoardView';
import { CanvasView } from './CanvasView';
import { ChartView } from './ChartView';
import { GalleryView } from './GalleryView';
import { DashboardView } from './DashboardView';
import { FolderView } from './FolderView';
import { ChecklistView } from './ChecklistView';
import { AudioView } from './AudioView';
import { VideoView } from './VideoView';
import { FileView } from './FileView';
import { TextControlPanel } from './TextControlPanel';
import { LinkPageDropdown } from './LinkPageDropdown';
import { CreatePagePanel } from '../layout/CreatePagePanel';

import { Tooltip } from '../Tooltip';
import { platformShortcut } from '../../stores/shortcutStore';
import { SettingsModal } from '../settings/SettingsModal';
import { EditorSkeleton } from '../ui/Skeleton';
import { TemplateActions } from './TemplateActions';

export function CenterWorkspace() {
  const {
    projects,
    pages,
    activeProjectId,
    activePageId,
    updatePage,
    loading,
    error,
  } = useProjectStore();

       const [showIconPicker, setShowIconPicker] = useState(false);
       const [iconPickerPos, setIconPickerPos] = useState<{ left: number; top: number } | null>(null);
       const iconBtnRef = useRef<HTMLButtonElement>(null);
       const [showCreatePage, setShowCreatePage] = useState(false);
        const [editorInstance, setEditorInstance] = useState<any>(null);
       const [pageTitleDraft, setPageTitleDraft] = useState('');
       const [pageTitleError, setPageTitleError] = useState('');
       const iconOptions = ['article', 'grid_on', 'dashboard', 'bar_chart', 'checklist', 'photo_library', 'storage', 'code', 'public', 'folder', 'menu_book', 'star', 'favorite', 'gesture', 'draw', 'brush', 'mic', 'videocam', 'folder'];
      
      // Icon mapping – using Material Symbols (you can replace with any icon library you prefer)

  const getDisplayIcon = (icon: string | undefined): string => {
    if (!icon) return 'description';
    if (icon === '📁') return 'folder';
    if (icon === '📄') return 'description';
    return icon; // assume it's already a Material Symbols name
  };

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activePage = pages.find(p => p.id === activePageId);



   const iconPickerRef = useRef<HTMLDivElement>(null);

   // Compute icon picker position for fixed dropdown
   useLayoutEffect(() => {
     if (!showIconPicker || !iconBtnRef.current) {
       setIconPickerPos(null);
       return;
     }
     const rect = iconBtnRef.current.getBoundingClientRect();
     setIconPickerPos({ left: rect.left, top: rect.bottom + 4 });
   }, [showIconPicker]);

   // Click-outside handler for icon picker
   useEffect(() => {
     if (!showIconPicker) return;
     const handler = (e: MouseEvent) => {
       if (
         (iconBtnRef.current && iconBtnRef.current.contains(e.target as Node)) ||
         (iconPickerRef.current && iconPickerRef.current.contains(e.target as Node))
       ) { return; }
       setShowIconPicker(false);
       setIconPickerPos(null);
     };
     document.addEventListener('mousedown', handler);
     return () => document.removeEventListener('mousedown', handler);
   }, [showIconPicker]);

   // Sync page title draft when active page changes
   useEffect(() => {
     if (activePage) {
       setPageTitleDraft(activePage.title || '');
       setPageTitleError('');
     }
   }, [activePage?.id]);

  if (loading) {
    return <EditorSkeleton />;
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background text-error">
        {error}
      </div>
    );
  }

  if (!activeProject && !activePageId) {
    return (
      <div className="flex-1 flex flex-col h-full items-center justify-center bg-background">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
            <span className="material-symbols-outlined text-[48px] text-primary">note_stack</span>
          </div>
          <h2 className="text-2xl font-bold text-on-surface mb-2">Welcome to Notie</h2>
          <p className="text-sm text-on-surface-variant/70 mb-8 leading-relaxed">
            Create your first project to start organizing notes, tables, boards, and more.
          </p>
          <button
            onClick={() => {
              const store = useProjectStore.getState();
              store.createProject('My first project');
            }}
            className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-semibold transition-all shadow-lg hover:shadow-xl active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, white))', color: '#000' }}
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            Create Your First Project
          </button>
          <p className="mt-4 text-xs text-on-surface-variant/50">
            or press <kbd className="px-1.5 py-0.5 rounded bg-surface-variant text-on-surface-variant text-[10px] font-mono">Ctrl+P</kbd> to open command palette
          </p>
        </div>
      </div>
    );
  }

     if (!activePageId) {
      return <DashboardView />;
    }

  // Standalone page flag — no project context
  const isStandalone = !!activePageId && !activeProjectId;

  function renderContent() {
    switch (activePage?.type) {
      case 'table':
        return <EditableTable />;
      case 'board':
        return <BoardView />;
      case 'chart':
        return <ChartView />;
      case 'gallery':
        return <GalleryView />;
      case 'dashboard':
        return <DashboardView />;
      case 'folder':
        return <FolderView />;
      case 'checklist':
        return <ChecklistView />;
      case 'audio':
        return <AudioView />;
      case 'video':
        return <VideoView />;
      case 'file':
        return <FileView />;
      case 'canvas':
        return <CanvasView />;
      default:
        return <DocumentEditor pageId={activePageId as string} projectId={activeProjectId || undefined} initialContent={activePage?.content} onEditorReady={setEditorInstance} />;
    }
  }

     return (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <HeaderBar />

         {/* Main content area */}          <main className="flex-1 overflow-y-auto relative flex flex-col">
           {/* For canvas: compact header + full-width canvas */}
           {activePage?.type === 'canvas' ? (
             <>
               <div className="max-w-5xl mx-auto w-full px-6 lg:px-8 pt-6 lg:pt-8 pb-3">
                 <div className="flex items-center gap-3">
                   <button
                     ref={iconBtnRef}
                     onClick={() => setShowIconPicker(!showIconPicker)}
                     className="p-2 rounded-lg hover:bg-surface/50 text-on-surface-variant hover:text-on-surface transition-colors"
                   >
                     <span className="material-symbols-outlined">{getDisplayIcon(activePage?.icon)}</span>
                   </button>
                   {showIconPicker && iconPickerPos && createPortal(
                     <div
                       ref={iconPickerRef}
                       className="bg-surface border border-outline/10 shadow-xl rounded-lg p-3 w-64"
                       style={{ position: 'fixed', left: iconPickerPos.left + 'px', top: iconPickerPos.top + 'px', zIndex: 9999 }}
                     >
                       <div className="text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-wider">Choose Icon</div>
                       <div className="flex flex-wrap gap-2">
                         {iconOptions.map(iconName => (
                           <button
                             key={iconName}
                             onClick={() => {
                               if (activePageId) updatePage(activePageId, { icon: iconName });
                               setShowIconPicker(false);
                             }}
                             className={`p-2 rounded-md transition-colors ${getDisplayIcon(activePage?.icon) === iconName ? 'bg-primary/20 text-primary' : 'text-on-surface hover:bg-on-surface/10'}`}
                           >
                             <span className="material-symbols-outlined">{iconName}</span>
                           </button>
                         ))}
                       </div>
                     </div>,
                     document.body
                   )}
                   <div className="flex-1">
                     <input
                       type="text"
                       value={pageTitleDraft}
                       onChange={(e) => { setPageTitleDraft(e.target.value); setPageTitleError(''); }}                         onBlur={() => {
                             if (!activePageId) return;
                             const trimmed = pageTitleDraft.trim();
                             if (!trimmed) { setPageTitleDraft(activePage?.title || ''); return; }
                             const duplicate = !isStandalone && activeProjectId && pages.some(p => p.project_id === activeProjectId && p.id !== activePageId && p.title.toLowerCase() === trimmed.toLowerCase());
                             if (duplicate) {
                               setPageTitleError(`"${trimmed}" is already used by another page`);
                               setPageTitleDraft(activePage?.title || '');
                               return;
                             }
                             updatePage(activePageId, { title: trimmed });
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                             if (e.key === 'Escape') { setPageTitleDraft(activePage?.title || ''); setPageTitleError(''); }
                           }}
                           placeholder={activeProject?.name || 'Untitled'}
                           className="text-2xl font-bold text-on-surface outline-none bg-transparent w-full"
                     />
                     {pageTitleError && (
                       <p className="text-xs text-error mt-1">{pageTitleError}</p>
                     )}
                   </div>
                  {activePage?.project_id && (
                  <div className="flex-shrink-0 relative">
                    <LinkPageDropdown
                      editor={null}
                      activePageId={activePageId}
                      projectId={activePage.project_id!}
                    />
                  </div>
                )}
                   <div className="flex-shrink-0 relative">
                     <TemplateActions pageId={activePageId} />
                   </div>
                 </div>
                 {activePageId && activeProjectId && <PageTagsBar pageId={activePageId} projectId={activeProjectId} />}
               </div>
               {/* Full-width canvas */}
               <div className="px-6 lg:px-8 pb-6 flex-1 min-h-[500px]">
                 <CanvasView />
               </div>
             </>              ) : (
             <div className="p-6 lg:p-8 flex flex-col flex-1 min-h-0">
               <div className="max-w-5xl mx-auto w-full flex flex-col flex-1 min-h-0">
                 {/* Text Control Panel placed exactly between breadcrumbs header and page title */}
                 {(activePage?.type === 'text' || !activePage?.type) && activePageId && (
                   <TextControlPanel editor={editorInstance} />
                 )}

                 <div className="flex items-center gap-3 mb-6 relative mt-2">
                   {activePage?.type === 'dashboard' ? (
                     <>
                       <span className="material-symbols-outlined text-on-surface-variant">dashboard_customize</span>
                       <h1 className="text-4xl font-bold text-on-surface">Dashboard</h1>
                     </>
                   ) : (
                     <>
                       <button
                         ref={iconBtnRef}
                         onClick={() => setShowIconPicker(!showIconPicker)}
                         className="p-2 rounded-lg hover:bg-surface/50 text-on-surface-variant hover:text-on-surface transition-colors"
                       >
                         <span className="material-symbols-outlined">{getDisplayIcon(activePage?.icon)}</span>
                       </button>
                       
                       {showIconPicker && iconPickerPos && createPortal(
                         <div
                           ref={iconPickerRef}
                           className="bg-surface border border-outline/10 shadow-xl rounded-lg p-3 w-64"
                           style={{ position: 'fixed', left: iconPickerPos.left + 'px', top: iconPickerPos.top + 'px', zIndex: 9999 }}
                         >
                           <div className="text-xs font-medium text-on-surface-variant mb-2 uppercase tracking-wider">Choose Icon</div>
                           <div className="flex flex-wrap gap-2">
                             {iconOptions.map(iconName => (
                               <button
                                 key={iconName}
                                 onClick={() => {
                                   if (activePageId) updatePage(activePageId, { icon: iconName });
                                   setShowIconPicker(false);
                                 }}
                                 className={`p-2 rounded-md transition-colors ${getDisplayIcon(activePage?.icon) === iconName ? 'bg-primary/20 text-primary' : 'text-on-surface hover:bg-on-surface/10'}`}
                               >
                                 <span className="material-symbols-outlined">{iconName}</span>
                               </button>
                             ))}
                           </div>
                         </div>,
                         document.body
                       )}
                       
                       <div>
                         <input
                           type="text"
                           value={pageTitleDraft}
                           onChange={(e) => { setPageTitleDraft(e.target.value); setPageTitleError(''); }}
                           onBlur={() => {
                             if (!activePageId) return;
                             const trimmed = pageTitleDraft.trim();
                             if (!trimmed) { setPageTitleDraft(activePage?.title || ''); return; }
                             const duplicate = !isStandalone && activeProjectId && pages.some(p => p.project_id === activeProjectId && p.id !== activePageId && p.title.toLowerCase() === trimmed.toLowerCase());
                             if (duplicate) {
                               setPageTitleError(`"${trimmed}" is already used by another page`);
                               setPageTitleDraft(activePage?.title || '');
                               return;
                             }
                             updatePage(activePageId, { title: trimmed });
                           }}
                           onKeyDown={(e) => {
                             if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                             if (e.key === 'Escape') { setPageTitleDraft(activePage?.title || ''); setPageTitleError(''); }
                           }}
                           placeholder={activeProject?.name || 'Untitled'}
                           className="text-4xl font-bold text-on-surface outline-none bg-transparent w-full"
                         />
                         {pageTitleError && (
                           <p className="text-xs text-error mt-1">{pageTitleError}</p>
                         )}
                       </div>
                     </>
                   )}

                  {activePageId && activePage?.project_id && activePage?.type !== 'dashboard' && (
                    <div className="flex-shrink-0 relative">
                      <LinkPageDropdown
                        editor={(activePage?.type === 'text' || !activePage?.type) ? editorInstance : null}
                        activePageId={activePageId}
                        projectId={activePage.project_id!}
                      />
                    </div>
                  )}
                   {activePageId && activePage?.project_id && ['board', 'gallery'].includes(activePage?.type || '') && (
                     <div className="flex-shrink-0 relative">
                       <GraphSortModeToggle
                         pageId={activePageId}
                         currentMode={activePage?.metadata?.sortMode || 'default'}
                       />
                     </div>
                   )}
                   {activePageId && activePage?.type !== 'dashboard' && (
                     <div className="flex-shrink-0 relative ml-auto">
                       <TemplateActions pageId={activePageId} />
                     </div>
                   )}
                 </div>

                 {/* Tags */}
                 {activePageId && activeProjectId && <PageTagsBar pageId={activePageId} projectId={activeProjectId} />}

                 {renderContent()}
                 {/* Register editor for graph link insertion */}
                 {activePageId && activePage?.project_id && (
                   <GraphEditorBridge editorInstance={editorInstance} />
                 )}
               </div>
             </div>
           )}
          </main>
          
           {/* Create Page Panel */}
           {showCreatePage && activeProjectId && <CreatePagePanel onClose={() => setShowCreatePage(false)} projectId={activeProjectId} />}
        </div>
     );
}

/** Tag bar shown below the page title */
function PageTagsBar({ pageId, projectId }: { pageId: string; projectId: string }) {
  const projects = useProjectStore(s => s.projects);
  const pages = useProjectStore(s => s.pages);
  const { updatePage } = useProjectStore();

  const project = projects.find(p => p.id === projectId);
  const page = pages.find(p => p.id === pageId);
  const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];
  const pageTags: string[] = page?.metadata?.tags || [];

  if (projectTags.length === 0) return null;

  const toggleTag = (tagName: string) => {
    if (!page) return;
    const current: string[] = page.metadata?.tags || [];
    const updated = current.includes(tagName)
      ? current.filter(t => t !== tagName)
      : [...current, tagName];
    updatePage(pageId, { metadata: { ...(page.metadata || {}), tags: updated } });
  };

  return (
    <div className="flex items-center gap-1.5 mb-4 flex-wrap relative">
      {projectTags.map(tag => {
        const active = pageTags.includes(tag.name);
        return (
          <button
            key={tag.name}
            onClick={() => toggleTag(tag.name)}
            className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
            style={{
              backgroundColor: active ? `${tag.color}25` : 'transparent',
              color: active ? tag.color : 'var(--on-surface-variant)',
              border: `1px solid ${active ? tag.color : 'var(--outline)'}`,
              opacity: active ? 1 : 0.5,
            }}
          >
            {active && '✓ '}#{tag.name}
          </button>
        );
      })}
    </div>
  );
}

/** Graph sort mode toggle for board/gallery/table pages */
function GraphSortModeToggle({ pageId, currentMode }: { pageId: string; currentMode: string }) {
  const updatePage = useProjectStore(s => s.updatePage);
  const pages = useProjectStore(s => s.pages);
  const [showDropdown, setShowDropdown] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const page = pages.find(p => p.id === pageId);

  useLayoutEffect(() => {
    if (!showDropdown || !btnRef.current) {
      setDropdownPos(null);
      return;
    }
    const rect = btnRef.current.getBoundingClientRect();
    setDropdownPos({ left: rect.right - 130, top: rect.bottom + 4 });
  }, [showDropdown]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        (btnRef.current && btnRef.current.contains(e.target as Node)) ||
        (dropdownRef.current && dropdownRef.current.contains(e.target as Node))
      ) { return; }
      setShowDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const setSortMode = async (mode: string) => {
    if (!page) return;
    await updatePage(pageId, {
      metadata: { ...(page.metadata || {}), sortMode: mode },
    });
    setShowDropdown(false);
  };

  return (
    <div>
      <Tooltip label="Graph sort mode">
        <button
          ref={btnRef}
          onClick={() => setShowDropdown(!showDropdown)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all ${
            currentMode === 'tags'
              ? 'bg-purple-500/15 border-purple-500/30 text-purple-400'
              : 'bg-surface/50 border-outline/20 text-on-surface-variant hover:border-primary/30 hover:text-primary'
          }`}
        >
          <span className="material-symbols-outlined text-[14px]">sort</span>
          <span className="hidden lg:inline">{currentMode === 'tags' ? 'By Tags' : 'Default'}</span>
        </button>
      </Tooltip>
      {showDropdown && dropdownPos && createPortal(
        <div
          ref={dropdownRef}
          className="bg-surface border border-outline/20 rounded-lg shadow-xl py-1 min-w-[130px]"
          style={{ position: 'fixed', left: dropdownPos.left + 'px', top: dropdownPos.top + 'px', zIndex: 9999 }}
        >
          <button
            onClick={() => setSortMode('default')}
            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2 ${
              currentMode === 'default' ? 'text-primary bg-primary/5' : 'text-on-surface hover:bg-surface/50'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">view_list</span>
            Default
          </button>
          <button
            onClick={() => setSortMode('tags')}
            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors flex items-center gap-2 ${
              currentMode === 'tags' ? 'text-purple-400 bg-purple-500/5' : 'text-on-surface hover:bg-surface/50'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">local_offer</span>
            By Tags
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

/** Internal component that registers the editor's insertPageLink callback on the store */
function GraphEditorBridge({ editorInstance }: { editorInstance: any }) {
  const setGraphEditorInsert = useProjectStore(s => s.setGraphEditorInsert);

  useEffect(() => {
    if (editorInstance && editorInstance.commands) {
      const insertFn = (targetPageId: string, targetTitle: string, targetIcon: string) => {
        editorInstance.commands.insertPageLink({
          pageId: targetPageId,
          pageTitle: targetTitle,
          pageIcon: targetIcon,
        });
      };
      setGraphEditorInsert(insertFn);
    }
    return () => {
      setGraphEditorInsert(null);
    };
  }, [editorInstance, setGraphEditorInsert]);

  return null;
}

/** Shared header bar with breadcrumbs */
function HeaderBar() {
  const projects = useProjectStore(s => s.projects);
  const pages = useProjectStore(s => s.pages);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const activePageId = useProjectStore(s => s.activePageId);
  const viewMode = useProjectStore(s => s.viewMode);
  const setViewMode = useProjectStore(s => s.setViewMode);
  const setActivePage = useProjectStore(s => s.setActivePage);

  const activeProject = projects.find(p => p.id === activeProjectId);
  const activePage = pages.find(p => p.id === activePageId);

  return (
    <>
      <header className="h-14 border-b border-outline/10 flex items-center px-6 justify-between backdrop-blur-md bg-surface/30 sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto whitespace-nowrap hide-scrollbar">
          <span className="text-on-surface-variant text-sm flex-shrink-0">Projects</span>
          {activeProject && (
            <>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant flex-shrink-0">chevron_right</span>
              <span className="text-on-surface text-sm font-medium flex-shrink-0">{activeProject.name}</span>
            </>
          )}
          {!activeProject && activePage && (
            <>
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant flex-shrink-0">chevron_right</span>
              <span className="text-on-surface-variant text-sm flex-shrink-0">Standalone</span>
            </>
          )}
          {activePage && (() => {
            const breadcrumbs = [];
            let current: any = activePage;
            while (current) {
              breadcrumbs.unshift(current);
              current = pages.find(p => p.id === current?.metadata?.parentId);
            }
            return breadcrumbs.map((crumb, index) => (
              <Fragment key={crumb.id}>
                <span className="material-symbols-outlined text-[14px] text-on-surface-variant flex-shrink-0">chevron_right</span>
                <button
                  onClick={() => setActivePage(crumb.id)}
                  className={`text-sm hover:text-primary transition-colors flex-shrink-0 truncate max-w-[150px] ${index === breadcrumbs.length - 1 ? 'text-on-surface font-medium' : 'text-on-surface-variant'}`}
                >
                  {crumb.title}
                </button>
              </Fragment>
            ));
          })()}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center bg-surface-variant/30 border border-outline/5 rounded-full p-0.5 shadow-inner">
            {/* View mode toggle — hidden for standalone pages */}
            {activeProjectId && (
              <>
                <Tooltip label="Editor only" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
                <button
                  onClick={() => setViewMode('editor')}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${viewMode === 'editor' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-[14px]">edit</span>
                </button>
                </Tooltip>
                <Tooltip label="Editor and Graph" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
                <button
                  onClick={() => setViewMode('both')}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${viewMode === 'both' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-[14px]">view_sidebar</span>
                </button>
                </Tooltip>
                <Tooltip label="Graph only" shortcut={platformShortcut('Ctrl+Alt+V')} position="bottom">
                <button
                  onClick={() => setViewMode('graph')}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${viewMode === 'graph' ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-variant'}`}
                >
                  <span className="material-symbols-outlined text-[14px]">grain</span>
                </button>
                </Tooltip>
              </>
            )}
            {/* Toggle left panel */}
            <SidebarToggleButton />
          </div>
        </div>
      </header>
      {/* Command-store triggered settings modal */}
      <SettingsModalBridge />
    </>
  );
}

/** Toggle button to show/hide the left sidebar */
function SidebarToggleButton() {
  const sidebarVisible = useProjectStore(s => s.sidebarVisible);
  const setSidebarVisible = useProjectStore(s => s.setSidebarVisible);

  return (
    <Tooltip label={sidebarVisible ? 'Hide sidebar' : 'Show sidebar'} shortcut={platformShortcut('Ctrl+\\')} position="bottom">
      <button
        onClick={() => setSidebarVisible(!sidebarVisible)}
        className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
          sidebarVisible
            ? 'text-on-surface-variant hover:bg-surface-variant'
            : 'bg-primary text-on-primary shadow-sm'
        }`}
      >
        <span className="material-symbols-outlined text-[14px]">
          {sidebarVisible ? 'menu_open' : 'menu'}
        </span>
      </button>
    </Tooltip>
  );
}

/** Bridge that listens for command-store signal to open the settings modal */
function SettingsModalBridge() {
  const { openSettingsModal, setOpenSettingsModal } = useCommandStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (openSettingsModal) {
      setOpen(true)
      setOpenSettingsModal(false)
    }
  }, [openSettingsModal, setOpenSettingsModal])

  return open ? <SettingsModal onClose={() => setOpen(false)} /> : null
}
