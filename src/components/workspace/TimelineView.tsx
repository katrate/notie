import { useState, useEffect, useCallback, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Tooltip } from '../Tooltip';

interface TimeBlock {
  id: string;
  title: string;
  date: string;
  color: string;
  description: string;
  linkedPages?: { pageId: string; pageTitle: string; pageIcon: string }[];
}

const PRESET_COLORS = [
  '#f43f5e', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6',
  '#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

function generateBlockId(): string {
  return `tb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getDateLabel(date: string): string {
  if (!date) return 'No date set';
  return date;
}

export function TimelineView() {
  const pages = useProjectStore(s => s.pages);
  const activePageId = useProjectStore(s => s.activePageId);
  const updatePageContent = useProjectStore(s => s.updatePageContent);
  const activePage = useMemo(() => pages.find(p => p.id === activePageId), [pages, activePageId]);

  const [blocks, setBlocks] = useState<TimeBlock[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editBlockId, setEditBlockId] = useState<string | null>(null);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);


  // ── Add/Edit form state ──
  const [formTitle, setFormTitle] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formColor, setFormColor] = useState(PRESET_COLORS[1]);
  const [formDescription, setFormDescription] = useState('');

  // ── Link pages state ──
  const [showLinkPanel, setShowLinkPanel] = useState<string | null>(null);
  const [linkSearch, setLinkSearch] = useState('');
  const [showUnlinkConfirm, setShowUnlinkConfirm] = useState<{ blockId: string; pageId: string } | null>(null);

  // ── Delete confirmation ──
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);


  // ── Sync blocks from store ──
  useEffect(() => {
    const page = pages.find(p => p.id === activePageId);
    if (page?.content && Array.isArray(page.content)) {
      setBlocks(page.content as TimeBlock[]);
    } else {
      setBlocks([]);
    }
  }, [activePageId, pages]);

  // ── Save blocks to store ──
  const saveBlocks = useCallback((newBlocks: TimeBlock[]) => {
    setBlocks(newBlocks);
    if (activePageId) updatePageContent(activePageId, newBlocks);
  }, [activePageId, updatePageContent]);

  // ── Open add modal ──
  const openAddModal = () => {
    setFormTitle('');
    setFormDate('');
    setFormColor(PRESET_COLORS[1]);
    setFormDescription('');
    setEditBlockId(null);
    setShowAddModal(true);
  };

  // ── Open edit modal ──
  const openEditModal = (block: TimeBlock) => {
    setFormTitle(block.title);
    setFormDate(block.date);
    setFormColor(block.color);
    setFormDescription(block.description);
    setEditBlockId(block.id);
    setShowAddModal(true);
  };

  // ── Save (create or update) block ──
  const handleSaveBlock = () => {
    if (!formTitle.trim()) return;
    const block: TimeBlock = {
      id: editBlockId || generateBlockId(),
      title: formTitle.trim(),
      date: formDate,
      color: formColor,
      description: formDescription,
      linkedPages: editBlockId
        ? blocks.find(b => b.id === editBlockId)?.linkedPages || []
        : [],
    };

    if (editBlockId) {
      saveBlocks(blocks.map(b => b.id === editBlockId ? block : b));
    } else {
      saveBlocks([...blocks, block]);
    }
    setShowAddModal(false);
    setEditBlockId(null);
  };

  // ── Delete block ──
  const handleDeleteBlock = (blockId: string) => {
    saveBlocks(blocks.filter(b => b.id !== blockId));
    setDeleteConfirm(null);
    if (expandedBlockId === blockId) setExpandedBlockId(null);
  };

  // ── Toggle expand ──
  const toggleExpand = (blockId: string) => {
    setExpandedBlockId(prev => prev === blockId ? null : blockId);
  };

  // ── Link a page to a block ──
  const linkPageToBlock = (blockId: string, pageId: string) => {
    const { pages: allPages } = useProjectStore.getState();
    const targetPage = allPages.find(p => p.id === pageId);
    if (!targetPage) return;

    const block = blocks.find(b => b.id === blockId);
    if (!block) return;

    const linkedPages = block.linkedPages || [];
    if (linkedPages.some(lp => lp.pageId === pageId)) return;

    const newLinkedPages = [
      ...linkedPages,
      { pageId, pageTitle: targetPage.title || 'Untitled', pageIcon: targetPage.icon || 'description' },
    ];

    saveBlocks(blocks.map(b => b.id === blockId ? { ...b, linkedPages: newLinkedPages } : b));

    setShowLinkPanel(null);
    setLinkSearch('');
  };

  // ── Unlink a page from a block ──
  const unlinkPageFromBlock = (blockId: string, pageId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    saveBlocks(blocks.map(b =>
      b.id === blockId
        ? { ...b, linkedPages: (b.linkedPages || []).filter(lp => lp.pageId !== pageId) }
        : b
    ));
    setShowUnlinkConfirm(null);
  };

  // ── All pages in the project for linking ──
  const availablePages = useMemo(() => {
    return pages.filter(p =>
      p.project_id === activePage?.project_id &&
      p.id !== activePageId &&
      p.type !== 'dashboard'
    );
  }, [activePage?.project_id, activePageId, pages]);

  const filteredPages = useMemo(() => {
    if (!linkSearch.trim()) return availablePages;
    const q = linkSearch.toLowerCase();
    return availablePages.filter(p => (p.title || '').toLowerCase().includes(q));
  }, [availablePages, linkSearch]);

  // ── Sorted blocks (natural array order, user reorders manually via drag) ──
  const sortedBlocks = useMemo(() => {
    return [...blocks];
  }, [blocks]);

  // ── Drag-and-drop reorder state ──
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex === null || dragOverIndex === null || dragIndex === dragOverIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    const reordered = [...blocks];
    const [moved] = reordered.splice(dragIndex, 1);
    reordered.splice(dragOverIndex, 0, moved);
    saveBlocks(reordered);
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if truly leaving this card (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (!related || !e.currentTarget.contains(related)) {
      setDragOverIndex(null);
    }
  };

  // ── Page type icon map ──
  const pageTypeIconLocal: Record<string, string> = {
    text: 'article', table: 'grid_on', board: 'dashboard', chart: 'bar_chart',
    checklist: 'checklist', gallery: 'photo_library', folder: 'folder',
    canvas: 'gesture', audio: 'mic', video: 'videocam', file: 'description',
    pdf: 'picture_as_pdf', timeline: 'timeline',
  };

  if (!activePage) return null;

  return (
    <div className="flex-1 flex flex-col gap-6 bg-surface/30 rounded-xl border border-outline/10 p-6 overflow-y-auto">
      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[28px] text-primary">timeline</span>
          <div>
            <h2 className="text-lg font-bold text-on-surface">Timeline</h2>
            <p className="text-xs text-on-surface-variant/60">{blocks.length} block{blocks.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-all shadow-lg shadow-primary/20"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          Add Block
        </button>
      </div>

      {/* ── Timeline ── */}
      {sortedBlocks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant/40 py-16">
          <span className="material-symbols-outlined text-[64px] mb-4">timeline</span>
          <p className="text-sm font-medium">No timeline blocks yet</p>
          <p className="text-xs mt-1 mb-4">Add years, quarters, months, or custom time periods</p>
          <button
            onClick={openAddModal}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary/15 text-primary text-sm font-medium hover:bg-primary/25 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            Create First Block
          </button>
        </div>
      ) : (
        <div className="relative flex-1 pl-8">
          {/* Vertical timeline line */}
          <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary/40 via-primary/20 to-primary/5 rounded-full" />

          {/* Blocks */}
          <div className="space-y-4">
            {sortedBlocks.map((block, index) => (
              <div
                key={block.id}
                className={`relative group/block transition-all duration-150 ${dragOverIndex === index ? 'scale-[1.02]' : ''} ${dragIndex === index ? 'opacity-50' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                onDragLeave={handleDragLeave}
              >
                {/* Timeline dot */}
                <div
                  className="absolute left-[-23px] top-5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-200 group-hover/block:scale-125"
                  style={{
                    backgroundColor: block.color + '30',
                    borderColor: block.color,
                    boxShadow: `0 0 8px ${block.color}40`,
                  }}
                >
                  <div
                    className="absolute inset-[3px] rounded-full"
                    style={{ backgroundColor: block.color }}
                  />
                </div>

                {/* Block card */}
                <div
                  className="bg-surface/60 border border-outline/10 rounded-xl overflow-hidden transition-all duration-200 hover:border-primary/20 hover:shadow-lg"
                >
                  {/* Header */}
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-on-surface/[0.02]"
                    onClick={() => toggleExpand(block.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-on-surface truncate">{block.title}</h3>
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: block.color }}
                        />
                      </div>
                      <p className="text-[11px] text-on-surface-variant/60 mt-0.5">
                        {getDateLabel(block.date)}
                      </p>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-1 opacity-0 group-hover/block:opacity-100 transition-opacity flex-shrink-0">
                      <Tooltip label="Link a page">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedBlockId(block.id);
                            setShowLinkPanel(showLinkPanel === block.id ? null : block.id);
                            setLinkSearch('');
                          }}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">link</span>
                        </button>
                      </Tooltip>
                      <Tooltip label="Edit block">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(block); }}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">edit</span>
                        </button>
                      </Tooltip>
                      <Tooltip label="Delete block">
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(block.id); }}
                          className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </Tooltip>
                      <span className={`material-symbols-outlined text-[16px] text-on-surface-variant/40 transition-transform duration-200 ${expandedBlockId === block.id ? 'rotate-180' : ''}`}>
                        expand_more
                      </span>
                    </div>
                  </div>

                  {/* Expanded content */}
                  {expandedBlockId === block.id && (
                    <div className="px-4 pb-4 pt-0 border-t border-outline/5 space-y-3">
                      {/* Description */}
                      {block.description && (
                        <p className="text-xs text-on-surface-variant/80 leading-relaxed mt-3">{block.description}</p>
                      )}

                      {/* Date */}
                      {block.date && (
                        <div className="flex items-center gap-1 text-[11px] text-on-surface-variant/60 mt-3">
                          <span className="material-symbols-outlined text-[12px]">calendar_today</span>
                          {block.date}
                        </div>
                      )}

                      {/* Linked pages */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                            <span className="material-symbols-outlined text-[12px]">link</span>
                            Linked Pages
                            {block.linkedPages && block.linkedPages.length > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                                {block.linkedPages.length}
                              </span>
                            )}
                          </span>
                        </div>

                        {(!block.linkedPages || block.linkedPages.length === 0) ? (
                          <p className="text-[11px] text-on-surface-variant/40 italic">No pages linked yet</p>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {block.linkedPages.map(lp => (
                              <span
                                key={lp.pageId}
                                className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-primary/10 text-primary font-medium group/link"
                              >
                                <span className="material-symbols-outlined text-[11px]">{lp.pageIcon || 'description'}</span>
                                <span className="truncate max-w-[120px]">{lp.pageTitle}</span>
                                <button
                                  onClick={() => setShowUnlinkConfirm({ blockId: block.id, pageId: lp.pageId })}
                                  className="opacity-0 group-hover/link:opacity-100 hover:bg-primary/20 rounded-full w-3.5 h-3.5 flex items-center justify-center transition-opacity"
                                >
                                  <span className="material-symbols-outlined text-[10px]">close</span>
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Link page panel (inline) */}
                      {showLinkPanel === block.id && (
                        <div className="bg-surface-variant/30 border border-outline/10 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="material-symbols-outlined text-[14px] text-primary">search</span>
                            <input
                              autoFocus
                              type="text"
                              value={linkSearch}
                              onChange={e => setLinkSearch(e.target.value)}
                              placeholder="Search pages to link..."
                              className="flex-1 bg-transparent outline-none text-xs text-on-surface placeholder:text-on-surface-variant/40"
                            />
                            <button
                              onClick={() => { setShowLinkPanel(null); setLinkSearch(''); }}
                              className="p-0.5 rounded text-on-surface-variant hover:text-on-surface"
                            >
                              <span className="material-symbols-outlined text-[14px]">close</span>
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-0.5">
                            {filteredPages.length === 0 ? (
                              <p className="text-xs text-on-surface-variant/40 py-3 text-center italic">No pages to link</p>
                            ) : (
                              filteredPages.map(p => (
                                <button
                                  key={p.id}
                                  onClick={() => { linkPageToBlock(block.id, p.id); }}
                                  className="w-full text-left flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-primary/10 transition-colors text-xs text-on-surface"
                                >
                                  <span className="material-symbols-outlined text-[12px] text-on-surface-variant/60">
                                    {pageTypeIconLocal[p.type || 'text'] || 'description'}
                                  </span>
                                  <span className="truncate flex-1">{p.title || 'Untitled'}</span>
                                  <span className="text-[9px] uppercase text-on-surface-variant/40">{p.type || 'text'}</span>
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Add block button at bottom of timeline */}
          <div className="relative mt-4 ml-[-23px]">
            <div className="absolute left-[23px] top-0 w-[2px] h-6 bg-gradient-to-b from-primary/10 to-transparent" />
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-dashed border-primary/30 text-primary text-sm font-medium hover:bg-primary/10 hover:border-primary/60 transition-all ml-[46px]"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Add Block
            </button>
          </div>
        </div>
      )}

      {/* ── Add/Edit Modal ── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-surface border border-outline/20 rounded-xl shadow-2xl w-full max-w-lg p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface mb-5 flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-primary">{editBlockId ? 'edit' : 'add'}</span>
              {editBlockId ? 'Edit Time Block' : 'New Time Block'}
            </h3>

            <div className="space-y-4">
              {/* Title */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Title</label>
                <input
                  autoFocus
                  type="text"
                  value={formTitle}
                  onChange={e => setFormTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSaveBlock(); }}
                  placeholder="e.g. Q1 2026, Spring Semester..."
                  className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
                />
              </div>

              {/* Date + Color row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Date (optional)</label>
                  <input
                    type="text"
                    value={formDate}
                    onChange={e => setFormDate(e.target.value)}
                    placeholder="e.g. 2026, Q1 2026, March 2026..."
                    className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors placeholder:text-on-surface-variant/40"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Color</label>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormColor(color)}
                        className={`w-7 h-7 rounded-lg border-2 transition-all hover:scale-110 ${
                          formColor === color ? 'border-primary scale-110 ring-1 ring-primary/40' : 'border-outline/20'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                    <input
                      type="color"
                      value={formColor}
                      onChange={e => setFormColor(e.target.value)}
                      className="w-7 h-7 rounded-lg border border-outline/20 cursor-pointer bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-none [&::-webkit-color-swatch]:rounded-lg"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider block mb-1.5">Description (optional)</label>
                <textarea
                  value={formDescription}
                  onChange={e => setFormDescription(e.target.value)}
                  placeholder="Add notes about this time period..."
                  rows={3}
                  className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface outline-none focus:border-primary transition-colors resize-none placeholder:text-on-surface-variant/40"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6 pt-4 border-t border-outline/10">
              {editBlockId ? (
                <button
                  type="button"
                  onClick={() => setDeleteConfirm(editBlockId)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-error hover:bg-error/10 transition-colors text-sm"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                  Delete
                </button>
              ) : <div />}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditBlockId(null); }}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveBlock}
                  disabled={!formTitle.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {editBlockId ? 'Save Changes' : 'Create Block'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirmation modal ── */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <div className="bg-surface border border-outline/20 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface mb-2">Delete Time Block?</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              This will permanently remove "{blocks.find(b => b.id === deleteConfirm)?.title}". This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteBlock(deleteConfirm)}
                className="px-4 py-2 rounded-lg bg-error text-white hover:bg-error/90 transition-colors text-sm font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unlink confirm modal ── */}
      {showUnlinkConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={() => setShowUnlinkConfirm(null)}>
          <div className="bg-surface border border-outline/20 rounded-xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-bold text-on-surface mb-2">Unlink Page?</h3>
            <p className="text-sm text-on-surface-variant mb-5">
              Remove this page link from the timeline block?
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowUnlinkConfirm(null)}
                className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={() => unlinkPageFromBlock(showUnlinkConfirm.blockId, showUnlinkConfirm.pageId)}
                className="px-4 py-2 rounded-lg bg-error text-white hover:bg-error/90 transition-colors text-sm font-medium"
              >
                Unlink
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
