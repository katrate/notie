import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Tooltip } from '../Tooltip';

interface Card {
  id: string;
  title: string;
  description: string;
  tags: string[];
  columnId: string;
  linkedPages?: { pageId: string; pageTitle: string }[];
}

interface ColumnDef {
  id: string;
  title: string;
  color: string;
}

interface TagDef {
  name: string;
  color: string;
}

function genId() {
  return Math.random().toString(36).substr(2, 9);
}

const DEFAULT_TAGS: TagDef[] = [
  { name: 'bug', color: '#f43f5e' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'improvement', color: '#10b981' },
  { name: 'urgent', color: '#f59e0b' },
  { name: 'design', color: '#8b5cf6' },
  { name: 'docs', color: '#06b6d4' },
];

export function BoardView() {
  const { pages, activePageId, updatePageContent, projects, setActivePage } = useProjectStore() as any;
  const activePage = pages.find((p: any) => p.id === activePageId);
  const project = projects.find((p: any) => p.id === activePage?.project_id);
  const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];

  const [cards, setCards] = useState<Card[]>([]);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [draggedCard, setDraggedCard] = useState<Card | null>(null);
  const [editColId, setEditColId] = useState<string | null>(null);
  const [editColTitle, setEditColTitle] = useState('');
  const [showAddCol, setShowAddCol] = useState(false);
  const [newColTitle, setNewColTitle] = useState('');
  const [showCardForm, setShowCardForm] = useState(false);
  const [formColId, setFormColId] = useState('');
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formTags, setFormTags] = useState('');
  const [formError, setFormError] = useState('');
  const [showCardDetail, setShowCardDetail] = useState<string | null>(null);
  const [editDetailTitle, setEditDetailTitle] = useState('');
  const [editDetailDesc, setEditDetailDesc] = useState('');
  const [editDetailTags, setEditDetailTags] = useState('');
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [showLinkPageSearch, setShowLinkPageSearch] = useState(false);
  const [linkPageSearch, setLinkPageSearch] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'tags'>('default');
  const [showSort, setShowSort] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const [tagDefs, setTagDefs] = useState<TagDef[]>(DEFAULT_TAGS);
  const [showTagManager, setShowTagManager] = useState(false);
  const [newTagInput, setNewTagInput] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editTagName, setEditTagName] = useState('');
  const [editingColColor, setEditingColColor] = useState<string | null>(null);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Record<string, boolean>>({});
  const colInputRef = useRef<HTMLInputElement>(null);

  // ── Pointer-based drag state refs (mirroring EditableTable pattern) ──
  const columnsContainerRef = useRef<HTMLDivElement>(null);
  const colDragStateRef = useRef({
    isDragging: false,
    draggedIndex: -1,
    startX: 0,
    ghostEl: null as HTMLElement | null,
    dropIndex: -1,
    dropPosition: null as 'left' | 'right' | null,
    autoScrollRaf: null as number | null,
    autoScrollDirection: null as 'left' | 'right' | null,
  });
  const cardDragStateRef = useRef({
    isDragging: false,
    draggedCard: null as Card | null,
    startX: 0,
    startY: 0,
    ghostEl: null as HTMLElement | null,
    targetColId: null as string | null,
    beforeCardId: null as string | null,
    position: null as 'before' | 'after' | null,
    autoScrollRafV: null as number | null,
    autoScrollDirectionV: null as 'up' | 'down' | null,
    autoScrollRafH: null as number | null,
    autoScrollDirectionH: null as 'left' | 'right' | null,
    /** Column ID currently being vertically auto-scrolled — used to re-query scroll element each frame */
    currentScrollColId: null as string | null,
  });
  const moveColRef = useRef<((fromIndex: number, toIndex: number) => void) | null>(null);
  const moveCardRef = useRef<((draggedCard: Card, targetColId: string, beforeCardId: string | null, position: 'before' | 'after') => void) | null>(null);

  // Drag reorder state (kept for rendering indicators)
  const [draggedColumn, setDraggedColumn] = useState<ColumnDef | null>(null);
  // cardDropTarget: { columnId, beforeCardId | null, position }
  // beforeCardId=null means append to end; position 'before'/'after' determines insert relative to that card
  const [cardDropTarget, setCardDropTarget] = useState<{ columnId: string; beforeCardId: string | null; position: 'before' | 'after' } | null>(null);
  // Track which column a card is being dragged over (for empty-space drop highlight)
  const [cardDragOverColId, setCardDragOverColId] = useState<string | null>(null);

  const DEFAULT_COLUMNS: ColumnDef[] = [
    { id: 'col-1', title: 'Untitled', color: '#3b82f6' },
  ];

  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setCards(activePage.content);
    } else {
      setCards([]);
    }
    if (activePage?.metadata?.boardColumns) {
      setColumns(activePage.metadata.boardColumns);
    } else {
      setColumns(DEFAULT_COLUMNS);
    }
    const pageTags = activePage?.metadata?.boardTags || [];
    // Merge page-level tags with project-level tags (project tags override defaults)
    const merged = [...DEFAULT_TAGS.filter(dt => !pageTags.some((pt: any) => pt.name === dt.name) && !projectTags.some((jt: any) => jt.name === dt.name)), ...pageTags, ...projectTags.filter((jt: any) => !pageTags.some((pt: any) => pt.name === jt.name))];
    setTagDefs(merged);
  }, [activePage?.content, activePage?.metadata?.boardColumns, activePage?.metadata?.boardTags, activePageId, projectTags]);

  useEffect(() => {
    if (editColId && colInputRef.current) colInputRef.current.focus();
  }, [editColId]);

  // ── Pointer-based column drag ──
  useEffect(() => {
    const container = columnsContainerRef.current;
    if (!container) return;

    const onColPointerDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-board-col-drag-handle]') as HTMLElement | null;
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();

      const colEl = handle.closest('[data-board-col-index]') as HTMLElement | null;
      if (!colEl) return;
      const index = parseInt(colEl.getAttribute('data-board-col-index') || '-1');
      if (index < 0) return;

      const state = colDragStateRef.current;
      state.draggedIndex = index;
      state.startX = e.clientX;
      state.isDragging = false;

      // Clone only the column header for the ghost (not the entire column with cards)
      const headerEl = colEl.querySelector('[data-board-col-header]') as HTMLElement | null;
      const ghostEl = headerEl || colEl;
      const ghost = ghostEl.cloneNode(true) as HTMLElement;
      const s = ghost.style;
      s.position = 'fixed';
      s.pointerEvents = 'none';
      s.opacity = '0.92';
      s.zIndex = '9999';
      s.boxShadow = '0 12px 40px rgba(0,0,0,0.3)';
      s.transform = 'rotate(0.3deg) scale(0.97)';
      s.background = 'var(--color-surface, #1e1e1e)';
      s.borderRadius = '12px';
      s.width = `${ghostEl.offsetWidth}px`;
      s.left = '-9999px';
      s.top = '-9999px';
      s.transition = 'none';
      // Hide action buttons in ghost
      ghost.querySelectorAll('[data-drag-hide]').forEach(el => (el as HTMLElement).style.display = 'none');
      document.body.appendChild(ghost);
      state.ghostEl = ghost;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      // Highlight source column
      setDraggedColumn(columns[index]);
    };

    const onColPointerMove = (e: PointerEvent) => {
      const state = colDragStateRef.current;
      if (state.draggedIndex < 0) return;

      const dx = e.clientX - state.startX;
      if (!state.isDragging) {
        if (Math.abs(dx) < 5) return;
        state.isDragging = true;
      }

      // Move ghost
      if (state.ghostEl) {
        state.ghostEl.style.left = `${e.clientX + 16}px`;
        state.ghostEl.style.top = `${e.clientY + 8}px`;
      }

      // ── Auto-scroll horizontally when dragging near edges ──
      const scrollParent = container.parentElement as HTMLElement | null;
      if (scrollParent) {
        const pr = scrollParent.getBoundingClientRect();
        const threshold = 35;
        if (e.clientX < pr.left + threshold) {
          if (state.autoScrollDirection !== 'left') {
            state.autoScrollDirection = 'left';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'left') return;
              scrollParent.scrollLeft -= 12;
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else if (e.clientX > pr.right - threshold) {
          if (state.autoScrollDirection !== 'right') {
            state.autoScrollDirection = 'right';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'right') return;
              scrollParent.scrollLeft += 12;
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else {
          if (state.autoScrollRaf) {
            cancelAnimationFrame(state.autoScrollRaf);
            state.autoScrollRaf = null;
            state.autoScrollDirection = null;
          }
        }
      }

      // Find closest column by X position
      const colElements = container.querySelectorAll('[data-board-col-index]');
      let closestIndex = -1;
      let closestPosition: 'left' | 'right' | null = null;
      let closestDist = Infinity;

      colElements.forEach(el => {
        const index = parseInt(el.getAttribute('data-board-col-index') || '-1');
        if (index < 0 || index === state.draggedIndex) return;

        const rect = el.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - midX);

        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = index;
          closestPosition = e.clientX < midX ? 'left' : 'right';
        }
      });

      if (closestIndex >= 0) {
        state.dropIndex = closestIndex;
        state.dropPosition = closestPosition;
      } else {
        state.dropIndex = -1;
        state.dropPosition = null;
      }
    };

    const onColPointerUp = () => {
      const state = colDragStateRef.current;

      // Stop auto-scroll
      if (state.autoScrollRaf) {
        cancelAnimationFrame(state.autoScrollRaf);
        state.autoScrollRaf = null;
        state.autoScrollDirection = null;
      }

      // Clean up ghost
      if (state.ghostEl && document.body.contains(state.ghostEl)) {
        document.body.removeChild(state.ghostEl);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Execute drop
      if (state.isDragging && state.draggedIndex >= 0 && state.dropIndex >= 0 && state.dropPosition) {
        const targetIndex = state.dropPosition === 'left'
          ? state.dropIndex
          : state.dropIndex + 1;
        const finalIndex = targetIndex > state.draggedIndex ? targetIndex - 1 : targetIndex;
        moveColRef.current?.(state.draggedIndex, finalIndex);
      }

      // Reset state
      setDraggedColumn(null);
      state.isDragging = false;
      state.draggedIndex = -1;
      state.dropIndex = -1;
      state.dropPosition = null;
      state.ghostEl = null;
    };

    container.addEventListener('pointerdown', onColPointerDown);
    document.addEventListener('pointermove', onColPointerMove);
    document.addEventListener('pointerup', onColPointerUp);
    document.addEventListener('pointercancel', onColPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onColPointerDown);
      document.removeEventListener('pointermove', onColPointerMove);
      document.removeEventListener('pointerup', onColPointerUp);
      document.removeEventListener('pointercancel', onColPointerUp);
    };
  }, [columns.length]);

  // ── Pointer-based card drag ──
  useEffect(() => {
    const container = columnsContainerRef.current;
    if (!container) return;

    const onCardPointerDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-board-card-drag-handle]') as HTMLElement | null;
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();

      const cardEl = handle.closest('[data-board-card-id]') as HTMLElement | null;
      if (!cardEl) return;
      const cardId = cardEl.getAttribute('data-board-card-id');
      const card = cards.find(c => c.id === cardId);
      if (!card) return;

      const state = cardDragStateRef.current;
      state.draggedCard = card;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.isDragging = false;

      setDraggedCard(card);
      setCardDropTarget(null);
      setCardDragOverColId(null);

      // Create ghost
      const ghost = cardEl.cloneNode(true) as HTMLElement;
      const s = ghost.style;
      s.position = 'fixed';
      s.pointerEvents = 'none';
      s.opacity = '0.92';
      s.zIndex = '9999';
      s.boxShadow = '0 12px 40px rgba(0,0,0,0.35)';
      s.borderRadius = '12px';
      s.background = 'var(--color-surface, #1e1e1e)';
      s.border = `1px solid ${columns.find(c => c.id === card.columnId)?.color || '#98cbff'}`;
      s.width = `${cardEl.offsetWidth}px`;
      s.left = '-9999px';
      s.top = '-9999px';
      s.transition = 'none';
      document.body.appendChild(ghost);
      state.ghostEl = ghost;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
    };

    const onCardPointerMove = (e: PointerEvent) => {
      const state = cardDragStateRef.current;
      if (!state.draggedCard) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      if (!state.isDragging) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        state.isDragging = true;
      }

      // Move ghost
      if (state.ghostEl) {
        state.ghostEl.style.left = `${e.clientX + 16}px`;
        state.ghostEl.style.top = `${e.clientY + 8}px`;
      }

      // ── Auto-scroll vertically (within column's card list) and horizontally (between columns) ──
      const scrollParent = container.parentElement as HTMLElement | null;
      if (scrollParent) {
        const pr = scrollParent.getBoundingClientRect();
        const hThreshold = 35;
        // Horizontal auto-scroll
        if (e.clientX < pr.left + hThreshold) {
          if (state.autoScrollDirectionH !== 'left') {
            state.autoScrollDirectionH = 'left';
            const doScrollH = () => {
              if (state.autoScrollDirectionH !== 'left') return;
              scrollParent.scrollLeft -= 12;
              state.autoScrollRafH = requestAnimationFrame(doScrollH);
            };
            state.autoScrollRafH = requestAnimationFrame(doScrollH);
          }
        } else if (e.clientX > pr.right - hThreshold) {
          if (state.autoScrollDirectionH !== 'right') {
            state.autoScrollDirectionH = 'right';
            const doScrollH = () => {
              if (state.autoScrollDirectionH !== 'right') return;
              scrollParent.scrollLeft += 12;
              state.autoScrollRafH = requestAnimationFrame(doScrollH);
            };
            state.autoScrollRafH = requestAnimationFrame(doScrollH);
          }
        } else {
          if (state.autoScrollRafH) {
            cancelAnimationFrame(state.autoScrollRafH);
            state.autoScrollRafH = null;
            state.autoScrollDirectionH = null;
          }
        }
        // Vertical auto-scroll within the current column
        const colEls = container.querySelectorAll('[data-board-col-id]');
        let currentColScroll: HTMLElement | null = null;
        let currentColId: string | null = null;
        colEls.forEach(el => {
          const rect = el.getBoundingClientRect();
          if (e.clientX >= rect.left && e.clientX <= rect.right) {
            currentColScroll = (el as HTMLElement).querySelector('[data-board-card-scroll]') as HTMLElement | null;
            currentColId = el.getAttribute('data-board-col-id');
          }
        });
        if (currentColScroll) {
          const cr = (currentColScroll as HTMLElement).getBoundingClientRect();
          const vThreshold = 25;
          if (e.clientY < cr.top + vThreshold) {
            if (state.autoScrollDirectionV !== 'up' || state.currentScrollColId !== currentColId) {
              state.autoScrollDirectionV = 'up';
              state.currentScrollColId = currentColId;
              // Cancel any existing vertical scroll loop
              if (state.autoScrollRafV) {
                cancelAnimationFrame(state.autoScrollRafV);
                state.autoScrollRafV = null;
              }
              const doScrollV = () => {
                if (state.autoScrollDirectionV !== 'up') return;
                // Re-query scroll element each frame using stored column ID
                const scrollEl = state.currentScrollColId
                  ? container.querySelector(`[data-board-col-id="${state.currentScrollColId}"] [data-board-card-scroll]`) as HTMLElement | null
                  : null;
                if (scrollEl) scrollEl.scrollTop -= 10;
                state.autoScrollRafV = requestAnimationFrame(doScrollV);
              };
              state.autoScrollRafV = requestAnimationFrame(doScrollV);
            }
          } else if (e.clientY > cr.bottom - vThreshold) {
            if (state.autoScrollDirectionV !== 'down' || state.currentScrollColId !== currentColId) {
              state.autoScrollDirectionV = 'down';
              state.currentScrollColId = currentColId;
              if (state.autoScrollRafV) {
                cancelAnimationFrame(state.autoScrollRafV);
                state.autoScrollRafV = null;
              }
              const doScrollV = () => {
                if (state.autoScrollDirectionV !== 'down') return;
                const scrollEl = state.currentScrollColId
                  ? container.querySelector(`[data-board-col-id="${state.currentScrollColId}"] [data-board-card-scroll]`) as HTMLElement | null
                  : null;
                if (scrollEl) scrollEl.scrollTop += 10;
                state.autoScrollRafV = requestAnimationFrame(doScrollV);
              };
              state.autoScrollRafV = requestAnimationFrame(doScrollV);
            }
          } else {
            if (state.autoScrollRafV) {
              cancelAnimationFrame(state.autoScrollRafV);
              state.autoScrollRafV = null;
              state.autoScrollDirectionV = null;
              state.currentScrollColId = null;
            }
          }
        } else {
          // Cursor not over any column — ensure vertical scroll is cancelled
          if (state.autoScrollRafV) {
            cancelAnimationFrame(state.autoScrollRafV);
            state.autoScrollRafV = null;
            state.autoScrollDirectionV = null;
            state.currentScrollColId = null;
          }
        }
      }

      // Find target column by X position
      const colEls = container.querySelectorAll('[data-board-col-id]');
      let targetColId: string | null = null;
      let minXDist = Infinity;

      colEls.forEach(el => {
        const rect = el.getBoundingClientRect();
        // Check if cursor is roughly within the column's horizontal bounds
        const colCenter = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - colCenter);
        if (dist < rect.width / 2 + 10 && dist < minXDist) {
          minXDist = dist;
          targetColId = el.getAttribute('data-board-col-id');
        }
      });

      if (!targetColId) {
        setCardDropTarget(null);
        setCardDragOverColId(null);
        state.targetColId = null;
        state.beforeCardId = null;
        state.position = null;
        return;
      }

      setCardDragOverColId(targetColId);
      state.targetColId = targetColId;

      // Within the target column, find closest card by Y position
      const targetColEl = container.querySelector(`[data-board-col-id="${targetColId}"]`);
      const cardEls = targetColEl?.querySelectorAll('[data-board-card-id]') || [];
      
      let beforeCardId: string | null = null;
      let position: 'before' | 'after' | null = null;
      let closestYDist = Infinity;

      cardEls.forEach(el => {
        const id = el.getAttribute('data-board-card-id');
        if (!id || id === state.draggedCard!.id) return;

        const rect = el.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);

        if (dist < closestYDist && dist < 200) {
          closestYDist = dist;
          beforeCardId = id;
          position = e.clientY < midY ? 'before' : 'after';
        }
      });

      if (beforeCardId && position) {
        setCardDropTarget({
          columnId: targetColId,
          beforeCardId,
          position,
        });
        state.beforeCardId = beforeCardId;
        state.position = position;
      } else {
        setCardDropTarget(null);
        state.beforeCardId = null;
        state.position = null;
      }
    };

    const onCardPointerUp = () => {
      const state = cardDragStateRef.current;
      const card = state.draggedCard;

      // Stop auto-scroll
      if (state.autoScrollRafV) {
        cancelAnimationFrame(state.autoScrollRafV);
        state.autoScrollRafV = null;
        state.autoScrollDirectionV = null;
      }
      if (state.autoScrollRafH) {
        cancelAnimationFrame(state.autoScrollRafH);
        state.autoScrollRafH = null;
        state.autoScrollDirectionH = null;
      }

      // Clean up ghost
      if (state.ghostEl && document.body.contains(state.ghostEl)) {
        document.body.removeChild(state.ghostEl);
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Execute drop
      if (state.isDragging && card && state.targetColId) {
        const targetColId = state.targetColId;
        const beforeCardId = state.beforeCardId;
        const position = state.position || 'after';
        moveCardRef.current?.(card, targetColId, beforeCardId, position);
      }

      // Reset state
      setDraggedCard(null);
      setCardDropTarget(null);
      setCardDragOverColId(null);
      state.isDragging = false;
      state.draggedCard = null;
      state.targetColId = null;
      state.beforeCardId = null;
      state.position = null;
      state.ghostEl = null;
      state.currentScrollColId = null;
    };

    container.addEventListener('pointerdown', onCardPointerDown);
    document.addEventListener('pointermove', onCardPointerMove);
    document.addEventListener('pointerup', onCardPointerUp);
    document.addEventListener('pointercancel', onCardPointerUp);

    return () => {
      container.removeEventListener('pointerdown', onCardPointerDown);
      document.removeEventListener('pointermove', onCardPointerMove);
      document.removeEventListener('pointerup', onCardPointerUp);
      document.removeEventListener('pointercancel', onCardPointerUp);
    };
  }, [cards.length, columns.length]);

  const saveCards = (newCards: Card[]) => {
    setCards(newCards);
    if (activePageId) updatePageContent(activePageId, newCards);
  };

  const saveColumns = (newCols: ColumnDef[]) => {
    setColumns(newCols);
    if (activePageId) useProjectStore.getState().updatePage(activePageId, {
      metadata: { ...(activePage?.metadata || {}), boardColumns: newCols }
    });
  };

  const saveTagDefs = (defs: TagDef[]) => {
    setTagDefs(defs);
    if (activePageId) useProjectStore.getState().updatePage(activePageId, {
      metadata: { ...(activePage?.metadata || {}), boardTags: defs }
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

  const addColumn = () => {
    const title = newColTitle.trim();
    if (!title) return;
    if (columns.some(c => c.title.toLowerCase() === title.toLowerCase())) return;
    const usedColors = new Set(columns.map(c => c.color));
    let color = '#6366f1';
    const palette = ['#3b82f6','#f59e0b','#10b981','#f43f5e','#8b5cf6','#06b6d4','#ec4899','#14b8a6','#f97316','#6366f1','#84cc16','#d946ef'];
    for (const c of palette) { if (!usedColors.has(c)) { color = c; break; } }
    saveColumns([...columns, { id: `col-${genId()}`, title, color }]);
    setNewColTitle('');
    setShowAddCol(false);
  };

  const renameColumn = (id: string, title: string) => {
    if (!title.trim()) return;
    if (columns.some(c => c.id !== id && c.title.toLowerCase() === title.trim().toLowerCase())) return;
    saveColumns(columns.map(c => c.id === id ? { ...c, title: title.trim() } : c));
    setEditColId(null);
  };

  const deleteColumn = (id: string) => {
    saveColumns(columns.filter(c => c.id !== id));
    saveCards(cards.filter(c => c.columnId !== id));
  };

  const openCardForm = (columnId: string) => {
    setFormColId(columnId);
    setFormTitle('');
    setFormDesc('');
    setFormTags('');
    setFormError('');
    setShowCardForm(true);
  };

  const addCard = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    const tags = formTags.split(',').map(t => t.trim()).filter(Boolean);
    saveCards([...cards, {
      id: genId(),
      title: formTitle.trim(),
      description: formDesc.trim(),
      tags,
      columnId: formColId,
    }]);
    setShowCardForm(false);
  };

  const deleteCard = (id: string) => {
    saveCards(cards.filter(c => c.id !== id));
    if (showCardDetail === id) setShowCardDetail(null);
  };

  const openDetail = (card: Card) => {
    setShowCardDetail(card.id);
    setEditDetailTitle(card.title);
    setEditDetailDesc(card.description);
    setEditDetailTags(card.tags.join(', '));
    setEditingCardId(null);
  };

  const saveDetail = () => {
    const card = cards.find(c => c.id === showCardDetail);
    if (!card) return;
    const tags = editDetailTags.split(',').map(t => t.trim()).filter(Boolean);
    saveCards(cards.map(c => c.id === showCardDetail ? {
      ...c,
      title: editDetailTitle.trim(),
      description: editDetailDesc.trim(),
      tags,
    } : c));
    setEditingCardId(null);
  };

  // ── Linked pages helpers ──

  const linkPageToCard = (cardId: string, pageId: string, pageTitle: string) => {
    const updated = cards.map(c => {
      if (c.id !== cardId) return c;
      const existing = c.linkedPages || [];
      if (existing.some(lp => lp.pageId === pageId)) return c; // already linked
      return { ...c, linkedPages: [...existing, { pageId, pageTitle }] };
    });
    saveCards(updated);
  };

  const unlinkPageFromCard = (cardId: string, pageId: string) => {
    const updated = cards.map(c => {
      if (c.id !== cardId) return c;
      return { ...c, linkedPages: (c.linkedPages || []).filter(lp => lp.pageId !== pageId) };
    });
    saveCards(updated);
  };

  // Pages available to link (all project pages except the current board page)
  const linkablePages = useMemo(() => {
    if (!project) return [];
    return pages
      .filter((p: any) => p.project_id === project.id && p.id !== activePageId && p.type !== 'dashboard')
      .map((p: any) => ({ id: p.id, title: p.title || 'Untitled', icon: p.icon || 'description' }));
  }, [pages, project, activePageId]);

  const filteredLinkablePages = useMemo(() => {
    if (!linkPageSearch.trim()) return linkablePages;
    const q = linkPageSearch.toLowerCase();
    return linkablePages.filter((p: any) => p.title.toLowerCase().includes(q));
  }, [linkablePages, linkPageSearch]);

  // ── Card reorder helpers ──

  const reorderCards = useCallback((
    allCards: Card[],
    draggedId: string,
    targetColumnId: string,
    beforeCardId: string | null,
    position: 'before' | 'after'
  ): Card[] => {
    const src = allCards.find(c => c.id === draggedId);
    if (!src) return allCards;

    const withoutDragged = allCards.filter(c => c.id !== draggedId);
    const targetColCards = withoutDragged.filter(c => c.columnId === targetColumnId);

    let insertAtColIdx: number;
    if (!beforeCardId || !targetColCards.length) {
      insertAtColIdx = targetColCards.length;
    } else {
      const idx = targetColCards.findIndex(c => c.id === beforeCardId);
      insertAtColIdx = idx < 0 ? targetColCards.length : (position === 'before' ? idx : idx + 1);
    }

    let insertAtFullIdx: number;
    if (insertAtColIdx >= targetColCards.length) {
      const lastTarget = targetColCards[targetColCards.length - 1];
      insertAtFullIdx = lastTarget ? withoutDragged.indexOf(lastTarget) + 1 : withoutDragged.length;
    } else {
      insertAtFullIdx = withoutDragged.indexOf(targetColCards[insertAtColIdx]);
    }

    const result = [...withoutDragged];
    result.splice(insertAtFullIdx, 0, { ...src, columnId: targetColumnId });
    return result;
  }, []);

  // ── Move functions called via refs from pointer-based drag handlers ──

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    const newCols = [...columns];
    const [moved] = newCols.splice(fromIndex, 1);
    newCols.splice(toIndex, 0, moved);
    saveColumns(newCols);
  }, [columns, saveColumns]);
  moveColRef.current = moveColumn;

  const moveCard = useCallback((
    dragged: Card,
    targetColId: string,
    beforeCardId: string | null,
    position: 'before' | 'after'
  ) => {
    const reordered = reorderCards(cards, dragged.id, targetColId, beforeCardId, position);
    saveCards(reordered);
  }, [cards, reorderCards, saveCards]);
  moveCardRef.current = moveCard;

  // Sort cards within columns when sortBy is active
  const sortedCards = useMemo(() => {
    if (sortBy === 'default') return cards;
    if (sortBy === 'tags') {
      return [...cards].sort((a, b) => {
        const aTag = a.tags.length ? a.tags[0].toLowerCase() : 'zzzz';
        const bTag = b.tags.length ? b.tags[0].toLowerCase() : 'zzzz';
        if (aTag !== bTag) return aTag.localeCompare(bTag);
        // Preserve original order within same tag group
        return cards.indexOf(a) - cards.indexOf(b);
      });
    }
    return cards;
  }, [cards, sortBy]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setShowSort(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4 flex-shrink-0">
        <span className="material-symbols-outlined text-[22px] text-primary">dashboard</span>
        <h2 className="text-lg font-bold text-on-surface">Board</h2>
        <span className="text-[11px] text-on-surface-variant/60">{cards.length} cards</span>
        <div className="ml-auto flex items-center gap-2" />
        <div className="relative" ref={sortRef}>
          <button
            onClick={() => setShowSort(!showSort)}
            className="px-2.5 py-1.5 rounded-lg border border-outline/20 text-xs font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5 bg-surface/50"
          >
            <span className="material-symbols-outlined text-[12px]">sort</span>
            {sortBy === 'default' ? 'Order' : 'By Tags'}
          </button>
          {showSort && (
            <div className="absolute top-full right-0 mt-1 z-50 bg-surface border border-outline/20 rounded-xl shadow-2xl p-1.5 w-32 backdrop-blur-xl">
              {([['default', 'Default'], ['tags', 'By Tags']] as const).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => { setSortBy(key); setShowSort(false); }}
                  className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-all ${
                    sortBy === key ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface/50'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => setShowTagManager(true)}
          className="px-2.5 py-1.5 rounded-lg border border-outline/20 text-xs font-medium text-on-surface-variant hover:border-primary/30 hover:text-primary transition-all flex items-center gap-1.5 bg-surface/50"
        >
          <span className="material-symbols-outlined text-[12px]">label</span>
          Tags
        </button>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0 pb-2">
        <div ref={columnsContainerRef} className="flex gap-4 h-full min-w-max">
          {columns.map((col, colIndex) => (
            <div
              key={col.id}
              data-board-col-index={colIndex}
              data-board-col-id={col.id}
              className={`w-72 flex flex-col bg-surface/40 rounded-xl border border-outline/10 h-full max-h-full transition-all duration-100 ${
                draggedColumn?.id === col.id ? 'opacity-40 scale-[0.97]' : ''
              } ${
                draggedCard && cardDragOverColId === col.id && !cardDropTarget ? 'border-primary/30 ring-1 ring-primary/20' : ''
              }`}
              style={{
                ['--col-color' as string]: col.color,
              }}
            >
              {/* Column header - drag via handle button */}
              <div data-board-col-header className="p-3 border-b flex items-center justify-between flex-shrink-0 rounded-t-xl group/col select-none"
                style={{ borderColor: `${col.color}30`, backgroundColor: `${col.color}08` }}
              >
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <Tooltip label="Drag to reorder column">
                    <button
                      data-board-col-drag-handle
                      className="flex items-center justify-center w-5 h-6 rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0"
                    >
                      <span className="material-symbols-outlined text-[14px] pointer-events-none">drag_indicator</span>
                    </button>
                  </Tooltip>
                  {editingColColor === col.id ? (
                    <input
                      type="color"
                      value={col.color}
                      onChange={e => { saveColumns(columns.map(c => c.id === col.id ? { ...c, color: e.target.value } : c)); }}
                      onBlur={() => setEditingColColor(null)}
                      className="w-5 h-5 rounded cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded"
                      autoFocus
                    />
                  ) : (
                    <button
                      onClick={() => setEditingColColor(col.id)}
                      className="w-5 h-5 rounded border border-outline/20 flex-shrink-0 hover:scale-110 transition-transform"
                      style={{ backgroundColor: col.color }}
                      title="Change column color"
                    />
                  )}
                  {editColId === col.id ? (
                    <input
                      ref={colInputRef}
                      type="text"
                      value={editColTitle}
                      onChange={e => setEditColTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') renameColumn(col.id, editColTitle);
                        if (e.key === 'Escape') setEditColId(null);
                      }}
                      onBlur={() => renameColumn(col.id, editColTitle)}
                      className="flex-1 bg-surface border border-primary/50 rounded-lg px-2 py-1 text-sm font-semibold text-on-surface outline-none min-w-0"
                    />
                  ) : (
                    <h3
                      onClick={() => { setEditColId(col.id); setEditColTitle(col.title); }}
                      className="font-semibold text-sm text-on-surface cursor-text truncate flex-1"
                      style={{ color: col.color }}
                    >
                      {col.title}
                    </h3>
                  )}
                </div>
                  <span className="bg-primary/20 text-primary text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                    {cards.filter(c => c.columnId === col.id).length}
                  </span>
                  <Tooltip label="Delete column">
                    <button
                      onClick={() => deleteColumn(col.id)}
                      className="w-6 h-6 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover/col:opacity-100"
                    >
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </Tooltip>
                </div>

              {/* Cards */}
              <div data-board-card-scroll className="flex-1 p-2.5 overflow-y-auto space-y-2">
                {sortedCards.filter(c => c.columnId === col.id).map(card => (
                  <React.Fragment key={card.id}>
                    {/* Drop indicator above card — animated insertion line */}
                    {draggedCard && draggedCard.id !== card.id && cardDropTarget?.columnId === col.id && cardDropTarget?.beforeCardId === card.id && cardDropTarget?.position === 'before' && (
                      <div className="board-drop-indicator" style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}60` }} />
                    )}
                    <div
                      data-board-card-id={card.id}
                      onClick={() => openDetail(card)}
                      className={`rounded-xl border shadow-sm select-none hover:shadow-lg hover:border-primary/40 transition-all group/card relative overflow-hidden ${
                        draggedCard?.id === card.id ? 'opacity-30 scale-[0.97]' : ''
                      }`}
                      style={{
                        backgroundColor: `${col.color}15`,
                        borderColor: draggedCard?.id === card.id ? `${col.color}10` : `${col.color}25`,
                      }}
                    >
                      {/* Title section */}
                      <div className="flex items-start gap-1.5 px-3 pt-3 pb-1.5"
                        style={{ backgroundColor: `${col.color}08`, borderBottom: card.description || card.tags.length > 0 ? `1px solid ${col.color}15` : 'none' }}
                      >
                        <Tooltip label="Drag to reorder card">
                          <button
                            data-board-card-drag-handle
                            className="flex items-center justify-center w-5 h-5 rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0 mt-0.5 opacity-0 group-hover/card:opacity-100"
                          >
                            <span className="material-symbols-outlined text-[13px] pointer-events-none">drag_indicator</span>
                          </button>
                        </Tooltip>
                        <p className="text-on-surface text-sm font-medium flex-1 leading-snug break-words">{card.title}</p>
                      </div>
                      {/* Description section */}
                      {card.description && (
                        <div className="px-3 py-1.5" style={{ borderBottom: card.tags.length > 0 ? `1px solid ${col.color}15` : 'none' }}>
                          <div className="relative">
                            <p className={`text-[11px] text-on-surface-variant/70 leading-relaxed break-words whitespace-pre-wrap ${!expandedDescriptions[card.id] ? 'line-clamp-4' : ''}`}>
                              {card.description}
                            </p>
                            {card.description.length > 120 && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setExpandedDescriptions(prev => ({ ...prev, [card.id]: !prev[card.id] }));
                                }}
                                className="mt-1 text-[10px] font-medium text-primary hover:text-primary/80 transition-colors"
                              >
                                {expandedDescriptions[card.id] ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Tags section */}
                      {card.tags.length > 0 && (
                        <div className="px-3 pb-3 pt-1.5" style={{ backgroundColor: `${col.color}06` }}>
                          <div className="flex items-center gap-1 flex-wrap">
                            {card.tags.slice(0, 3).map(tag => (
                              <span
                                key={tag}
                                className="px-2 py-0.5 rounded-full text-[9px] font-medium leading-tight"
                                style={{ backgroundColor: `${getTagColor(tag)}20`, color: getTagColor(tag) }}
                              >{tag}</span>
                            ))}
                            {card.tags.length > 3 && <span className="text-[9px] text-on-surface-variant/50">+{card.tags.length - 3}</span>}
                          </div>
                        </div>
                      )}
                      {/* Linked Pages badges */}
                      {card.linkedPages && card.linkedPages.length > 0 && (
                        <div className="px-3 pb-3 pt-1.5" style={{ backgroundColor: `${col.color}04` }}>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {card.linkedPages.slice(0, 2).map(lp => (
                              <button
                                key={lp.pageId}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const p = pages.find((pg: any) => pg.id === lp.pageId);
                                  if (p) {
                                    setActivePage(lp.pageId);
                                    setShowCardDetail(null);
                                  }
                                }}
                                className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-medium leading-tight transition-all hover:opacity-80"
                                style={{ backgroundColor: `${col.color}15`, color: col.color }}
                                title={`Open ${lp.pageTitle}`}
                              >
                                <span className="material-symbols-outlined text-[10px]">article</span>
                                <span className="max-w-[80px] truncate">{lp.pageTitle}</span>
                              </button>
                            ))}
                            {card.linkedPages.length > 2 && (
                              <span className="text-[9px] text-on-surface-variant/50 flex items-center gap-0.5">
                                <span className="material-symbols-outlined text-[10px]">link</span>
                                +{card.linkedPages.length - 2}
                              </span>
                            )}
                          </div>
                        </div>
                      )}
                      {/* Delete button */}
                      <Tooltip label="Delete card">
                        <button
                          data-drag-hide
                          onClick={(e) => { e.stopPropagation(); deleteCard(card.id); }}
                          className="absolute top-2 right-2 w-6 h-6 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover/card:opacity-100"
                        >
                          <span className="material-symbols-outlined text-[14px]">close</span>
                        </button>
                      </Tooltip>
                    </div>
                    {/* Drop indicator below card — animated insertion line */}
                    {draggedCard && draggedCard.id !== card.id && cardDropTarget?.columnId === col.id && cardDropTarget?.beforeCardId === card.id && cardDropTarget?.position === 'after' && (
                      <div className="board-drop-indicator" style={{ backgroundColor: col.color, boxShadow: `0 0 8px ${col.color}60` }} />
                    )}
                  </React.Fragment>
                ))}
                <button
                  onClick={() => openCardForm(col.id)}
                  className="w-full py-2.5 flex items-center justify-center gap-1.5 text-on-surface-variant hover:text-primary hover:bg-primary/10 rounded-lg transition-colors border border-dashed border-outline/20 hover:border-primary/50 text-xs font-medium"
                >
                  <span className="material-symbols-outlined text-[16px]">add</span>
                  Add Card
                </button>
              </div>
            </div>
          ))}

          {/* Add Column */}
          <div className="w-72 flex-shrink-0">
            {showAddCol ? (
              <div className="bg-surface/40 rounded-xl border border-outline/10 p-3">
                <input
                  type="text"
                  value={newColTitle}
                  onChange={e => setNewColTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addColumn(); if (e.key === 'Escape') setShowAddCol(false); }}
                  placeholder="Column name..."
                  className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3 py-2 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/40 mb-2"
                  autoFocus
                />
                <div className="flex items-center gap-2">
                  <button onClick={addColumn} className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all">Add</button>
                  <button onClick={() => setShowAddCol(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">Cancel</button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowAddCol(true)}
                className="w-full flex items-center justify-center gap-2 py-3 bg-surface/30 hover:bg-surface/50 border border-outline/10 hover:border-primary/30 rounded-xl text-on-surface-variant hover:text-primary transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                Add Column
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Add Card form modal */}
      {showCardForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowCardForm(false)}>
          <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-bold text-on-surface">Add Card</h3>
              <Tooltip label="Close">
                <button onClick={() => setShowCardForm(false)} className="p-1 rounded-lg hover:bg-surface/50 text-on-surface-variant">
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </Tooltip>
            </div>
            <form onSubmit={addCard} className="space-y-3">
              <input
                type="text"
                value={formTitle}
                onChange={e => setFormTitle(e.target.value)}
                placeholder="Title *"
                className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3.5 py-2.5 text-sm text-on-surface outline-none placeholder:text-on-surface-variant/40"
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
                <button type="button" onClick={() => setShowCardForm(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">Cancel</button>
                <button type="submit" className="px-5 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm">Add Card</button>
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
              <button onClick={addTagDef} className="px-3 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all shadow-sm flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">add</span>
                Add
              </button>
            </div>
            <div className="space-y-1 max-h-64 overflow-y-auto">
              {tagDefs.length === 0 && (
                <p className="text-xs text-on-surface-variant/60 py-4 text-center">No tags defined yet</p>
              )}
              {tagDefs.map(tag => (
                <div key={tag.name} className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-surface/50 transition-colors group">
                  <input
                    type="color"
                    value={tag.color}
                    onChange={e => setTagColor(tag.name, e.target.value)}
                    className="w-6 h-6 rounded-lg cursor-pointer border-0 p-0 bg-transparent [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded-lg [&::-webkit-color-swatch]:border-none"
                  />
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
                    <span onClick={() => { setEditingTag(tag.name); setEditTagName(tag.name); }} className="flex-1 text-sm font-medium text-on-surface cursor-text">
                      {tag.name}
                    </span>
                  )}
                  <Tooltip label="Delete tag">
                    <button onClick={() => removeTagDef(tag.name)} className="w-7 h-7 rounded-lg flex items-center justify-center text-on-surface-variant/40 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100">
                      <span className="material-symbols-outlined text-[14px]">delete</span>
                    </button>
                  </Tooltip>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Card detail panel */}
      {showCardDetail && (() => {
        const card = cards.find(c => c.id === showCardDetail);
        if (!card) return null;
        const isEditing = editingCardId === card.id;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => { if (!isEditing) setShowCardDetail(null); }}>
            <div className="bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
              <div className="flex items-start justify-between mb-5">
                {isEditing ? (
                  <div className="flex-1 space-y-3">
                    <input
                      type="text"
                      value={editDetailTitle}
                      onChange={e => setEditDetailTitle(e.target.value)}
                      className="w-full bg-surface/50 border border-primary/50 rounded-lg px-3 py-2 text-base font-bold text-on-surface outline-none"
                    />
                    <textarea
                      value={editDetailDesc}
                      onChange={e => setEditDetailDesc(e.target.value)}
                      rows={3}
                      className="w-full bg-surface/50 border border-outline/20 focus:border-primary rounded-lg px-3 py-2 text-sm text-on-surface outline-none resize-none placeholder:text-on-surface-variant/40"
                      placeholder="Description..."
                    />
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider">Tags</p>
                      {tagDefs.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {tagDefs.map(tag => {
                            const active = editDetailTags.split(',').map(t => t.trim().toLowerCase()).includes(tag.name);
                            return (
                              <button
                                key={tag.name}
                                type="button"
                                onClick={() => {
                                  const current = editDetailTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
                                  if (current.includes(tag.name)) {
                                    setEditDetailTags(current.filter(t => t !== tag.name).join(', '));
                                  } else {
                                    setEditDetailTags(current.length ? [...current, tag.name].join(', ') : tag.name);
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
                        <p className="text-[10px] text-on-surface-variant/30 italic">No tags defined</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveDetail} className="px-4 py-2 rounded-lg bg-primary text-on-primary text-xs font-medium hover:opacity-90 transition-all">Save</button>
                      <button onClick={() => setEditingCardId(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-w-0">
                    <h3 className="text-lg font-bold text-on-surface break-words">{card.title}</h3>
                    {card.description && (
                      <p className="text-sm text-on-surface-variant/80 mt-2 leading-relaxed whitespace-pre-wrap break-words">{card.description}</p>
                    )}
                    {card.tags.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-3 flex-wrap">
                        {card.tags.map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium"
                            style={{ backgroundColor: `${getTagColor(tag)}20`, color: getTagColor(tag) }}
                          >#{tag}</span>
                        ))}
                      </div>
                    )}
                    {/* ── Linked Pages Section ── */}
                    <div className="mt-4 pt-3 border-t border-outline/10">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-[10px] text-on-surface-variant/50 font-medium uppercase tracking-wider flex items-center gap-1">
                          <span className="material-symbols-outlined text-[12px]">link</span>
                          Linked Pages
                        </p>
                        <button
                          onClick={() => { setShowLinkPageSearch(!showLinkPageSearch); setLinkPageSearch(''); }}
                          className="p-1 rounded-lg text-on-surface-variant/50 hover:text-primary hover:bg-primary/10 transition-all"
                        >
                          <span className="material-symbols-outlined text-[14px]">add_link</span>
                        </button>
                      </div>
                      {showLinkPageSearch && (
                        <div className="mb-2 space-y-1">
                          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface/50 border border-outline/20">
                            <span className="material-symbols-outlined text-[12px] text-on-surface-variant/50">search</span>
                            <input
                              type="text"
                              value={linkPageSearch}
                              onChange={e => setLinkPageSearch(e.target.value)}
                              placeholder="Search pages to link..."
                              className="flex-1 bg-transparent outline-none text-xs text-on-surface placeholder:text-on-surface-variant/30"
                              autoFocus
                            />
                          </div>
                          <div className="max-h-36 overflow-y-auto space-y-0.5">
                            {filteredLinkablePages.length === 0 ? (
                              <p className="text-[10px] text-on-surface-variant/30 italic px-1 py-1">No pages found</p>
                            ) : (
                              filteredLinkablePages.map((p: any) => {
                                const alreadyLinked = (card.linkedPages || []).some(lp => lp.pageId === p.id);
                                return (
                                  <button
                                    key={p.id}
                                    onClick={() => {
                                      if (!alreadyLinked) {
                                        linkPageToCard(card.id, p.id, p.title);
                                        setShowLinkPageSearch(false);
                                      }
                                    }}
                                    disabled={alreadyLinked}
                                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs transition-all ${
                                      alreadyLinked
                                        ? 'text-on-surface-variant/30 cursor-not-allowed'
                                        : 'text-on-surface hover:bg-primary/10 hover:text-primary'
                                    }`}
                                  >
                                    <span className="material-symbols-outlined text-[12px]">{p.icon}</span>
                                    <span className="truncate flex-1">{p.title}</span>
                                    {alreadyLinked && <span className="text-[9px] text-primary/50">Linked</span>}
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      )}
                      {(card.linkedPages || []).length === 0 ? (
                        <p className="text-[10px] text-on-surface-variant/30 italic">No linked pages</p>
                      ) : (
                        <div className="space-y-1">
                          {(card.linkedPages || []).map(lp => (
                            <div key={lp.pageId} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 hover:bg-primary/10 transition-all group/link">
                              <button
                                onClick={() => {
                                  const p = pages.find((pg: any) => pg.id === lp.pageId);
                                  if (p) {
                                    setActivePage(lp.pageId);
                                    setShowCardDetail(null);
                                  }
                                }}
                                className="flex items-center gap-1.5 flex-1 min-w-0 text-left"
                              >
                                <span className="material-symbols-outlined text-[12px] text-primary/70">article</span>
                                <span className="text-xs text-on-surface truncate">{lp.pageTitle}</span>
                              </button>
                              <button
                                onClick={() => unlinkPageFromCard(card.id, lp.pageId)}
                                className="p-0.5 rounded text-on-surface-variant/30 hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover/link:opacity-100"
                                title="Unlink page"
                              >
                                <span className="material-symbols-outlined text-[12px]">close</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
              {!isEditing && (
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-outline/10">
                  <button
                    onClick={() => { setEditingCardId(card.id); }}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={() => deleteCard(card.id)}
                    className="px-4 py-2 rounded-lg text-xs font-medium text-error hover:bg-error/10 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[14px]">delete</span>
                    Delete
                  </button>
                  <button onClick={() => setShowCardDetail(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-on-surface-variant hover:bg-surface/50 transition-all">Close</button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}