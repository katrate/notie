import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Tooltip } from '../Tooltip';

interface GalleryItem {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
}

interface TagDef {
  name: string;
  color: string;
}

const DEFAULT_TAGS: TagDef[] = [
  { name: 'art', color: '#f43f5e' },
  { name: 'design', color: '#3b82f6' },
  { name: 'photo', color: '#10b981' },
  { name: 'nature', color: '#f59e0b' },
  { name: 'architecture', color: '#8b5cf6' },
  { name: 'abstract', color: '#06b6d4' },
];

import { isVideoUrl } from '../../lib/media'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export function GalleryView() {
  const { pages, activePageId, updatePageContent, projects } = useProjectStore() as any;
  const activePage = pages.find((p: any) => p.id === activePageId);
  const project = projects.find((p: any) => p.id === activePage?.project_id);
  const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];

  const [items, setItems] = useState<GalleryItem[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'alpha' | 'tags'>('newest');
  const [showSort, setShowSort] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [tagDefs, setTagDefs] = useState<TagDef[]>(DEFAULT_TAGS);
  const [editTags, setEditTags] = useState('');
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const sortRef = useRef<HTMLDivElement>(null);

  // Form state
  const [formImageData, setFormImageData] = useState<string>('');
  const [formImageName, setFormImageName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formError, setFormError] = useState('');
  const [formUrlMode, setFormUrlMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setItems(activePage.content);
    } else {
      setItems([]);
    }
    const pageTags = activePage?.metadata?.galleryTags || [];
    // Merge page-level tags with project-level tags (project tags override defaults)
    const merged = [...DEFAULT_TAGS.filter(dt => !pageTags.some((pt: any) => pt.name === dt.name) && !projectTags.some((jt: any) => jt.name === dt.name)), ...pageTags, ...projectTags.filter((jt: any) => !pageTags.some((pt: any) => pt.name === jt.name))];
    setTagDefs(merged);
  }, [activePage?.content, activePage?.metadata?.galleryTags, activePageId, projectTags]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const saveContent = (newItems: GalleryItem[]) => {
    setItems(newItems);
    if (activePageId) updatePageContent(activePageId, newItems);
  };

  const saveTagDefs = (defs: TagDef[]) => {
    setTagDefs(defs);
    if (activePageId) useProjectStore.getState().updatePage(activePageId, {
      metadata: { ...activePage?.metadata, galleryTags: defs }
    });
  };

  const getTagColor = (name: string): string => {
    const def = tagDefs.find(t => t.name === name);
    if (def) return def.color;
    const projectDef = projectTags.find(t => t.name === name);
    return projectDef ? projectDef.color : '#6b7280';
  };

  const addTagDef = () => {
    const name = newTagInput.trim().toLowerCase();
    if (!name || tagDefs.some(t => t.name === name)) return;
    const usedColors = new Set(tagDefs.map(t => t.color));
    let color = '#6366f1';
    const palette = ['#f43f5e','#3b82f6','#10b981','#f59e0b','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#d946ef'];
    for (const c of palette) { if (!usedColors.has(c)) { color = c; break; } }
    saveTagDefs([...tagDefs, { name, color }]);
    setNewTagInput('');
  };

  const removeTagDef = (name: string) => {
    saveTagDefs(tagDefs.filter(t => t.name !== name));
  };

  const renameTagDef = (oldName: string, newName: string) => {
    const n = newName.trim().toLowerCase();
    if (!n || n === oldName) { setEditingTag(null); return; }
    if (tagDefs.some(t => t.name === n)) return;
    saveTagDefs(tagDefs.map(t => t.name === oldName ? { ...t, name: n } : t));
    setEditingTag(null);
  };

  const setTagColor = (name: string, color: string) => {
    saveTagDefs(tagDefs.map(t => t.name === name ? { ...t, color } : t));
  };

  const toggleFormTag = (tag: string) => {
    const current = formTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    if (current.includes(tag)) {
      setFormTags(current.filter(t => t !== tag).join(', '));
    } else {
      setFormTags(current.length ? [...current, tag].join(', ') : tag);
    }
  };

  const loadFile = (file: File) => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) { setFormError('Please select an image or video file'); return; }
    setFormError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormImageData(e.target?.result as string);
      setFormImageName(file.name);
      setFormUrl('');
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  const addItem = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const url = formImageData || formUrl.trim();
    if (!url) { setFormError('Select an image or enter a URL'); return; }
    if (!formTitle.trim()) { setFormError('Title is required'); return; }
    if (items.some(i => i.title.toLowerCase() === formTitle.trim().toLowerCase())) { setFormError('An image with this title already exists'); return; }
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    saveContent([
      {
        id: Math.random().toString(36).substr(2, 9),
        url,
        title: formTitle.trim(),
        description: formDesc.trim(),
        tags,
        createdAt: new Date().toISOString(),
      },
      ...items,
    ]);
    setFormImageData(''); setFormImageName(''); setFormUrl('');
    setFormTitle(''); setFormDesc(''); setFormTags('');
    setShowForm(false);
  };

  const deleteItem = (id: string) => {
    saveContent(items.filter(i => i.id !== id));
    if (showDetail === id) setShowDetail(null);
    if (editingItem?.id === id) setEditingItem(null);
  };

  const updateItem = (id: string, updates: Partial<GalleryItem>) => {
    saveContent(items.map(i => i.id === id ? { ...i, ...updates } : i));
    setEditingItem(null);
    if (showDetail === id) setShowDetail(null);
  };

  const filtered = useMemo(() => {
    let list = [...items];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    list.sort((a, b) => {
      if (sort === 'alpha') return a.title.localeCompare(b.title);
      if (sort === 'tags') {
        const aTag = a.tags.length ? a.tags[0].toLowerCase() : 'zzzz';
        const bTag = b.tags.length ? b.tags[0].toLowerCase() : 'zzzz';
        if (aTag !== bTag) return aTag.localeCompare(bTag);
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return sort === 'newest' ? db - da : da - db;
    });
    return list;
  }, [items, search, sort]);

  // Group items by tag when sorting by tags — items with multiple tags appear in all matching sections
  const tagGrouped = useMemo(() => {
    if (sort !== 'tags') return [];
    const map = new Map<string, GalleryItem[]>();
    for (const item of filtered) {
      const tags = item.tags.length > 0 ? item.tags : ['untagged'];
      for (const tag of tags) {
        if (!map.has(tag)) map.set(tag, []);
        map.get(tag)!.push(item);
      }
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, items]) => ({ tag, items }));
  }, [filtered, sort]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.tags.forEach(t => set.add(t)));
    return Array.from(set);
  }, [items]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5 flex-shrink-0">
        <span className="material-symbols-outlined text-[22px] text-primary">photo_library</span>
        <h2 className="text-lg font-bold text-on-surface">Gallery</h2>
        <span className="text-[11px] text-on-surface-variant/60">{items.length} items</span>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative">
            <span className="material-symbols-outlined text-[14px] absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant pointer-events-none">search</span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search gallery..."
              className="w-36 md:w-48 bg-surface/50 border border-outline/20 focus:border-primary/50 rounded-lg pl-8 pr-3 py-1.5 text-xs text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
            />
          </div>

          <div className="relative" ref={sortRef}>
            <button
              onClick={() => setShowSort(!showSort)}
              className="px-2.5 py-1.5 rounded-lg border border-outline/20 text-xs font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5 bg-surface/50"
            >
              <span className="material-symbols-outlined text-[12px]">sort</span>
              {sort === 'newest' ? 'Newest' : sort === 'oldest' ? 'Oldest' : sort === 'alpha' ? 'A-Z' : 'By Tags'}
            </button>
            {showSort && (
              <div className="absolute top-full right-0 mt-1 z-50 bg-surface border border-outline/20 rounded-xl shadow-2xl p-1.5 w-32 backdrop-blur-xl">
                {([['newest', 'Newest'], ['oldest', 'Oldest'], ['alpha', 'A-Z'], ['tags', 'By Tags']] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setSort(key); setShowSort(false); }}
                    className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all ${
                      sort === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface/50'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setShowForm(true)}
            className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            Add Image
          </button>
          <button
            onClick={() => setShowTagManager(true)}
            className="px-2.5 py-1.5 rounded-lg border border-outline/20 text-xs font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5 bg-surface/50"
            title="Manage predefined tags"
          >
            <span className="material-symbols-outlined text-[12px]">label</span>
            Tags
          </button>
        </div>
      </div>

      {/* Tag filters */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-1.5 mb-4 flex-shrink-0 overflow-x-auto pb-1">
          {allTags.map(tag => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap"
              style={{ backgroundColor: `${getTagColor(tag)}20`, color: getTagColor(tag) }}
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Add form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowForm(false)}>
          <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-on-surface">Add to Gallery</h3>
              <Tooltip label="Close">
                <button onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-surface/50 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </Tooltip>
            </div>
            <form onSubmit={addItem} className="space-y-3">
              {/* Upload area */}
              {!formUrlMode ? (
                <div
                  ref={dropZoneRef}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  onClick={() => fileInputRef.current?.click()}
                  className="relative rounded-xl border-2 border-dashed border-outline/20 hover:border-primary/40 transition-colors cursor-pointer overflow-hidden group"
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
                    className="hidden"
                  />
                  {formImageData ? (
                    <div className="relative">
                      {isVideoUrl(formImageData) ? (
                        <video src={formImageData} controls className="w-full h-40 object-contain bg-black" />
                      ) : (
                        <img src={formImageData} alt="Preview" className="w-full h-40 object-cover" />
                      )}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-white/0 group-hover:text-white/90 text-[28px] transition-all">sync_alt</span>
                      </div>
                      <div className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md text-[10px] text-white/80 max-w-[70%] truncate">
                        {formImageName}
                      </div>
                      <Tooltip label="Remove">
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setFormImageData(''); setFormImageName(''); }}
                          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px] text-white">close</span>
                        </button>
                      </Tooltip>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 gap-2 py-4">
                      <span className="material-symbols-outlined text-[28px] text-on-surface-variant/50">image</span>
                      <p className="text-xs text-on-surface-variant/60 font-medium">Click to upload or drag & drop</p>
                      <p className="text-[10px] text-on-surface-variant/40">PNG, JPG, WebP, GIF, MP4, WebM</p>
                    </div>
                  )}
                </div>
              ) : (
                <input
                  type="url"
                  value={formUrl}
                  onChange={e => { setFormUrl(e.target.value); setFormImageData(''); setFormImageName(''); }}
                  placeholder="Image URL *"
                  className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
                />
              )}
              <button
                type="button"
                onClick={() => { setFormUrlMode(!formUrlMode); setFormError(''); }}
                className="text-[10px] text-primary/60 hover:text-primary transition-colors"
              >
                {formUrlMode ? '← Upload from device' : 'Or paste an image URL →'}
              </button>
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Title *"
                className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
              />
              <textarea
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40 resize-none"
              />
              <div className="space-y-1.5">
                <p className="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider">Tags</p>
                {tagDefs.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tagDefs.map(tag => {
                      const active = formTags.split(',').map(t => t.trim().toLowerCase()).includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => toggleFormTag(tag.name)}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                          style={{
                            backgroundColor: active ? `${tag.color}30` : 'transparent',
                            color: active ? tag.color : 'var(--on-surface-variant)',
                            border: `1px solid ${active ? tag.color : 'var(--outline)'}`,
                          }}
                        >
                          {active ? `✓ ` : ``}#{tag.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-on-surface-variant/30 italic">No tags defined — add some in Tags manager</p>
                )}
              </div>
              {formError && <p className="text-xs text-error">{formError}</p>}
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm">
                  Add to Gallery
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tag Manager modal */}
      {showTagManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowTagManager(false)}>
          <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-on-surface">Tag Manager</h3>
              <Tooltip label="Close">
                <button onClick={() => setShowTagManager(false)} className="p-1 rounded-lg hover:bg-surface/50 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </Tooltip>
            </div>
            <div className="flex items-center gap-2 mb-5">
              <input
                type="text"
                value={newTagInput}
                onChange={e => setNewTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') addTagDef(); }}
                placeholder="New tag name..."
                className="flex-1 bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
              />
              <button
                onClick={addTagDef}
                className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {tagDefs.length === 0 && (
                <p className="text-xs text-on-surface-variant/60 py-4 text-center">No tags defined yet</p>
              )}
              {tagDefs.map(tag => (
                <div
                  key={tag.name}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface/50 transition-colors group"
                >
                  {/* Color picker */}
                  <input
                    type="color"
                    value={tag.color}
                    onChange={e => setTagColor(tag.name, e.target.value)}
                    className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                  />
                  {/* Name */}
                  {editingTag === tag.name ? (
                    <input
                      type="text"
                      value={editTagName}
                      onChange={e => setEditTagName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameTagDef(tag.name, editTagName);
                        if (e.key === 'Escape') setEditingTag(null);
                      }}
                      onBlur={() => renameTagDef(tag.name, editTagName)}
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
                  {/* Delete */}
                  <Tooltip label="Delete tag">
                    <button
                      onClick={() => removeTagDef(tag.name)}
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
      )}

      {/* Detail panel */}
      {showDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowDetail(null)}>
          {(() => {
            const item = items.find(i => i.id === showDetail);
            if (!item) return null;
            return (
              <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="relative aspect-video bg-surface-variant/30 overflow-hidden">
                  {isVideoUrl(item.url) ? (
                  <video src={item.url} controls className="w-full h-full object-contain bg-black" />
                ) : (
                  <img src={item.url} alt={item.title} className="w-full h-full object-cover" />
                )}
                  <Tooltip label="Close">
                    <button onClick={() => setShowDetail(null)} className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/30 backdrop-blur-md flex items-center justify-center hover:bg-black/50 transition-all">
                      <span className="material-symbols-outlined text-[16px] text-white">close</span>
                    </button>
                  </Tooltip>
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-on-surface">{item.title}</h3>
                      <span className="text-[11px] text-on-surface-variant/60">{timeAgo(item.createdAt)}</span>
                    </div>                    <div className="flex items-center gap-2">
                      <Tooltip label="Edit image">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setEditTags(item.tags.join(', '));
                          }}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-all flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete image">
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="p-1.5 rounded-lg text-error hover:bg-error/10 transition-all flex-shrink-0"
                        >
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-sm text-on-surface-variant/80 leading-relaxed">{item.description}</p>
                  )}
                  {item.tags.length > 0 && (
                    <div className="flex items-center gap-1.5 pt-1">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                          style={{ backgroundColor: `${getTagColor(tag)}20`, color: getTagColor(tag) }}
                        >#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Edit modal */}
      {editingItem && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setEditingItem(null)}>
          <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-on-surface">Edit Image</h3>
              <Tooltip label="Close">
                <button onClick={() => setEditingItem(null)} className="p-1 rounded-lg hover:bg-surface/50 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </Tooltip>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); const tags = editTags.split(',').map(t => t.trim()).filter(Boolean); updateItem(editingItem.id, { title: (e.target as any).editTitle.value.trim(), description: (e.target as any).editDesc.value.trim(), tags }); }} className="space-y-3">
              {/* Preview */}
              <div className="relative rounded-xl overflow-hidden border border-outline/10 bg-surface-variant/20">
                {isVideoUrl(editingItem.url) ? (
                  <video src={editingItem.url} controls className="w-full h-40 object-contain bg-black" />
                ) : (
                  <img src={editingItem.url} alt="Preview" className="w-full h-40 object-cover" />
                )}
              </div>
              <input
                name="editTitle"
                defaultValue={editingItem.title}
                placeholder="Title *"
                required
                className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40"
              />
              <textarea
                name="editDesc"
                defaultValue={editingItem.description}
                placeholder="Description (optional)"
                rows={2}
                className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant/40 resize-none"
              />
              <div className="space-y-1.5">
                <p className="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider">Tags</p>
                {tagDefs.length > 0 ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {tagDefs.map(tag => {
                      const active = editTags.split(',').map(t => t.trim().toLowerCase()).includes(tag.name);
                      return (
                        <button
                          key={tag.name}
                          type="button"
                          onClick={() => {
                            const current = editTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                            if (current.includes(tag.name)) {
                              setEditTags(current.filter(t => t !== tag.name).join(', '));
                            } else {
                              setEditTags(current.length ? [...current, tag.name].join(', ') : tag.name);
                            }
                          }}
                          className="px-2 py-0.5 rounded-full text-[10px] font-medium transition-all"
                          style={{
                            backgroundColor: active ? `${tag.color}30` : 'transparent',
                            color: active ? tag.color : 'var(--on-surface-variant)',
                            border: `1px solid ${active ? tag.color : 'var(--outline)'}`,
                          }}
                        >
                          {active ? `✓ ` : ``}#{tag.name}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-[10px] text-on-surface-variant/30 italic">No tags defined — add some in Tags manager</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Grid */}
      <div className="flex-1 overflow-y-auto min-h-0 pr-1">
        {filtered.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-on-surface-variant">
            <div className="w-16 h-16 rounded-2xl bg-surface/50 border border-outline/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[32px] opacity-40">photo_library</span>
            </div>
            {search ? (
              <p className="text-sm opacity-60">No results for "{search}"</p>
            ) : (
              <>
                <p className="text-sm font-medium opacity-60 mb-1">Gallery is empty</p>
                <p className="text-xs opacity-40">Add images to build your collection</p>
              </>
            )}
          </div>
        ) : sort === 'tags' && tagGrouped.length > 0 ? (
          <div className="space-y-8">
            {tagGrouped.map(group => (
              <div key={group.tag}>
                {/* Tag section header */}
                <div className="flex items-center gap-2.5 mb-3 sticky top-0 z-10 bg-surface/80 backdrop-blur-sm py-2 rounded-lg">
                  <span
                    className="px-3 py-0.5 rounded-full text-xs font-semibold"
                    style={{ backgroundColor: `${getTagColor(group.tag)}20`, color: getTagColor(group.tag) }}
                  >
                    #{group.tag}
                  </span>
                  <span className="text-[10px] text-on-surface-variant/50">{group.items.length} item{group.items.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
                  {group.items.map(item => (
                    <GalleryCard
                      key={item.id}
                      item={item}
                      isHovered={hoveredId === item.id}
                      onHover={setHoveredId}
                      onClick={setShowDetail}
                      onDelete={deleteItem}
                      getTagColor={getTagColor}
                      timeAgo={timeAgo}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-3 space-y-3">
            {filtered.map(item => (
              <GalleryCard
                key={item.id}
                item={item}
                isHovered={hoveredId === item.id}
                onHover={setHoveredId}
                onClick={setShowDetail}
                onDelete={deleteItem}
                getTagColor={getTagColor}
                timeAgo={timeAgo}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GalleryCard({ item, isHovered, onHover, onClick, onDelete, getTagColor, timeAgo }: {
  item: GalleryItem;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
  onDelete: (id: string) => void;
  getTagColor: (name: string) => string;
  timeAgo: (str: string) => string;
}) {
  return (
    <div
      className="relative break-inside-avoid rounded-xl overflow-hidden border border-outline/10 bg-surface/30 hover:shadow-lg hover:shadow-black/10 hover:border-primary/20 transition-all duration-200 cursor-pointer group"
      onMouseEnter={() => onHover(item.id)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(item.id)}
    >
      <div className="relative overflow-hidden">
        {isVideoUrl(item.url) ? (
          <div className="relative w-full aspect-video bg-black/40 flex items-center justify-center">
            <video
              src={item.url}
              className="w-full h-full object-cover"
              preload="metadata"
              muted
              onMouseEnter={(e) => { e.currentTarget.play().catch(() => {}); }}
              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
            />
            <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="material-symbols-outlined text-[36px] text-white/70 drop-shadow-lg">play_circle</span>
            </span>
          </div>
        ) : (
          <img
            src={item.url}
            alt={item.title}
            className="w-full max-h-[500px] transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent transition-opacity duration-200 ${isHovered ? 'opacity-100' : 'opacity-0'}`} />
        <div className={`absolute top-2 right-2 flex gap-1 transition-all duration-200 ${isHovered ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onClick(item.id); }}
            className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-black/60 transition-all"
          >
            <span className="material-symbols-outlined text-[14px] text-white">zoom_in</span>
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
            className="w-7 h-7 rounded-lg bg-black/40 backdrop-blur-sm flex items-center justify-center hover:bg-error/70 transition-all"
          >
            <span className="material-symbols-outlined text-[14px] text-white">delete</span>
          </button>
        </div>
      </div>
      <div className="p-3 space-y-1.5">
        <h3 className="text-sm font-semibold text-on-surface leading-tight truncate">{item.title}</h3>
        {item.description && (
          <p className="text-[11px] text-on-surface-variant/60 line-clamp-2 leading-relaxed">{item.description}</p>
        )}
        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-on-surface-variant/40">{timeAgo(item.createdAt)}</span>
          {item.tags.length > 0 && (
            <div className="flex items-center gap-1">
              {item.tags.slice(0, 2).map(tag => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded-full text-[9px] font-medium leading-none"
                  style={{ backgroundColor: `${getTagColor(tag)}20`, color: getTagColor(tag) }}
                >
                  {tag}
                </span>
              ))}
              {item.tags.length > 2 && (
                <span className="text-[9px] text-on-surface-variant/40">+{item.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}