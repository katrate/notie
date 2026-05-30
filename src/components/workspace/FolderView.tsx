import { useMemo, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';

const PAGE_TYPE_ICONS: Record<string, string> = {
  text: 'article', table: 'grid_on', board: 'dashboard', chart: 'bar_chart',
  gallery: 'photo_library', checklist: 'checklist', folder: 'folder',
};

export function FolderView() {
  const pages = useProjectStore(s => s.pages);
  const activePageId = useProjectStore(s => s.activePageId);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActivePage = useProjectStore(s => s.setActivePage);
  const setViewMode = useProjectStore(s => s.setViewMode);
  const updatePage = useProjectStore(s => s.updatePage);

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const children = useMemo(() => {
    return pages.filter(p => p.metadata?.parentId === activePageId);
  }, [pages, activePageId]);

  const availablePages = useMemo(() => {
    const childIds = new Set(children.map(c => c.id));
    childIds.add(activePageId!);
    return pages.filter(p =>
      p.project_id === activeProjectId &&
      !childIds.has(p.id) &&
      p.type !== 'dashboard'
    );
  }, [pages, activeProjectId, activePageId, children]);

  const openPage = (id: string) => {
    setActivePage(id);
    setViewMode('both');
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const addSelected = async () => {
    for (const id of selectedIds) {
      await updatePage(id, { metadata: { ...(pages.find(p => p.id === id)?.metadata || {}), parentId: activePageId } });
    }
    setSelectedIds(new Set());
    setShowAddPanel(false);
  };

  return (
    <div className="flex-1 flex flex-col p-8 bg-surface/20 rounded-xl border border-outline/10 mx-6 my-6">
      <div className="flex items-center gap-3 mb-6">
        <span className="material-symbols-outlined text-[28px] text-amber-400">folder</span>
        <div>
          <h2 className="text-xl font-bold text-on-surface">Folder</h2>
          <p className="text-sm text-on-surface-variant/60">{children.length} items</p>
        </div>
        <div className="ml-auto">
          <button
            onClick={() => setShowAddPanel(!showAddPanel)}
            className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-all flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span className="hidden lg:inline">Add Pages</span>
          </button>
        </div>
      </div>

      {/* Add pages panel */}
      {showAddPanel && (
        <div className="mb-6 bg-surface/40 border border-outline/10 rounded-xl p-4 max-w-xl">
          <p className="text-xs font-semibold text-on-surface-variant mb-3">Select pages to add to this folder</p>
          {availablePages.length === 0 ? (
            <p className="text-xs text-on-surface-variant/40 py-2">No other pages available</p>
          ) : (
            <div className="space-y-1 max-h-48 overflow-y-auto mb-3">
              {availablePages.map(p => (
                <label
                  key={p.id}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface/30 transition-colors cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4 accent-primary rounded"
                  />
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60">
                    {PAGE_TYPE_ICONS[p.type || 'text'] || 'description'}
                  </span>
                  <span className="text-sm text-on-surface truncate">{p.title}</span>
                  <span className="text-[10px] text-on-surface-variant/40 ml-auto capitalize">{p.type || 'text'}</span>
                </label>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              onClick={addSelected}
              disabled={selectedIds.size === 0}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all disabled:opacity-30"
            >
              Add ({selectedIds.size})
            </button>
            <button onClick={() => setShowAddPanel(false)} className="px-4 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">
              Cancel
            </button>
          </div>
        </div>
      )}

      {children.length === 0 && !showAddPanel ? (
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/40">
          <span className="material-symbols-outlined text-[48px] mb-3">folder_open</span>
          <p className="text-sm font-medium">Empty folder</p>
          <p className="text-xs mt-1">Click "Add Pages" to add existing pages</p>
        </div>
      ) : (
        <div className="space-y-1 max-w-xl">
          {children.map(child => (
            <button
              key={child.id}
              onClick={() => openPage(child.id)}
              className="w-full text-left px-4 py-3 rounded-xl bg-surface/30 hover:bg-surface/50 border border-outline/5 hover:border-primary/20 transition-all flex items-center gap-3 group"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant/60">
                {PAGE_TYPE_ICONS[child.type || 'text'] || 'description'}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-on-surface truncate block">{child.title}</span>
                <span className="text-[10px] text-on-surface-variant/40 capitalize">{child.type || 'text'}</span>
              </div>
              <span className="text-[10px] text-on-surface-variant/40 opacity-0 group-hover:opacity-100 transition-opacity">Open</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}