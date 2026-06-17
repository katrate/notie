import { useMemo, useCallback, useState } from 'react';
import { ColorPicker } from './ColorPicker';
import { useProjectStore } from '../../stores/projectStore';


function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const isAllDay = d.getHours() === 0 && d.getMinutes() === 0;
  if (isAllDay) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function DashboardView() {
  const projects = useProjectStore(s => s.projects);
  const pages = useProjectStore(s => s.pages);
  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const setActivePage = useProjectStore(s => s.setActivePage);
  const setViewMode = useProjectStore(s => s.setViewMode);
  const updatePageContent = useProjectStore(s => s.updatePageContent);


  const project = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  const projectPages = useMemo(() => pages.filter(p => p.project_id === activeProjectId), [pages, activeProjectId]);

  const stats = useMemo(() => {
    const contentPages = projectPages.filter(p => p.type !== 'dashboard');
    const total = contentPages.length;
    const checklists = contentPages.filter(p => p.type === 'checklist');
    const boards = contentPages.filter(p => p.type === 'board');
    const galleries = contentPages.filter(p => p.type === 'gallery');
    const charts = contentPages.filter(p => p.type === 'chart');
    const tables = contentPages.filter(p => p.type === 'table');

    const allTasks = checklists.flatMap(c => (Array.isArray(c.content) ? c.content : []));
    const pendingTasks = allTasks.filter((t: any) => !t.completed).length;
    const galleryItems = galleries.reduce((sum, g) => sum + (Array.isArray(g.content) ? g.content.length : 0), 0);

    const pageTypes = [
      { label: 'Documents', value: String(contentPages.filter(p => p.type === 'text' || p.type === 'doc').length), icon: 'article', color: 'text-blue-400', bg: 'bg-blue-400/10' },
      { label: 'Boards', value: String(boards.length), icon: 'dashboard', color: 'text-amber-400', bg: 'bg-amber-400/10' },
      { label: 'Checklists', value: String(checklists.length), icon: 'checklist', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
      { label: 'Galleries', value: String(galleries.length), icon: 'photo_library', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
      { label: 'Charts', value: String(charts.length), icon: 'bar_chart', color: 'text-violet-400', bg: 'bg-violet-400/10' },
      { label: 'Tables', value: String(tables.length), icon: 'grid_on', color: 'text-rose-400', bg: 'bg-rose-400/10' },
    ].filter(t => t.value !== '0');

    return [
      { label: 'Total Pages', value: String(total), icon: 'description', color: 'text-blue-400', bg: 'bg-blue-400/10' },
      { label: 'Pending Tasks', value: String(pendingTasks), icon: 'checklist', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
      { label: 'Gallery Images', value: String(galleryItems), icon: 'photo_library', color: 'text-cyan-400', bg: 'bg-cyan-400/10' },
      ...pageTypes,
    ];
  }, [projectPages]);

  const priorityTasks = useMemo(() => {
    const checklists = projectPages.filter(p => p.type === 'checklist');
    const tasks: { task: any; pageId: string; pageTitle: string }[] = [];
    for (const page of checklists) {
      const items = Array.isArray(page.content) ? page.content : [];
      for (const t of items) {
        if (!t.completed) tasks.push({ task: t, pageId: page.id, pageTitle: page.title });
      }
    }
    tasks.sort((a, b) => {
      if (a.task.dueDate && !b.task.dueDate) return -1;
      if (!a.task.dueDate && b.task.dueDate) return 1;
      if (a.task.dueDate && b.task.dueDate) {
        const cmp = new Date(a.task.dueDate).getTime() - new Date(b.task.dueDate).getTime();
        if (cmp !== 0) return cmp;
      }
      return (a.task.priority || 3) - (b.task.priority || 3);
    });
    return tasks.slice(0, 3);
  }, [projectPages]);

  const toggleTask = useCallback((pageId: string, taskId: string) => {
    const page = pages.find(p => p.id === pageId);
    if (!page) return;
    const items = Array.isArray(page.content) ? [...page.content] : [];
    const updated = items.map((t: any) => t.id === taskId ? { ...t, completed: !t.completed } : t);
    updatePageContent(pageId, updated);
  }, [pages, updatePageContent]);

  const openPage = (id: string) => {
    setActivePage(id);
    setViewMode('both');
  };

  // ── Tag Management ──
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null);

  const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];

  const addTag = () => {
    const store = useProjectStore.getState();
    const name = newTagName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || projectTags.some(t => t.name === name)) return;
    const usedColors = new Set(projectTags.map(t => t.color));
    let color = '#6366f1';
    const palette = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#d946ef'];
    for (const c of palette) { if (!usedColors.has(c)) { color = c; break; } }
    store.addProjectTag(activeProjectId!, name, color);
    setNewTagName('');
  };

  const renameTag = (oldName: string) => {
    const store = useProjectStore.getState();
    const n = editTagName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!n || n === oldName) { setEditingTag(null); return; }
    if (projectTags.some(t => t.name === n)) return;
    const tag = projectTags.find(t => t.name === oldName);
    store.updateProjectTag(activeProjectId!, oldName, n, tag?.color || '#6366f1');
    setEditingTag(null);
  };

  const pagesByTag = useMemo(() => {
    const map = new Map<string, typeof projectPages>();
    for (const tag of projectTags) {
      const tagged = projectPages.filter(p => p.metadata?.tags?.includes(tag.name));
      if (tagged.length > 0) map.set(tag.name, tagged);
    }
    return map;
  }, [projectTags, projectPages]);

  const hasChecklists = projectPages.some(p => p.type === 'checklist');

  if (!project) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-center opacity-50">
          <span className="material-symbols-outlined text-[64px] block mb-4">space_dashboard</span>
          <p className="text-lg text-on-surface-variant">Select a project to view its dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-on-surface">{project.name}</h1>
          <p className="text-xs text-on-surface-variant/60">{projectPages.length} page{projectPages.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Compact stat pills */}
      {stats.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {stats.map((stat, i) => (
            <div key={i} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-outline/10 ${stat.bg}`}>
              <span className={`material-symbols-outlined text-[14px] ${stat.color}`}>{stat.icon}</span>
              <span className="text-xs font-semibold text-on-surface">{stat.value}</span>
              <span className="text-[10px] text-on-surface-variant/60">{stat.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Priority Tasks — only if checklists exist */}
        {hasChecklists && (
          <div className="bg-surface/40 border border-outline/10 rounded-xl p-4">
            <h3 className="text-xs font-bold text-on-surface mb-3 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-emerald-400">priority</span>
              Upcoming Tasks
            </h3>
            {priorityTasks.length === 0 ? (
              <p className="text-xs text-on-surface-variant/40 py-3 text-center">All tasks completed!</p>
            ) : (
              <div className="space-y-0.5">
                {priorityTasks.map(({ task, pageId, pageTitle }) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-surface/30 transition-colors group"
                  >
                    <button
                      onClick={() => toggleTask(pageId, task.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center transition-colors flex-shrink-0 ${
                        task.completed ? 'bg-primary text-on-primary' : 'border-2 border-on-surface-variant hover:border-primary'
                      }`}
                    >
                      {task.completed && <span className="material-symbols-outlined text-[11px]">check</span>}
                    </button>
                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      <span className={`text-xs font-medium truncate ${task.completed ? 'line-through text-on-surface-variant/50' : 'text-on-surface'}`}>
                        {task.text}
                      </span>
                      {task.priority && task.priority <= 5 && (
                        <span className={`px-1 py-0.5 rounded text-[8px] font-bold flex-shrink-0 ${
                          task.priority === 1 ? 'bg-red-500 text-white' :
                          task.priority === 2 ? 'bg-orange-500 text-white' :
                          task.priority === 3 ? 'bg-amber-500 text-white' :
                          task.priority === 4 ? 'bg-emerald-500 text-white' :
                          'bg-sky-500 text-white'
                        }`}>
                          P{task.priority}
                        </span>
                      )}
                    </div>
                    {task.dueDate && (
                      <span className={`text-[9px] whitespace-nowrap flex-shrink-0 ${new Date(task.dueDate) < new Date() ? 'text-error' : 'text-on-surface-variant/60'}`}>
                        {formatDate(task.dueDate)}
                      </span>
                    )}
                    <button
                      onClick={() => openPage(pageId)}
                      className="text-[9px] text-on-surface-variant/30 hover:text-primary transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                    >
                      {pageTitle}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}


      </div>

      {/* ── Tag Manager ── */}
      <div className="bg-surface/40 border border-outline/10 rounded-xl p-5">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">label</span>
            Tags
            <span className="text-[11px] text-on-surface-variant/60 font-normal">{projectTags.length} tags</span>
          </h3>
        </div>
        <p className="text-[11px] text-on-surface-variant/50 mb-4">Create and manage tags to assign to your pages.</p>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
            placeholder="New tag name..."
            className="flex-1 bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40 max-w-xs"
          />
          <button onClick={addTag} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span className="hidden lg:inline">Add Tag</span>
          </button>
        </div>

        <div className="space-y-3">
          {projectTags.length === 0 && (
            <p className="text-xs text-on-surface-variant/60 py-4 text-center">No tags defined yet. Create one above.</p>
          )}
          {projectTags.map(tag => (
            <div key={tag.name} className="bg-surface/30 border border-outline/10 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <button
                    onClick={() => setColorPickerTag(colorPickerTag === tag.name ? null : tag.name)}
                    className="w-7 h-7 rounded-lg border border-outline/20 hover:scale-110 transition-transform flex-shrink-0"
                    style={{ backgroundColor: tag.color }}
                    title="Change color"
                  />
                  {colorPickerTag === tag.name && (
                    <div className="absolute top-full left-0 mt-2 z-50">
                      <ColorPicker
                        value={tag.color}
                        onChange={(color) => {
                          const store = useProjectStore.getState();
                          store.updateProjectTag(activeProjectId!, tag.name, tag.name, color);
                        }}
                        onClose={() => setColorPickerTag(null)}
                      />
                    </div>
                  )}
                </div>
                {editingTag === tag.name ? (
                  <input
                    type="text"
                    value={editTagName}
                    onChange={e => setEditTagName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') renameTag(tag.name);
                      if (e.key === 'Escape') setEditingTag(null);
                    }}
                    onBlur={() => renameTag(tag.name)}
                    className="bg-surface border border-primary/50 rounded-lg px-2 py-1 text-sm text-on-surface outline-none"
                    autoFocus
                  />
                ) : (
                  <span
                    onClick={() => { setEditingTag(tag.name); setEditTagName(tag.name); }}
                    className="text-sm font-semibold text-on-surface cursor-text hover:text-primary transition-colors"
                  >
                    {tag.name}
                  </span>
                )}
                <button
                  onClick={() => {
                    const store = useProjectStore.getState();
                    store.removeProjectTag(activeProjectId!, tag.name);
                  }}
                  className="ml-auto p-1.5 rounded-lg text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all flex items-center gap-1 text-xs"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  <span className="hidden lg:inline">Delete</span>
                </button>
              </div>

              {/* Pages with this tag */}
              {pagesByTag.has(tag.name) && (
                <div className="flex items-center gap-1.5 mt-3 flex-wrap pl-10">
                  {pagesByTag.get(tag.name)!.map(page => (
                    <button
                      key={page.id}
                      onClick={() => openPage(page.id)}
                      className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all hover:opacity-80"
                      style={{
                        backgroundColor: `${tag.color}20`,
                        color: tag.color,
                        border: `1px solid ${tag.color}40`,
                      }}
                    >
                      {page.title || 'Untitled'}
                    </button>
                  ))}
                </div>
              )}
              {(!pagesByTag.has(tag.name) || pagesByTag.get(tag.name)!.length === 0) && (
                <p className="text-[10px] text-on-surface-variant/40 mt-2 pl-10">No pages use this tag yet</p>
              )}
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
