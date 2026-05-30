import { useState } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'

const TAG_PALETTE = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#d946ef'];

export function TagManagerModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [newTagName, setNewTagName] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const projects = useProjectStore(s => s.projects);
  const { addProjectTag, removeProjectTag, updateProjectTag } = useProjectStore();

  const project = projects.find(p => p.id === projectId);
  const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];

  const addTag = () => {
    const name = newTagName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!name || projectTags.some(t => t.name === name)) return;
    const usedColors = new Set(projectTags.map(t => t.color));
    let color = '#6366f1';
    for (const c of TAG_PALETTE) { if (!usedColors.has(c)) { color = c; break; } }
    addProjectTag(projectId, name, color);
    setNewTagName('');
  };

  const renameTag = (oldName: string) => {
    const n = editTagName.trim().toLowerCase().replace(/\s+/g, '-');
    if (!n || n === oldName) { setEditingTag(null); return; }
    if (projectTags.some(t => t.name === n)) return;
    const tag = projectTags.find(t => t.name === oldName);
    updateProjectTag(projectId, oldName, n, tag?.color || '#6366f1');
    setEditingTag(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-bold text-on-surface">Tag Manager</h3>
          <Tooltip label="Close">
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface/50 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </Tooltip>
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="text"
            value={newTagName}
            onChange={e => setNewTagName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') addTag(); }}
            placeholder="New tag name..."
            className="flex-1 bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
          />
          <button onClick={addTag} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add
          </button>
        </div>

        <div className="space-y-1 max-h-64 overflow-y-auto">
          {projectTags.length === 0 && (
            <p className="text-xs text-on-surface-variant/60 py-4 text-center">No tags defined yet</p>
          )}
          {projectTags.map(tag => (
            <div key={tag.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface/50 transition-colors group">
              <input
                type="color"
                value={tag.color}
                onChange={e => updateProjectTag(projectId, tag.name, tag.name, e.target.value)}
                className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
              />
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
                  className="flex-1 bg-surface border border-primary/50 rounded-lg px-2 py-1 text-sm text-on-surface outline-none"
                  autoFocus
                />
              ) : (
                <span
                  onClick={() => { setEditingTag(tag.name); setEditTagName(tag.name); }}
                  className="flex-1 text-sm font-medium text-on-surface cursor-text"
                >
                  {tag.name}
                </span>
              )}
              <Tooltip label="Delete tag">
                <button
                  onClick={() => removeProjectTag(projectId, tag.name)}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
