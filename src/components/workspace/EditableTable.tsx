import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useProjectStore } from '../../stores/projectStore';
import { useToastStore } from '../../stores/toastStore';
import { ColorPicker } from './ColorPicker';
import { Tooltip } from '../Tooltip';

export type ColumnType = 'text' | 'predefined' | 'link' | 'page link' | 'date' | 'attachment' | 'gallery';

export interface PredefinedOption {
  id: string;
  value: string;
  color: string;
}

export interface TableColumn {
  id: string;
  name: string;
  type: ColumnType;
  icon?: string;
  options?: PredefinedOption[];
}

interface GalleryItem {
  id: string;
  url: string;
  title: string;
  description: string;
  tags: string[];
  createdAt: string;
}

/* ─── default icons per column type ─── */
const COLUMN_TYPE_ICONS: Record<ColumnType, string> = {
  text: 'text_fields',
  predefined: 'label',
  link: 'link',
  'page link': 'open_in_new',
  date: 'calendar_month',
  attachment: 'attach_file',
  gallery: 'photo_library',
};

function getDefaultIconForType(type: ColumnType): string {
  return COLUMN_TYPE_ICONS[type] || 'text_fields';
}

/* ─── helpers ─── */
function parseMulti(value: string): string[] {
  if (!value) return [];
  return value.split(',').filter(Boolean);
}
function serializeMulti(ids: string[]): string {
  return ids.join(',');
}

/* ─── click-outside hook ─── */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler]);
}

/* ═══════════════════════════════════════════════
   MAIN TABLE
   ═══════════════════════════════════════════════ */
export function EditableTable() {
  const { pages, activePageId, updatePageContent, updatePage } = useProjectStore();
  const activePage = pages.find(p => p.id === activePageId);

  const [data, setData] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [graphVisibleColumns, setGraphVisibleColumns] = useState<string[]>([]);

  // UI State
  const iconBackfillDoneRef = useRef(false);
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [addColPos, setAddColPos] = useState<{ top: number; left: number } | null>(null);
  const addColBtnRef = useRef<HTMLButtonElement>(null);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<ColumnType>('text');
  const [newColOptions, setNewColOptions] = useState<PredefinedOption[]>([]);
  const [optValue, setOptValue] = useState('');
  const [optColor, setOptColor] = useState('#60a5fa');
  const [showManageCols, setShowManageCols] = useState(false);
  const [showVisibility, setShowVisibility] = useState(false);

  // Manage predefined popover state
  const [manageOptValue, setManageOptValue] = useState('');
  const [manageOptColor, setManageOptColor] = useState('#60a5fa');
  const [manageColId, setManageColId] = useState<string | null>(null);

  // Sort By state
  const [showSortBy, setShowSortBy] = useState(false);
  const [sortByColIds, setSortByColIds] = useState<string[]>([]);

  // Sticky first column
  const [stickyFirstColumn, setStickyFirstColumn] = useState(false);

  // Resize state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [rowHeights, setRowHeights] = useState<Record<number, number>>({});
  const [activeDrag, setActiveDrag] = useState<{ type: 'col' | 'row'; id: string | number; startPos: number; startSize: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // ── Row drag-and-drop state ──
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const rowDragStateRef = useRef({
    isDragging: false,
    draggedIndex: -1,
    startY: 0,
    ghostEl: null as HTMLElement | null,
    dropIndex: -1,
    dropPosition: null as 'above' | 'below' | null,
    autoScrollRaf: null as number | null,
    autoScrollDirection: null as 'up' | 'down' | null,
  });

  const moveRowRef = useRef<((fromIndex: number, toIndex: number) => void) | null>(null);

  // ── Column drag-and-drop state ──
  const theadRef = useRef<HTMLTableSectionElement>(null);
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

  const moveColRef = useRef<((fromIndex: number, toIndex: number) => void) | null>(null);

  // Track the current data reference to prevent the sync effect from overwriting local reorders
  const dataRef = useRef(data);
  dataRef.current = data;

  // ── Pointer-based row drag on tbody ──
  useEffect(() => {
    const tbody = tbodyRef.current;
    if (!tbody) return;

    const onPointerDown = (e: PointerEvent) => {
      const handle = (e.target as HTMLElement).closest('[data-row-drag-handle]') as HTMLElement | null;
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();

      const tr = handle.closest('tr') as HTMLTableRowElement | null;
      if (!tr) return;
      const index = parseInt(tr.getAttribute('data-row-index') || '-1');
      if (index < 0) return;

      const state = rowDragStateRef.current;
      state.draggedIndex = index;
      state.startY = e.clientY;
      state.isDragging = false;

      // Create ghost
      const ghost = tr.cloneNode(true) as HTMLElement;
      const s = ghost.style;
      s.position = 'fixed';
      s.pointerEvents = 'none';
      s.opacity = '0.92';
      s.zIndex = '9999';
      s.boxShadow = '0 12px 40px rgba(0,0,0,0.3)';
      s.transform = 'rotate(0.5deg) scale(0.98)';
      s.background = 'var(--color-surface, #1e1e1e)';
      s.borderRadius = '8px';
      s.width = `${tr.offsetWidth}px`;
      s.left = '-9999px';
      s.top = '-9999px';
      s.transition = 'none';
      // Hide row resize handles in ghost
      const resizeHandles = ghost.querySelectorAll('[class*="cursor-row-resize"]');
      resizeHandles.forEach(el => (el as HTMLElement).style.display = 'none');
      document.body.appendChild(ghost);
      state.ghostEl = ghost;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      tr.style.opacity = '0.3';
    };

    const onPointerMove = (e: PointerEvent) => {
      const state = rowDragStateRef.current;
      if (state.draggedIndex < 0) return;

      const dy = e.clientY - state.startY;
      if (!state.isDragging) {
        if (Math.abs(dy) < 5) return;
        state.isDragging = true;
      }

      // Move ghost
      if (state.ghostEl) {
        state.ghostEl.style.left = `${e.clientX + 16}px`;
        state.ghostEl.style.top = `${e.clientY + 8}px`;
      }

      // ── Auto-scroll when dragging near container edges ──
      const scrollContainer = tableRef.current?.parentElement;
      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        const threshold = 30;
        if (e.clientY < rect.top + threshold) {
          if (!state.autoScrollDirection) {
            state.autoScrollDirection = 'up';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'up') return;
              scrollContainer.scrollTop -= 10;
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else if (e.clientY > rect.bottom - threshold) {
          if (state.autoScrollDirection !== 'down') {
            state.autoScrollDirection = 'down';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'down') return;
              scrollContainer.scrollTop += 10;
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

      // Remove previous drop indicators
      tbody.querySelectorAll('.drop-above, .drop-below').forEach(el => {
        el.classList.remove('drop-above', 'drop-below');
      });

      // Ensure pointer is horizontally within the tbody bounds
      const tbodyRect = tbody.getBoundingClientRect();
      if (e.clientX < tbodyRect.left || e.clientX > tbodyRect.right) {
        state.dropIndex = -1;
        state.dropPosition = null;
        return;
      }

      // Find closest row by Y position — more reliable than elementsFromPoint
      // which can miss <tr> elements due to z-order stacking of <td> cells
      const rows = tbody.querySelectorAll('tr[data-row-index]');
      let closestIndex = -1;
      let closestPosition: 'above' | 'below' | null = null;
      let closestDist = Infinity;

      rows.forEach(row => {
        const index = parseInt(row.getAttribute('data-row-index') || '-1');
        if (index < 0 || index === state.draggedIndex) return;

        const rect = row.getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dist = Math.abs(e.clientY - midY);

        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = index;
          closestPosition = e.clientY < midY ? 'above' : 'below';
        }
      });

      if (closestIndex >= 0) {
        const targetRow = tbody.querySelector(`tr[data-row-index="${closestIndex}"]`);
        if (targetRow) {
          targetRow.classList.add(closestPosition === 'above' ? 'drop-above' : 'drop-below');
        }
        state.dropIndex = closestIndex;
        state.dropPosition = closestPosition;
      } else {
        state.dropIndex = -1;
        state.dropPosition = null;
      }
    };

    const onPointerUp = () => {
      const state = rowDragStateRef.current;

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

      // Remove drop indicators
      tbody.querySelectorAll('.drop-above, .drop-below').forEach(el => {
        el.classList.remove('drop-above', 'drop-below');
      });

      // Reset dragged row opacity
      const allRows = tbody.querySelectorAll('tr');
      allRows.forEach(tr => { tr.style.opacity = ''; });

      // Execute drop — bulk if multiple selected, single otherwise
      if (state.isDragging && state.draggedIndex >= 0 && state.dropIndex >= 0 && state.dropPosition) {
        const selectedCount = selectedRowIndicesRef.current.size;
        const isSelected = selectedRowIndicesRef.current.has(state.draggedIndex);
        if (isSelected && selectedCount > 1) {
          // Bulk: move all selected rows together
          moveRowsBulk(state.draggedIndex, state.dropIndex, state.dropPosition);
        } else {
          const targetIndex = state.dropPosition === 'above'
            ? state.dropIndex
            : state.dropIndex + 1;
          const finalIndex = targetIndex > state.draggedIndex ? targetIndex - 1 : targetIndex;
          moveRowRef.current?.(state.draggedIndex, finalIndex);
        }
      }

      // Reset cursor
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Reset state
      state.isDragging = false;
      state.draggedIndex = -1;
      state.dropIndex = -1;
      state.dropPosition = null;
      state.ghostEl = null;
    };

    tbody.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('pointermove', onPointerMove);
    document.addEventListener('pointerup', onPointerUp);
    document.addEventListener('pointercancel', onPointerUp);

    return () => {
      tbody.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerUp);
    };
  }, [data.length, columns.length]);

  // ── Pointer-based column drag on thead ──
  useEffect(() => {
    // Try to get thead from theadRef first, fallback to querying the table
    const thead = theadRef.current || (tableRef.current ? tableRef.current.querySelector('thead') : null);
    if (!thead) return;

    console.log('Setting up column drag listeners, thead:', thead);

    const onColPointerDown = (e: PointerEvent) => {
      // Only initiate column drag from the drag handle button (like row drag does)
      const handle = (e.target as HTMLElement).closest('[data-col-drag-handle]') as HTMLElement | null;
      if (!handle) return;
      e.preventDefault();
      e.stopPropagation();

      const th = handle.closest('th[data-col-drag-index]') as HTMLTableCellElement | null;
      if (!th) return;

      const index = parseInt(th.getAttribute('data-col-drag-index') || '-1');
      if (index < 0) return;

      const state = colDragStateRef.current;
      state.draggedIndex = index;
      state.startX = e.clientX;
      state.isDragging = false;

      // Create ghost
      const ghost = th.cloneNode(true) as HTMLElement;
      const s = ghost.style;
      s.position = 'fixed';
      s.pointerEvents = 'none';
      s.opacity = '0.92';
      s.zIndex = '9999';
      s.boxShadow = '0 12px 40px rgba(0,0,0,0.3)';
      s.transform = 'rotate(0.3deg) scale(0.97)';
      s.background = 'var(--color-surface, #1e1e1e)';
      s.borderRadius = '8px';
      s.width = `${th.offsetWidth}px`;
      s.left = '-9999px';
      s.top = '-9999px';
      s.transition = 'none';
      // Hide resize handles in ghost
      const resizeHandles = ghost.querySelectorAll('[class*="cursor-col-resize"]');
      resizeHandles.forEach(el => (el as HTMLElement).style.display = 'none');
      document.body.appendChild(ghost);
      state.ghostEl = ghost;

      document.body.style.cursor = 'grabbing';
      document.body.style.userSelect = 'none';
      th.style.opacity = '0.3';
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

      // ── Auto-scroll when dragging near container edges ──
      const scrollContainer = tableRef.current?.parentElement;
      if (scrollContainer) {
        const rect = scrollContainer.getBoundingClientRect();
        const threshold = 30;
        if (e.clientX < rect.left + threshold) {
          if (state.autoScrollDirection !== 'left') {
            state.autoScrollDirection = 'left';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'left') return;
              scrollContainer.scrollLeft -= 10;
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else if (e.clientX > rect.right - threshold) {
          if (state.autoScrollDirection !== 'right') {
            state.autoScrollDirection = 'right';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'right') return;
              scrollContainer.scrollLeft += 10;
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

      // Remove previous drop indicators
      const allTh = thead.querySelectorAll('th.drop-left, th.drop-right');
      allTh.forEach(el => el.classList.remove('drop-left', 'drop-right'));

      // Ensure pointer is vertically within the thead bounds (with tolerance)
      const theadRect = thead.getBoundingClientRect();
      const verticalTolerance = 20; // Allow 20px tolerance above/below
      if (e.clientY < theadRect.top - verticalTolerance || e.clientY > theadRect.bottom + verticalTolerance) {
        state.dropIndex = -1;
        state.dropPosition = null;
        return;
      }

      // Find closest th by X position
      const thElements = thead.querySelectorAll('th[data-col-drag-index]');
      let closestIndex = -1;
      let closestPosition: 'left' | 'right' | null = null;
      let closestDist = Infinity;

      thElements.forEach(th => {
        const index = parseInt(th.getAttribute('data-col-drag-index') || '-1');
        if (index < 0 || index === state.draggedIndex) return;

        const rect = th.getBoundingClientRect();
        const midX = rect.left + rect.width / 2;
        const dist = Math.abs(e.clientX - midX);

        if (dist < closestDist) {
          closestDist = dist;
          closestIndex = index;
          closestPosition = e.clientX < midX ? 'left' : 'right';
        }
      });

      if (closestIndex >= 0) {
        const targetTh = thead.querySelector(`th[data-col-drag-index="${closestIndex}"]`);
        if (targetTh) {
          targetTh.classList.add(closestPosition === 'left' ? 'drop-left' : 'drop-right');
        }
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

      // Remove drop indicators
      const allTh = thead.querySelectorAll('th.drop-left, th.drop-right');
      allTh.forEach(el => el.classList.remove('drop-left', 'drop-right'));

      // Reset dragged column opacity
      const allThElements = thead.querySelectorAll('th');
      allThElements.forEach(th => { th.style.opacity = ''; });

      // Execute drop — bulk if multiple selected, single otherwise
      if (state.isDragging && state.draggedIndex >= 0 && state.dropIndex >= 0 && state.dropPosition) {
        const draggedColId = columns[state.draggedIndex]?.id;
        const isSelected = draggedColId ? selectedColIdsRef.current.has(draggedColId) : false;
        const selectedCount = selectedColIdsRef.current.size;
        if (isSelected && selectedCount > 1) {
          // Bulk: move all selected columns together
          moveColsBulk(state.draggedIndex, state.dropIndex, state.dropPosition);
        } else {
          const targetIndex = state.dropPosition === 'left'
            ? state.dropIndex
            : state.dropIndex + 1;
          const finalIndex = targetIndex > state.draggedIndex ? targetIndex - 1 : targetIndex;
          moveColRef.current?.(state.draggedIndex, finalIndex);
        }
      }

      // Reset cursor
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Reset state
      state.isDragging = false;
      state.draggedIndex = -1;
      state.dropIndex = -1;
      state.dropPosition = null;
      state.ghostEl = null;
    };

    thead.addEventListener('pointerdown', onColPointerDown);
    document.addEventListener('pointermove', onColPointerMove);
    document.addEventListener('pointerup', onColPointerUp);
    document.addEventListener('pointercancel', onColPointerUp);

    return () => {
      thead.removeEventListener('pointerdown', onColPointerDown);
      document.removeEventListener('pointermove', onColPointerMove);
      document.removeEventListener('pointerup', onColPointerUp);
      document.removeEventListener('pointercancel', onColPointerUp);
    };
  }, [columns.length]);

  // ── Undo stack ──
  const undoStackRef = useRef<{ data: Record<string, any>[]; columns: TableColumn[]; rowHeights: Record<number, number>; columnWidths: Record<string, number> }[]>([]);
  const pushUndo = useCallback(() => {
    undoStackRef.current.push({
      data: JSON.parse(JSON.stringify(data)),
      columns: JSON.parse(JSON.stringify(columns)),
      rowHeights: { ...rowHeights },
      columnWidths: { ...columnWidths },
    });
    // Cap at 20 snapshots
    if (undoStackRef.current.length > 20) undoStackRef.current.shift();
  }, [data, columns, rowHeights, columnWidths]);

  const performUndo = useCallback(() => {
    const snapshot = undoStackRef.current.pop();
    if (!snapshot) {
      useToastStore.getState().toast('Nothing to undo.', 'info');
      return;
    }
    setData(snapshot.data);
    setColumns(snapshot.columns);
    setRowHeights(snapshot.rowHeights);
    setColumnWidths(snapshot.columnWidths);
    if (activePageId) {
      updatePageContent(activePageId, snapshot.data);
      saveMetadataRef.current(snapshot.columns);
    }
    useToastStore.getState().toast('Undo successful.', 'success');
  }, [activePageId, updatePageContent]);

  // ── Drag resize: global mouse handlers ──
  useEffect(() => {
    if (!activeDrag) return;
    const handleMouseMove = (e: MouseEvent) => {
      if (activeDrag.type === 'col') {
        const delta = e.clientX - activeDrag.startPos;
        const newWidth = Math.max(60, activeDrag.startSize + delta);
        setColumnWidths(prev => ({ ...prev, [activeDrag.id as string]: newWidth }));
      } else {
        const delta = e.clientY - activeDrag.startPos;
        const newHeight = Math.max(30, activeDrag.startSize + delta);
        setRowHeights(prev => ({ ...prev, [activeDrag.id as number]: newHeight }));
      }
    };
    const handleUp = () => setActiveDrag(null);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleUp);
    window.addEventListener('mouseleave', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleUp);
      window.removeEventListener('mouseleave', handleUp);
    };
  }, [activeDrag]);

  // ── Disable text selection && set cursor while dragging ──
  useEffect(() => {
    if (!activeDrag) return;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = activeDrag.type === 'col' ? 'col-resize' : 'row-resize';
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [activeDrag]);

  // ── Helper: persist column widths to metadata ──
  const saveColumnWidths = useCallback((widths: Record<string, number>) => {
    if (!activePageId) return;
    updatePage(activePageId, {
      metadata: {
        ...(activePage?.metadata || {}),
        columnWidths: widths,
      },
    });
  }, [activePageId, activePage?.metadata, updatePage]);

  // ── Load persisted column widths ──
  useEffect(() => {
    if (activePage?.metadata?.columnWidths) {
      setColumnWidths(activePage.metadata.columnWidths);
    }
  }, [activePage?.metadata?.columnWidths]);

  // ── Persist column widths when they change (debounced) ──
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (Object.keys(columnWidths).length === 0) return;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    persistTimerRef.current = setTimeout(() => saveColumnWidths(columnWidths), 500);
    return () => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    };
  }, [columnWidths, saveColumnWidths]);

  // ── Reset undo stack when page changes ──
  const prevPageIdRef = useRef(activePageId);
  useEffect(() => {
    if (activePageId !== prevPageIdRef.current) {
      undoStackRef.current = [];
      prevPageIdRef.current = activePageId;
    }
  }, [activePageId]);

  // Refs for click-outside
  const sortByRef = useRef<HTMLDivElement>(null);
  const addColRef = useRef<HTMLDivElement>(null);
  const manageRef = useRef<HTMLDivElement>(null);
  const visRef = useRef<HTMLDivElement>(null);

  useClickOutside(sortByRef, useCallback(() => setShowSortBy(false), []));
  useClickOutside(addColRef, useCallback(() => {
    setShowAddColumn(false);
    setAddColPos(null);
  }, []));
  useClickOutside(manageRef, useCallback(() => {
    setShowManageCols(false);
    setManageColId(null);
    setManageOptValue('');
  }, []));
  useClickOutside(visRef, useCallback(() => setShowVisibility(false), []));

  /* ── sync from store ── */
  useEffect(() => {
    if (!activePage) return;
    let cols = activePage.metadata?.columns as TableColumn[] | undefined;
    if (!cols || cols.length === 0) {
      cols = [{ id: `col_${Date.now()}`, name: 'Name', type: 'text', icon: getDefaultIconForType('text') }];
      if (activePageId) {
        updatePage(activePageId, { metadata: { ...activePage.metadata, columns: cols } });
      }
    }
    // Ensure existing columns have an icon (backfill missing)
    const colsWithIcons = cols.map(c => ({
      ...c,
      icon: c.icon || getDefaultIconForType(c.type),
    }));
    setColumns(colsWithIcons);
    // Persist backfill once per page session only (avoid extra re-render loop)
    if (!iconBackfillDoneRef.current && activePageId && colsWithIcons.some((c, i) => c.icon !== cols[i].icon)) {
      iconBackfillDoneRef.current = true;
      updatePage(activePageId, { metadata: { ...activePage.metadata, columns: colsWithIcons } });
    }
    setGraphVisibleColumns(activePage.metadata?.graphVisibleColumns || []);
    setStickyFirstColumn(activePage.metadata?.stickyFirstColumn === true);
    // Migrate old single-column sort-by (sortByColId) to new array format (sortByColIds)
    if (!activePage.metadata?.sortByColIds && activePage.metadata?.sortByColId) {
      setSortByColIds([activePage.metadata.sortByColId]);
    } else {
      setSortByColIds(activePage.metadata?.sortByColIds || []);
    }
    const rawData = activePage.content;
    const parsed = Array.isArray(rawData) ? rawData : [];
    // Only update data if the store content differs from the current local data reference.
    // This prevents the effect from overwriting user-interaction reorders (like drag-and-drop)
    // where updatePageContent saved the exact same array reference to the store.
    if (parsed !== dataRef.current) {
      setData(parsed);
    }
  }, [activePageId, activePage?.metadata, activePage?.content]);

  /* ── persistence helpers ── */
  const saveMetadataRef = useRef<(cols: TableColumn[], vis?: string[]) => void>((_cols: TableColumn[], _vis?: string[]) => {});

  const saveMetadata = (newCols: TableColumn[], newVisible?: string[]) => {
    if (!activePageId) return;
    const newMetadata: any = {
      ...activePage?.metadata,
      columns: newCols,
    };
    // Only save graphVisibleColumns when explicitly toggled, not on add/rename
    if (newVisible !== undefined) {
      newMetadata.graphVisibleColumns = newVisible;
    }
    updatePage(activePageId, { metadata: newMetadata });
  };
  saveMetadataRef.current = saveMetadata;

  const handleCellChange = (rowIndex: number, colId: string, value: string) => {
    const newData = [...data];
    newData[rowIndex] = { ...newData[rowIndex], [colId]: value };
    setData(newData);
    if (activePageId) updatePageContent(activePageId, newData);
  };

  const deleteRow = (rowIndex: number) => {
    pushUndo();
    const newData = data.filter((_, i) => i !== rowIndex);
    setData(newData);
    // Clean up & shift row heights so indices stay aligned
    setRowHeights(prev => {
      const shifted: Record<number, number> = {};
      for (const [key, val] of Object.entries(prev)) {
        const idx = parseInt(key);
        if (idx === rowIndex) continue;
        shifted[idx > rowIndex ? idx - 1 : idx] = val;
      }
      return shifted;
    });
    if (activePageId) updatePageContent(activePageId, newData);
  };

  const deleteColumn = (colId: string) => {
    pushUndo();
    const newCols = columns.filter(c => c.id !== colId);
    setColumns(newCols);
    // Remove the deleted column's width entry
    setColumnWidths(prev => {
      const { [colId]: _, ...rest } = prev;
      return rest;
    });
    const newData = data.map(row => {
      const { [colId]: _, ...rest } = row;
      return rest;
    });
    setData(newData);

    // If the deleted column was in sort-by, remove it
    if (sortByColIds.includes(colId)) {
      const newSortBy = sortByColIds.filter(id => id !== colId);
      setSortByColIds(newSortBy);
      if (activePageId && activePage) {
        updatePage(activePageId, {
          metadata: { ...activePage.metadata, sortByColIds: newSortBy },
        });
      }
    }

    saveMetadata(newCols);
    if (activePageId) updatePageContent(activePageId, newData);
  };

  const addRow = () => {
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.id]: '' }), {});
    const newData = [...data, newRow];
    setData(newData);
    if (activePageId) updatePageContent(activePageId, newData);
  };

  /* ── column management ── */
  const addColumn = () => {
    const colName = newColName.trim() || 'New Column';
    if (newColType === 'predefined' && newColOptions.length === 0) {
      useToastStore.getState().toast('Please add at least one predefined option.', 'warning');
      return;
    }
    const newCol: TableColumn = {
      id: `col_${Date.now()}`,
      name: colName,
      type: newColType,
      icon: getDefaultIconForType(newColType),
      options: newColType === 'predefined' ? newColOptions : undefined,
    };
    const newCols = [...columns, newCol];
    setColumns(newCols);
    saveMetadata(newCols);
    setNewColName('');
    setNewColType('text');
    setNewColOptions([]);
    setShowAddColumn(false);
  };

  const renameColumn = (colId: string, newName: string, newIcon?: string) => {
    if (newName !== undefined && !newName.trim()) return;
    const newCols = columns.map(c => {
      if (c.id !== colId) return c;
      const updated: TableColumn = { ...c };
      if (newName !== undefined) updated.name = newName;
      if (newIcon !== undefined) updated.icon = newIcon;
      return updated;
    });
    setColumns(newCols);
    saveMetadata(newCols);
  };

  const addOptionToNewCol = () => {
    if (optValue.trim()) {
      setNewColOptions([...newColOptions, { id: `opt_${Date.now()}`, value: optValue, color: optColor }]);
      setOptValue('');
    }
  };

  /* ── manage predefined options ── */
  const addPredefinedOption = (colId: string) => {
    const name = manageOptValue.trim();
    if (!name) return;
    const newOpt: PredefinedOption = { id: `opt_${Date.now()}`, value: name, color: manageOptColor };
    const newCols = columns.map(c =>
      c.id === colId ? { ...c, options: [...(c.options || []), newOpt] } : c
    );
    setColumns(newCols);
    saveMetadata(newCols);
    setManageOptValue('');
  };

  const removePredefinedOption = (colId: string, optId: string) => {
    const newCols = columns.map(c =>
      c.id === colId ? { ...c, options: (c.options || []).filter(o => o.id !== optId) } : c
    );
    setColumns(newCols);
    saveMetadata(newCols);
  };

  const toggleGraphVisibility = (colId: string) => {
    const newVis = graphVisibleColumns.includes(colId)
      ? graphVisibleColumns.filter(id => id !== colId)
      : [...graphVisibleColumns, colId];
    setGraphVisibleColumns(newVis);
    saveMetadata(columns, newVis);
  };

  const moveRow = useCallback((fromIndex: number, toIndex: number) => {
    pushUndo();
    const newData = [...data];
    const [moved] = newData.splice(fromIndex, 1);
    newData.splice(toIndex, 0, moved);
    setData(newData);
    if (activePageId) updatePageContent(activePageId, newData);
  }, [data, activePageId, updatePageContent, pushUndo]);
  moveRowRef.current = moveRow;

  const moveColumn = useCallback((fromIndex: number, toIndex: number) => {
    pushUndo();
    const newCols = [...columns];
    const [moved] = newCols.splice(fromIndex, 1);
    newCols.splice(toIndex, 0, moved);
    setColumns(newCols);
    saveMetadata(newCols);
    // Column widths are keyed by column id (not position), so no reordering needed
  }, [columns, pushUndo, saveMetadata]);
  moveColRef.current = moveColumn;

  // ── Bulk row move (multi-select) ──
  const moveRowsBulk = useCallback((dragIndex: number, dropIndex: number, dropPosition: 'above' | 'below') => {
    pushUndo();
    const selected = new Set(selectedRowIndicesRef.current);
    selected.add(dragIndex);
    const sorted = Array.from(selected).sort((a, b) => a - b);

    const newData = [...dataRef.current];
    const rows: Record<string, any>[] = [];
    for (let i = sorted.length - 1; i >= 0; i--) {
      rows.unshift(newData.splice(sorted[i], 1)[0]);
    }

    // Calculate insert position in the new array
    const removedBefore = sorted.filter(idx => idx < dropIndex).length;
    const shiftedDrop = dropIndex - removedBefore;
    const insertPos = dropPosition === 'above' ? shiftedDrop : shiftedDrop + 1;
    const clamped = Math.max(0, Math.min(insertPos, newData.length));

    rows.forEach((row, i) => {
      newData.splice(clamped + i, 0, row);
    });

    setData(newData);
    if (activePageId) updatePageContent(activePageId, newData);
  }, [activePageId, updatePageContent, pushUndo]);

  // ── Bulk column move (multi-select) ──
  const moveColsBulk = useCallback((dragIndex: number, dropIndex: number, dropPosition: 'left' | 'right') => {
    pushUndo();
    const selected = new Set(selectedColIdsRef.current);
    const dragColId = columns[dragIndex]?.id;
    if (dragColId) selected.add(dragColId);

    // Convert col IDs to indices
    let selectedIndices: number[] = [];
    columns.forEach((col, i) => {
      if (selected.has(col.id)) selectedIndices.push(i);
    });
    selectedIndices = [...new Set(selectedIndices)].sort((a, b) => a - b);

    const newCols = [...columns];
    const removed: TableColumn[] = [];
    for (let i = selectedIndices.length - 1; i >= 0; i--) {
      removed.unshift(newCols.splice(selectedIndices[i], 1)[0]);
    }

    const removedBefore = selectedIndices.filter(idx => idx < dropIndex).length;
    const shiftedDrop = dropIndex - removedBefore;
    const insertPos = dropPosition === 'left' ? shiftedDrop : shiftedDrop + 1;
    const clamped = Math.max(0, Math.min(insertPos, newCols.length));

    removed.forEach((col, i) => {
      newCols.splice(clamped + i, 0, col);
    });

    setColumns(newCols);
    saveMetadata(newCols);
  }, [columns, pushUndo, saveMetadata]);

  // ── Multi-select state for rows ──
  const [selectedRowIndices, setSelectedRowIndices] = useState<Set<number>>(new Set());
  const selectedRowIndicesRef = useRef(selectedRowIndices);
  selectedRowIndicesRef.current = selectedRowIndices;

  const toggleRowSelection = useCallback((index: number, clearOthers = false) => {
    setSelectedRowIndices(prev => {
      if (clearOthers) return new Set([index]);
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const clearRowSelection = useCallback(() => setSelectedRowIndices(new Set()), []);

  // ── Multi-select state for columns ──
  const [selectedColIds, setSelectedColIds] = useState<Set<string>>(new Set());
  const selectedColIdsRef = useRef(selectedColIds);
  selectedColIdsRef.current = selectedColIds;

  const toggleColSelection = useCallback((colId: string, clearOthers = false) => {
    setSelectedColIds(prev => {
      if (clearOthers) return new Set([colId]);
      const next = new Set(prev);
      if (next.has(colId)) next.delete(colId);
      else next.add(colId);
      return next;
    });
  }, []);

  const clearColSelection = useCallback(() => setSelectedColIds(new Set()), []);

  // ── Bulk delete rows ──
  const deleteSelectedRows = useCallback(() => {
    const indices = Array.from(selectedRowIndices).sort((a, b) => b - a); // descending
    if (indices.length === 0) return;
    pushUndo();
    let newData = [...data];
    for (const idx of indices) {
      newData.splice(idx, 1);
    }
    setData(newData);
    // Shift row heights
    setRowHeights(prev => {
      const shifted: Record<number, number> = {};
      const sortedAsc = [...indices].sort((a, b) => a - b);
      for (const [key, val] of Object.entries(prev)) {
        const idx = parseInt(key);
        const removedBeforeCount = sortedAsc.filter(i => i < idx).length;
        const newIdx = idx - removedBeforeCount;
        shifted[newIdx] = val;
      }
      return shifted;
    });
    if (activePageId) updatePageContent(activePageId, newData);
    clearRowSelection();
  }, [data, activePageId, updatePageContent, pushUndo, selectedRowIndices, clearRowSelection]);

  // ── Bulk delete columns ──
  const deleteSelectedCols = useCallback(() => {
    const colIds = Array.from(selectedColIds);
    if (colIds.length === 0) return;
    pushUndo();
    const newCols = columns.filter(c => !colIds.includes(c.id));
    const newData = data.map(row => {
      const newRow = { ...row };
      for (const id of colIds) delete newRow[id];
      return newRow;
    });

    setColumns(newCols);
    setColumnWidths(prev => {
      const next = { ...prev };
      for (const id of colIds) delete next[id];
      return next;
    });
    setData(newData);

    // Remove from sort-by if needed
    const newSortBy = sortByColIds.filter(id => !colIds.includes(id));
    if (newSortBy.length !== sortByColIds.length) {
      setSortByColIds(newSortBy);
      if (activePageId && activePage) {
        updatePage(activePageId, {
          metadata: { ...activePage.metadata, sortByColIds: newSortBy },
        });
      }
    }

    saveMetadata(newCols);
    if (activePageId) updatePageContent(activePageId, newData);
    clearColSelection();
  }, [columns, data, activePageId, activePage, updatePageContent, updatePage, pushUndo, sortByColIds, selectedColIds, clearColSelection, saveMetadata]);

  // ── Ctrl+Z (undo) keydown listener ──
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        performUndo();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [performUndo]);

  /* ═══════ RENDER ═══════ */
  return (
    <div className="flex flex-col h-full">
      {/* ── Top Bar ── */}
      <div className="flex items-center gap-2 mb-4">
        {/* Manage Predefined */}
        <div className="relative" ref={manageRef}>
          <button
            onClick={() => setShowManageCols(!showManageCols)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-outline/10 hover:bg-surface-variant transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">label</span>
            Manage Predefined
          </button>
          {showManageCols && (
            <div className="absolute top-full left-0 mt-1 w-72 bg-surface border border-outline/20 rounded-lg shadow-xl z-50 p-2 max-h-80 overflow-y-auto">
              <div className="text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">Predefined Columns</div>
              {columns.filter(c => c.type === 'predefined').map(col => (
                <div key={col.id} className="mb-3 p-2 bg-background/30 rounded border border-outline/5">
                  <div className="text-sm font-medium mb-1.5 flex items-center justify-between">
                    <span>{col.name}</span>
                    {manageColId === col.id ? (
                      <button
                        onClick={() => { setManageColId(null); setManageOptValue(''); }}
                        className="text-[11px] text-primary hover:text-primary/80 transition-colors"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        onClick={() => setManageColId(col.id)}
                        className="text-[11px] text-on-surface-variant hover:text-on-surface transition-colors"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {col.options?.map(opt => (
                      <span
                        key={opt.id}
                        style={{ backgroundColor: opt.color }}
                        className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded text-black font-semibold group/tag"
                      >
                        {opt.value}
                        {manageColId === col.id && (
                          <button
                            onClick={() => removePredefinedOption(col.id, opt.id)}
                            className="opacity-0 group-hover/tag:opacity-100 hover:bg-black/20 rounded-full w-3 h-3 flex items-center justify-center transition-all"
                          >
                            <span className="material-symbols-outlined text-[8px]">close</span>
                          </button>
                        )}
                      </span>
                    ))}
                    {(!col.options || col.options.length === 0) && (
                      <span className="text-[10px] text-on-surface-variant italic">No options yet</span>
                    )}
                  </div>
                  {manageColId === col.id && (
                    <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-outline/10">
                      <ColorSwatchButton value={manageOptColor} onChange={setManageOptColor} size="sm" />
                      <input
                        type="text"
                        value={manageOptValue}
                        onChange={e => setManageOptValue(e.target.value)}
                        placeholder="Option name"
                        className="flex-1 min-w-0 bg-background border border-outline/20 rounded px-2 py-1 text-xs focus:outline-none focus:border-primary/50"
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addPredefinedOption(col.id);
                          }
                        }}
                      />
                      <Tooltip label="Add option">
                      <button
                        onClick={() => addPredefinedOption(col.id)}
                        className="w-6 h-6 flex items-center justify-center bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors shrink-0"
                      >
                        <span className="material-symbols-outlined text-[12px]">add</span>
                      </button>
              </Tooltip>
            </div>
          )}
        </div>
              ))}
              {columns.filter(c => c.type === 'predefined').length === 0 && (
                <div className="text-sm text-on-surface-variant py-2 text-center">No predefined columns.</div>
              )}
            </div>
          )}
        </div>

        {/* Sort By */}
        <div className="relative" ref={sortByRef}>
          <button
            onClick={() => setShowSortBy(!showSortBy)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-sm font-medium ${
              sortByColIds.length > 0
                ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/20'
                : 'bg-surface border-outline/10 hover:bg-surface-variant text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">sort</span>
            Sort By
            {sortByColIds.length > 0 && (
              <span className="text-[10px] ml-1 px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                {sortByColIds.length} col{sortByColIds.length > 1 ? 's' : ''}
              </span>
            )}
          </button>
          {showSortBy && (
            <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-outline/20 rounded-lg shadow-xl z-50 p-1.5">
              <div className="text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider px-2 pt-1">Sort graph by predefined</div>
              <div className="text-[10px] text-on-surface-variant/60 px-2 pb-1 italic">First selected = top-level grouping</div>

              {/* None option */}
              <div
                onClick={() => {
                  setSortByColIds([]);
                  if (activePageId) {
                    updatePage(activePageId, {
                      metadata: { ...activePage?.metadata, sortByColIds: [] },
                    });
                  }
                  setShowSortBy(false);
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                  sortByColIds.length === 0
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-on-surface-variant hover:bg-on-surface/5'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">
                  {sortByColIds.length === 0 ? 'check_circle' : 'radio_button_unchecked'}
                </span>
                None (default)
              </div>
              <div className="border-t border-outline/10 my-1" />
              {columns.filter(c => c.type === 'predefined').map(col => {
                const isSelected = sortByColIds.includes(col.id);
                const order = isSelected ? sortByColIds.indexOf(col.id) + 1 : null;
                return (
                  <div
                    key={col.id}
                    onClick={() => {
                      let newSortBy: string[];
                      if (isSelected) {
                        newSortBy = sortByColIds.filter(id => id !== col.id);
                      } else {
                        newSortBy = [...sortByColIds, col.id];
                      }
                      setSortByColIds(newSortBy);
                      if (activePageId) {
                        updatePage(activePageId, {
                          metadata: { ...activePage?.metadata, sortByColIds: newSortBy },
                        });
                      }
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm ${
                      isSelected
                        ? 'bg-primary/10 text-primary font-medium'
                        : 'text-on-surface hover:bg-on-surface/5'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {isSelected ? 'check_circle' : 'radio_button_unchecked'}
                    </span>
                    <span className="flex-1">{col.name}</span>
                    {order && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/20 text-primary font-semibold">
                        Level {order}
                      </span>
                    )}
                    {!order && col.options && (
                      <span className="text-[10px] text-on-surface-variant">
                        {col.options.length} values
                      </span>
                    )}
                    {/* Reorder arrows */}
                    {isSelected && order !== null && (
                      <div className="flex items-center gap-0.5 ml-1">
                        {order > 1 && (
                          <span
                            className="material-symbols-outlined text-[14px] hover:bg-primary/20 rounded p-0.5 transition-colors"
                            onClick={e => {
                              e.stopPropagation();
                              const newSortBy = [...sortByColIds];
                              const i = newSortBy.indexOf(col.id);
                              [newSortBy[i - 1], newSortBy[i]] = [newSortBy[i], newSortBy[i - 1]];
                              setSortByColIds(newSortBy);
                              if (activePageId) {
                                updatePage(activePageId, {
                                  metadata: { ...activePage?.metadata, sortByColIds: newSortBy },
                                });
                              }
                            }}
                          >
                            expand_less
                          </span>
                        )}
                        {order < sortByColIds.length && (
                          <span
                            className="material-symbols-outlined text-[14px] hover:bg-primary/20 rounded p-0.5 transition-colors"
                            onClick={e => {
                              e.stopPropagation();
                              const newSortBy = [...sortByColIds];
                              const i = newSortBy.indexOf(col.id);
                              [newSortBy[i + 1], newSortBy[i]] = [newSortBy[i], newSortBy[i + 1]];
                              setSortByColIds(newSortBy);
                              if (activePageId) {
                                updatePage(activePageId, {
                                  metadata: { ...activePage?.metadata, sortByColIds: newSortBy },
                                });
                              }
                            }}
                          >
                            expand_more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {columns.filter(c => c.type === 'predefined').length === 0 && (
                <div className="px-3 py-3 text-sm text-on-surface-variant italic text-center">
                  No predefined columns yet.
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky First Column Toggle */}
        <button
          onClick={() => {
            const newVal = !stickyFirstColumn;
            setStickyFirstColumn(newVal);
            if (activePageId) {
              updatePage(activePageId, {
                metadata: { ...activePage?.metadata, stickyFirstColumn: newVal },
              });
            }
          }}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-md border transition-colors text-sm font-medium ${
            stickyFirstColumn
              ? 'bg-primary/15 border-primary/30 text-primary hover:bg-primary/20'
              : 'bg-surface border-outline/10 hover:bg-surface-variant text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">push_pin</span>
          Sticky First Col
        </button>

        {/* Graph Visibility */}
        <div className="relative" ref={visRef}>
          <button
            onClick={() => setShowVisibility(!showVisibility)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-outline/10 hover:bg-surface-variant transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">visibility</span>
            Graph Visibility
          </button>
          {showVisibility && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-surface border border-outline/20 rounded-lg shadow-xl z-50 p-2">
              <div className="text-xs font-semibold text-on-surface-variant mb-2 uppercase tracking-wider">Show in Graph</div>
              {columns.slice(1).map(col => (
                <label
                  key={col.id}
                  onClick={() => toggleGraphVisibility(col.id)}
                  className="flex items-center gap-3 p-2 hover:bg-on-surface/5 rounded-lg cursor-pointer group transition-colors"
                >
                  <span
                    className={`material-symbols-outlined text-lg transition-all duration-200 ${
                      graphVisibleColumns.includes(col.id)
                        ? 'text-primary opacity-100 scale-100'
                        : 'text-on-surface-variant/40 opacity-60 scale-90 group-hover:opacity-80 group-hover:scale-100'
                    }`}
                    style={{ fontVariationSettings: `'FILL' ${graphVisibleColumns.includes(col.id) ? '1' : '0'}, 'wght' 400, 'GRAD' 0, 'opsz' 24` }}
                  >
                    {graphVisibleColumns.includes(col.id) ? 'check_circle' : 'radio_button_unchecked'}
                  </span>
                  <span className={`text-sm transition-colors duration-200 ${
                    graphVisibleColumns.includes(col.id) ? 'text-on-surface font-medium' : 'text-on-surface-variant/60'
                  }`}>{col.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Selection Action Bar ── */}
      {(selectedRowIndices.size > 0 || selectedColIds.size > 0) && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
          <span className="material-symbols-outlined text-[18px] text-primary">checklist</span>
          <span className="text-sm font-medium text-on-surface">
            {selectedRowIndices.size > 0 && selectedColIds.size > 0 && (
              <>{selectedRowIndices.size} row{selectedRowIndices.size > 1 ? 's' : ''} · {selectedColIds.size} col{selectedColIds.size > 1 ? 's' : ''} selected</>
            )}
            {selectedRowIndices.size > 0 && selectedColIds.size === 0 && (
              <>{selectedRowIndices.size} row{selectedRowIndices.size > 1 ? 's' : ''} selected</>
            )}
            {selectedColIds.size > 0 && selectedRowIndices.size === 0 && (
              <>{selectedColIds.size} col{selectedColIds.size > 1 ? 's' : ''} selected</>
            )}
          </span>
          <div className="flex-1" />
          {selectedRowIndices.size > 0 && (
            <Tooltip label={`Delete ${selectedRowIndices.size} row${selectedRowIndices.size > 1 ? 's' : ''}`}>
            <button
              onClick={deleteSelectedRows}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              Delete Rows
            </button>
            </Tooltip>
          )}
          {selectedColIds.size > 0 && (
            <Tooltip label={`Delete ${selectedColIds.size} column${selectedColIds.size > 1 ? 's' : ''}`}>
            <button
              onClick={deleteSelectedCols}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors text-sm font-medium"
            >
              <span className="material-symbols-outlined text-[15px]">delete</span>
              Delete Columns
            </button>
            </Tooltip>
          )}
          <button
            onClick={() => { clearRowSelection(); clearColSelection(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md hover:bg-on-surface/10 transition-colors text-sm text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[15px]">close</span>
            Clear
          </button>
        </div>
      )}

      {/* ── Table Grid ── */}
      {columns.length === 0 ? (
        <div className="overflow-auto border border-outline/10 rounded-lg bg-surface/10 flex-1 relative">
          <div className="flex items-center justify-center h-32 text-on-surface-variant text-sm">
            <span className="material-symbols-outlined text-[16px] mr-1.5">table</span>
            Add a column to get started
          </div>
        </div>
      ) : (
      <div className="overflow-auto flex-1 relative max-h-[calc(100vh-250px)] pb-48">
        <table ref={tableRef} className="min-w-full border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
          <colgroup>{columns.map(col => <col key={col.id} style={{ width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : '140px' }} />)}<col style={{ width: '120px' }} /></colgroup>
          <thead ref={theadRef} className="bg-surface/30 sticky top-0 z-20"><tr>{columns.map((col, colIndex) => <th key={col.id} data-col-drag-index={colIndex} onClick={e => {
              if (e.ctrlKey || e.metaKey || e.shiftKey) {
                toggleColSelection(col.id);
              } else {
                setSelectedColIds(new Set([col.id]));
              }
            }} style={{ width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : '140px' }} className={"p-0 text-left text-on-surface-variant font-medium text-sm whitespace-nowrap border border-outline/10 bg-surface/80 backdrop-blur-sm group/th cursor-pointer select-none" + (stickyFirstColumn && colIndex === 0 ? ' sticky left-0 z-30' : '') + (selectedColIds.has(col.id) ? ' ring-2 ring-primary/40 bg-primary/[0.04]' : '')}>          <div className="relative w-full h-full flex items-center">
            <Tooltip label="Drag to reorder column">
              <button
                data-col-drag-handle
                className="flex items-center justify-center w-5 h-6 rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0"
              >
                <span className="material-symbols-outlined text-[14px] pointer-events-none">drag_indicator</span>
              </button>
            </Tooltip>
            <HeaderEditor name={col.name} icon={col.icon} onChange={newName => renameColumn(col.id, newName)} onIconChange={newIcon => renameColumn(col.id, col.name, newIcon)} onDelete={() => deleteColumn(col.id)} />{colIndex < columns.length && <div className="absolute top-0 right-[-7px] bottom-0 w-[14px] cursor-col-resize z-20 before:absolute before:top-2 before:bottom-2 before:left-1/2 before:-translate-x-1/2 before:w-[2px] before:bg-white/20 before:rounded-full hover:before:bg-primary/60 before:transition-all active:before:bg-primary/80 opacity-50 group-hover/th:opacity-100 hover:opacity-100 transition-all" onMouseDown={e => { e.preventDefault(); e.stopPropagation(); const currentW = columnWidths[col.id] || 140; setActiveDrag({ type: 'col', id: col.id, startPos: e.clientX, startSize: currentW }); }} />}</div></th>)}<th style={{ width: '120px' }} className="px-4 py-2 text-left bg-surface/80 backdrop-blur-sm relative min-w-[120px] border border-outline/10"><button ref={addColBtnRef} onClick={() => { if (showAddColumn) { setShowAddColumn(false); setAddColPos(null); } else { const rect = addColBtnRef.current?.getBoundingClientRect(); if (rect) { setAddColPos({ top: rect.bottom + 4, left: rect.left }); } setShowAddColumn(true); } }} className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-on-surface/10 text-on-surface-variant font-medium text-sm transition-colors"><span className="material-symbols-outlined text-[16px]">add</span>Add Column</button></th></tr></thead>
          <tbody ref={tbodyRef} className="bg-surface/5">{
              data.map((row, i) => {
                const isRowSelected = selectedRowIndices.has(i);
                return <tr key={i} data-row-index={i} onClick={e => {
                  if (e.ctrlKey || e.metaKey || e.shiftKey) {
                    toggleRowSelection(i);
                  } else {
                    setSelectedRowIndices(new Set([i]));
                  }
                }} className={`relative hover:bg-on-surface/5 group/row transition-colors cursor-pointer ${isRowSelected ? 'ring-2 ring-primary/40 bg-primary/[0.04]' : ''}`} style={rowHeights[i] ? { height: `${rowHeights[i]}px` } : undefined}>{
               columns.map((col, colIndex) => {
                 return <td key={col.id} style={{ width: columnWidths[col.id] ? `${columnWidths[col.id]}px` : '140px' }} className={"py-0 border border-outline/10 min-h-[40px] relative " + (colIndex === 0 ? 'pl-16' : 'px-0') + (stickyFirstColumn && colIndex === 0 ? ' sticky left-0 z-10 bg-surface/80' : '')}>{colIndex === 0 && <div className="absolute left-1 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover/row:opacity-100 transition-opacity flex items-center gap-0.5"><Tooltip label="Drag to reorder"><button data-row-drag-handle className="flex items-center justify-center w-5 h-6 rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface cursor-grab active:cursor-grabbing transition-colors touch-none" ><span className="material-symbols-outlined text-[14px] pointer-events-none">drag_indicator</span></button></Tooltip><Tooltip label="Delete row"><button onClick={() => deleteRow(i)} className="flex items-center justify-center w-5 h-6 rounded-md hover:bg-red-500/15 text-on-surface-variant hover:text-red-400 transition-colors"><span className="material-symbols-outlined text-[14px]">delete</span></button></Tooltip></div>}<CellEditor col={col} value={row[col.id] || ''} onChange={val => handleCellChange(i, col.id, val)} isPrimary={colIndex === 0} /><div
                      className="absolute bottom-[-7px] left-0 right-0 h-[14px] cursor-row-resize z-20
                        before:absolute before:left-2 before:right-2 before:top-1/2 before:-translate-y-1/2 before:h-[2px]
                        before:bg-white/20 before:rounded-full
                        hover:before:bg-primary/60 before:transition-all
                        active:before:bg-primary/80
                        opacity-50 group-hover/row:opacity-100 hover:opacity-100 transition-all"
                      onMouseDown={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        const currentH = rowHeights[i] || 40;
                        setActiveDrag({ type: 'row', id: i, startPos: e.clientY, startSize: currentH });
                      }}
                    /></td>
              })
            }</tr>
          })}<tr><td colSpan={columns.length + 1} className="p-0 border border-outline/10">
                <button onClick={() => { clearRowSelection(); clearColSelection(); addRow(); }} className="w-full flex items-center gap-2 px-4 py-2 text-sm text-on-surface-variant hover:bg-on-surface/5 transition-colors text-left"><span className="material-symbols-outlined text-[16px]">add</span>New Row</button>
              </td></tr>
          </tbody>
        </table>
        {showAddColumn && addColPos && createPortal(
          <div
            ref={addColRef}
            style={{
              position: 'fixed',
              top: addColPos.top,
              left: Math.min(addColPos.left, window.innerWidth - 320),
              zIndex: 9999,
            }}
            className="w-72 bg-surface border border-outline/20 shadow-2xl rounded-lg p-4 font-normal"
          >
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block uppercase tracking-wider">Heading</label>
              <input
                type="text"
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                className="w-full bg-background border border-outline/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50"
                placeholder="e.g. Status"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block uppercase tracking-wider">Type</label>
              <select
                value={newColType}
                onChange={e => setNewColType(e.target.value as ColumnType)}
                className="w-full bg-background border border-outline/20 rounded px-3 py-2 text-sm focus:outline-none focus:border-primary/50 appearance-none cursor-pointer"
              >
                <option value="text">Text</option>

                <option value="predefined">Predefined (Tags)</option>
                <option value="link">Link</option>
                <option value="page link">Page Link</option>
                <option value="date">Date</option>
                <option value="attachment">Attachment</option>
                <option value="gallery">Gallery Image</option>
              </select>
            </div>

            {newColType === 'predefined' && (
              <div className="mb-4 p-3 bg-background/50 rounded border border-outline/10">
                <label className="text-xs font-semibold text-on-surface-variant mb-1.5 block uppercase tracking-wider">Add Predefined Value</label>
                <div className="flex gap-2 mb-3">
                  <ColorSwatchButton value={optColor} onChange={setOptColor} size="md" />
                  <input
                    type="text"
                    value={optValue}
                    onChange={e => setOptValue(e.target.value)}
                    placeholder="Tag name"
                    className="flex-1 min-w-0 bg-background border border-outline/20 rounded px-2 text-sm focus:outline-none focus:border-primary/50"
                    onKeyDown={e => e.key === 'Enter' && addOptionToNewCol()}
                  />
                  <button onClick={addOptionToNewCol} className="w-8 h-8 flex items-center justify-center shrink-0 bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors">
                    <span className="material-symbols-outlined text-[16px]">add</span>
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {newColOptions.map(opt => (
                    <span key={opt.id} style={{ backgroundColor: opt.color }} className="text-xs px-2 py-0.5 rounded text-black font-semibold">
                      {opt.value}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              onClick={addColumn}
              className="w-full bg-primary text-on-primary rounded py-2 text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Create Column
            </button>
          </div>,
          document.body
        )}
      </div>
    )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   CELL EDITOR — supports multi-select for predefined & page link
   ═══════════════════════════════════════════════ */
function CellEditor({ col, value, onChange, isPrimary }: { col: TableColumn; value: string; onChange: (v: string) => void; isPrimary: boolean }) {
  const [editing, setEditing] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [creatingNewPage, setCreatingNewPage] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState('');
  const createInputRef = useRef<HTMLInputElement>(null);

  const [newPageType, setNewPageType] = useState<string>('text');

  const { pages, setActivePage, createPage, activePageId } = useProjectStore();

  // Determine if this table is in a standalone page (no project) — hide child creation in that case
  const currentTablePage = pages.find(p => p.id === activePageId);
  const isStandalonePage = !currentTablePage?.project_id;

  useClickOutside(
    dropdownRef,
    useCallback(() => {
      setShowDropdown(false);
      setSearchQuery('');
    }, []),
  );

  // Auto-focus the create input when it appears
  useEffect(() => {
    if (creatingNewPage && createInputRef.current) {
      createInputRef.current.focus();
    }
  }, [creatingNewPage]);

  const handleBlur = () => {
    setTimeout(() => {
      setEditing(false);
    }, 150);
  };

  /* ── text / primary ── */
  if (isPrimary || col.type === 'text') {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full h-full px-4 py-2 bg-transparent focus:outline-none focus:bg-on-surface/5 text-on-surface text-sm transition-colors"
        placeholder="Empty"
      />
    );
  }

  /* ── attachment ── */
  if (col.type === 'attachment') {
    const fileName = value ? value.split(/[\\/]/).pop() || value : '';

    /* resolve the stored path — if it's a relative name, prefix with app data dir */
    const resolvePath = async (stored: string): Promise<string> => {
      // If it's an absolute path (legacy or already resolved), use as-is
      if (stored.startsWith('/') || stored.includes(':/') || stored.includes(':\\') || stored.startsWith('\\')) {
        return stored;
      }
      // Otherwise it's just a filename stored in appDataDir/attachments/
      const { appLocalDataDir, join } = await import('@tauri-apps/api/path');
      return join(await appLocalDataDir(), 'attachments', stored);
    };

    const handlePickFile = async () => {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({
          multiple: false,
          title: 'Select a file',
        });
        if (!selected) return;
        const srcPath = selected as string;

        // Copy file into app's stable data directory via Rust command (bypasses fs plugin scope)
        const { invoke } = await import('@tauri-apps/api/core');
        const destName: string = await invoke('attach_file', { sourcePath: srcPath });
        onChange(destName); // Store just the filename — will be resolved on open
        useToastStore.getState().toast('File attached successfully.', 'success');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('attach file error:', msg);
        useToastStore.getState().toast(`Failed to attach file: ${msg}`, 'error');
      }
    };

    const handleOpenFile = async () => {
      if (!value) return;
      try {
        const fullPath = await resolvePath(value);
        const { invoke } = await import('@tauri-apps/api/core');
        const fileExists: boolean = await invoke('file_exists', { path: fullPath });
        if (!fileExists) {
          useToastStore.getState().toast(
            'The attached file could not be found. It may have been moved or deleted.',
            'error',
          );
          return;
        }
        const { openPath } = await import('@tauri-apps/plugin-opener');
        await openPath(fullPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('openPath error:', msg, 'path:', value);
        useToastStore.getState().toast(`Failed to open file: ${msg}`, 'error');
      }
    };

    if (!value) {
      return (
        <div className="w-full h-full px-4 py-2 flex items-center">
          <button
            onClick={handlePickFile}
            className="flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors text-sm font-medium"
          >
            <span className="material-symbols-outlined text-[16px]">attach_file</span>
            Attach File
          </button>
        </div>
      );
    }

    return (
      <div className="w-full h-full px-3 py-2 flex items-center justify-between group/cell">
        <Tooltip label="Open file">
        <button
          onClick={handleOpenFile}
          className="flex items-center gap-1.5 text-sm text-primary hover:underline truncate max-w-[75%]"
        >
          <span className="material-symbols-outlined text-[16px] shrink-0">attach_file</span>
          <span className="truncate">{fileName}</span>
        </button>
        </Tooltip>
        <div className="flex items-center gap-0.5 opacity-0 group-hover/cell:opacity-100 transition-opacity">
          <Tooltip label="Replace file">
          <button
            onClick={handlePickFile}
            className="p-1 rounded hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">refresh</span>
          </button>
          </Tooltip>
          <Tooltip label="Remove attachment">
          <button
            onClick={() => onChange('')}
            className="p-1 rounded hover:bg-red-500/15 text-on-surface-variant hover:text-red-400 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  /* ── date ── */
  if (col.type === 'date') {
    if (!value) {
      return (
        <input
          type="date"
          value=""
          onChange={e => onChange(e.target.value)}
          className="w-full h-full px-4 py-2 bg-transparent focus:outline-none focus:bg-on-surface/5 text-on-surface text-sm transition-colors cursor-pointer [color-scheme:dark]"
        />
      );
    }

    if (editing) {
      return (
        <input
          autoFocus
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={() => setEditing(false)}
          className="w-full h-full px-4 py-2 bg-transparent focus:outline-none focus:bg-on-surface/5 text-on-surface text-sm transition-colors [color-scheme:dark]"
        />
      );
    }

    // Format for display
    let displayDate = value;
    const d = new Date(value + 'T00:00:00');
    if (!isNaN(d.getTime())) {
      displayDate = d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      });
    }

    return (
      <div className="w-full h-full px-4 py-2 flex items-center text-sm text-on-surface hover:bg-on-surface/5 cursor-pointer transition-colors" onClick={() => setEditing(true)}>
        <span className="material-symbols-outlined text-[14px] mr-1.5 text-on-surface-variant">calendar_month</span>
        <span>{displayDate}</span>
      </div>
    );
  }

  /* ── link ── */
  if (col.type === 'link') {
    if (editing || !value) {
      return (
        <input
          autoFocus
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onBlur={handleBlur}
          className="w-full h-full px-4 py-2 bg-transparent focus:outline-none focus:bg-on-surface/5 text-on-surface text-sm transition-colors"
          placeholder="https://..."
        />
      );
    }
    return (
      <div className="w-full h-full px-4 py-2 flex items-center text-sm text-primary hover:underline cursor-pointer" onClick={() => setEditing(true)}>
        <span className="material-symbols-outlined text-[14px] mr-1">link</span>
        <span className="truncate">{value}</span>
      </div>
    );
  }

  /* ── predefined (multi-select) ── */
  if (col.type === 'predefined') {
    const selectedIds = parseMulti(value);
    const selectedOpts = selectedIds.map(id => col.options?.find(o => o.id === id)).filter(Boolean) as PredefinedOption[];

    const toggleOption = (optId: string) => {
      const ids = parseMulti(value);
      if (ids.includes(optId)) {
        onChange(serializeMulti(ids.filter(id => id !== optId)));
      } else {
        onChange(serializeMulti([...ids, optId]));
      }
    };

    const removeOption = (optId: string) => {
      const ids = parseMulti(value);
      onChange(serializeMulti(ids.filter(id => id !== optId)));
    };

    return (
      <div ref={dropdownRef} className="relative w-full min-h-[40px] flex items-center px-2 py-1 cursor-pointer hover:bg-on-surface/5" onClick={() => setShowDropdown(true)}>
        <div className="flex flex-wrap gap-1 flex-1">
          {selectedOpts.length > 0 ? (
            selectedOpts.map(opt => (
              <span
                key={opt.id}
                style={{ backgroundColor: opt.color }}
                className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded text-black font-semibold group/tag"
              >
                {opt.value}
                <button
                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity ml-0.5 hover:bg-black/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                  onClick={e => { e.stopPropagation(); removeOption(opt.id); }}
                >
                  <span className="material-symbols-outlined text-[10px]">close</span>
                </button>
              </span>
            ))
          ) : (
            <span className="text-on-surface-variant text-sm">Select...</span>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-52 bg-surface border border-outline/20 shadow-xl rounded-lg z-50" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full p-2 bg-transparent border-b border-outline/10 text-sm focus:outline-none"
            />
            <div className="max-h-40 overflow-auto p-1">
              {col.options
                ?.filter(o => o.value.toLowerCase().includes(searchQuery.toLowerCase()))
                .map(opt => {
                  const isSelected = selectedIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => toggleOption(opt.id)}
                      className={`px-2 py-1.5 hover:bg-on-surface/10 rounded cursor-pointer flex items-center gap-2 ${isSelected ? 'bg-on-surface/5' : ''}`}
                    >
                      <span style={{ backgroundColor: opt.color }} className="text-[10px] px-1.5 py-0.5 rounded text-black font-semibold">
                        {opt.value}
                      </span>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── page link (multi-select) ── */
  if (col.type === 'page link') {
    const selectedIds = parseMulti(value);
    const selectedPages = selectedIds.map(id => pages.find(p => p.id === id)).filter(Boolean);

    const togglePage = (pageId: string) => {
      const ids = parseMulti(value);
      if (ids.includes(pageId)) {
        onChange(serializeMulti(ids.filter(id => id !== pageId)));
      } else {
        onChange(serializeMulti([...ids, pageId]));
      }
    };

    const removePage = (pageId: string) => {
      const ids = parseMulti(value);
      onChange(serializeMulti(ids.filter(id => id !== pageId)));
    };

    const handleCreatePage = async () => {
      const title = newPageTitle.trim() || 'New Page';
      const tablePage = pages.find(p => p.id === activePageId);
      if (!tablePage || !tablePage.project_id) return;

      const newPage = await createPage(
        tablePage.project_id,
        title,
        newPageType,
        { parentId: activePageId, parentedViaLink: true },
      );
      if (newPage) {
        // Add the new page to the cell value
        const ids = parseMulti(value);
        onChange(serializeMulti([...ids, newPage.id]));
      }
      setCreatingNewPage(false);
      setNewPageTitle('');
      setNewPageType('text');
      setSearchQuery('');
    };

    // Map page types to Material Symbols icons
    const pageTypeIcon: Record<string, string> = {
      text: 'description',
      table: 'table',
      board: 'dashboard',
      chart: 'pie_chart',
      checklist: 'checklist',
      gallery: 'photo_library',
    };
    const pageTypeLabel: Record<string, string> = {
      text: 'Text',
      table: 'Table',
      board: 'Board',
      chart: 'Chart',
      checklist: 'Checklist',
      gallery: 'Gallery',
    };
    const pageTypes = ['text', 'table', 'board', 'chart', 'checklist', 'gallery'] as const;

    return (
      <div ref={dropdownRef} className="relative w-full min-h-[40px] flex items-center px-2 py-1 cursor-pointer hover:bg-on-surface/5" onClick={() => setShowDropdown(true)}>
        <div className="flex flex-wrap gap-1 flex-1">              {selectedPages.length > 0 ? (
                selectedPages.map(p => (
                  <span key={p!.id} className="inline-flex items-center gap-0.5 text-[11px] px-1.5 py-0.5 rounded bg-primary/15 text-primary font-medium group/tag">
                    <span className="material-symbols-outlined text-[12px]">{pageTypeIcon[p!.type || 'text'] || 'description'}</span>
                    {p!.title || 'Untitled'}
                <Tooltip label="Remove">
                <button
                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity ml-0.5 hover:bg-primary/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                  onClick={e => { e.stopPropagation(); removePage(p!.id); }}
                >
                  <span className="material-symbols-outlined text-[10px]">close</span>
                </button>
                </Tooltip>
                <Tooltip label="Open page">
                <button
                  className="opacity-0 group-hover/tag:opacity-100 transition-opacity hover:bg-primary/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                  onClick={e => { e.stopPropagation(); setActivePage(p!.id); }}
                >
                  <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                </button>
                </Tooltip>
              </span>
            ))
          ) : (
            <span className="text-on-surface-variant text-sm">Select Page...</span>
          )}
        </div>

        {showDropdown && (
          <div className="absolute top-full left-0 mt-1 w-56 bg-surface border border-outline/20 shadow-xl rounded-lg z-50" onClick={e => e.stopPropagation()}>
            <input
              autoFocus
              type="text"
              placeholder="Search pages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full p-2 bg-transparent border-b border-outline/10 text-sm focus:outline-none"
            />
            <div className="max-h-40 overflow-auto p-1">
              {pages
                .filter(p => (p.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase()))
                .map(p => {
                  const isSelected = selectedIds.includes(p.id);
                  return (
                    <div
                      key={p.id}
                      onClick={() => togglePage(p.id)}
                      className={`px-2 py-1.5 hover:bg-on-surface/10 rounded cursor-pointer text-sm truncate flex items-center gap-2 ${isSelected ? 'bg-on-surface/5' : ''}`}
                    >
                      {p.title || 'Untitled'}
                    </div>
                  );
                })}
            </div>
            {/* Create new page option — hidden on standalone pages (no project) */}
            {!isStandalonePage && (
            <div className="border-t border-outline/10">
              {creatingNewPage ? (
                <div className="p-2 space-y-2">
                  {/* Page type selector */}
                  <div className="flex gap-1 flex-wrap">
                    {pageTypes.map(type => (
                      <button
                        key={type}
                        onClick={() => setNewPageType(type)}
                className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-all ${
                  newPageType === type
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'text-on-surface-variant hover:bg-on-surface/10'
                }`}
                      >
                        <span className="material-symbols-outlined text-[12px]">{pageTypeIcon[type]}</span>
                        {pageTypeLabel[type]}
                      </button>
                    ))}
                  </div>
                  {/* Title input + confirm/cancel */}
                  <div className="flex items-center gap-1">
                    <input
                      ref={createInputRef}
                      type="text"
                      value={newPageTitle}
                      onChange={e => setNewPageTitle(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreatePage();
                        }
                        if (e.key === 'Escape') {
                          setCreatingNewPage(false);
                          setNewPageTitle('');
                          setNewPageType('text');
                        }
                      }}
                      placeholder="Page title..."
                      className="flex-1 bg-background border border-outline/20 rounded px-2 py-1 text-sm focus:outline-none focus:border-primary/50"
                    />
              <Tooltip label="Create" position="top">
              <button
                onClick={handleCreatePage}
                className="w-6 h-6 flex items-center justify-center bg-primary/20 text-primary rounded hover:bg-primary/30 transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">check</span>
              </button>
              </Tooltip>
              <Tooltip label="Cancel" position="top">
              <button
                onClick={() => { setCreatingNewPage(false); setNewPageTitle(''); setNewPageType('text'); }}
                className="w-6 h-6 flex items-center justify-center hover:bg-on-surface/10 rounded transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
              </Tooltip>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setCreatingNewPage(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-primary hover:bg-primary/10 transition-colors rounded"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span>
                  Create new page
                </button>
              )}
            </div>
            )}
          </div>
        )}
      </div>
    );
  }

  /* ── gallery image ── */
  if (col.type === 'gallery') {
    return <GalleryCellEditor value={value} onChange={onChange} />;
  }

  return null;
}

/* ─── gallery image cell editor (multi-select) ─── */
function GalleryCellEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { pages } = useProjectStore();
  const galleryPages = useMemo(() => pages.filter(p => p.type === 'gallery'), [pages]);
  const [showPicker, setShowPicker] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  const galleryItems: GalleryItem[] = useMemo(() => {
    if (!selectedPageId) return [];
    const gp = galleryPages.find(p => p.id === selectedPageId);
    return gp && Array.isArray(gp.content) ? gp.content : [];
  }, [selectedPageId, galleryPages]);

  // Parse stored image IDs — JSON array format
  const selectedIds = useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value.filter(Boolean);
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {}
    return String(value).split(',').filter(Boolean);
  }, [value]);

  // Resolve all selected images with their page info
  const selectedImages = useMemo(() => {
    if (!value) return [];
    const results: (GalleryItem & { pageId: string; pageTitle: string })[] = [];
    for (const id of selectedIds) {
      for (const gp of galleryPages) {
        const items: GalleryItem[] = Array.isArray(gp.content) ? gp.content : [];
        const found = items.find(item => item.id === id);
        if (found) {
          results.push({ ...found, pageId: gp.id, pageTitle: gp.title });
          break;
        }
      }
    }
    return results;
  }, [value, galleryPages, selectedIds]);

  const toggleImage = (itemId: string) => {
    const ids = [...selectedIds];
    if (ids.includes(itemId)) {
      onChange(JSON.stringify(ids.filter(id => id !== itemId)));
    } else {
      onChange(JSON.stringify([...ids, itemId]));
    }
  };

  const removeImage = (itemId: string) => {
    onChange(JSON.stringify(selectedIds.filter(id => id !== itemId)));
  };

  useClickOutside(pickerRef, useCallback(() => { setShowPicker(false); setSelectedPageId(null); }, []));

  return (
    <div className="relative w-full min-h-[40px]" ref={pickerRef}>
      <div
        className="w-full h-full px-2 py-1 flex items-center flex-wrap gap-1 cursor-pointer hover:bg-on-surface/5 min-h-[40px]"
        onClick={() => setShowPicker(!showPicker)}
      >
        {selectedImages.length > 0 ? (
          selectedImages.map(img => (
            <span key={img.id} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-400 font-medium group/tag">
              <img src={img.url} alt={img.title} className="w-4 h-4 rounded object-cover" />
              {img.title || 'Untitled'}
              <span className="opacity-0 group-hover/tag:opacity-100 transition-opacity">
                <Tooltip label="Remove">
                <button
                  className="ml-0.5 hover:bg-cyan-500/20 rounded-full w-3.5 h-3.5 flex items-center justify-center"
                  onClick={e => { e.stopPropagation(); removeImage(img.id); }}
                >
                  <span className="material-symbols-outlined text-[10px]">close</span>
                </button>
                </Tooltip>
              </span>
            </span>
          ))
        ) : (
          <div className="flex items-center gap-1.5 px-1 py-1">
            <span className="material-symbols-outlined text-[16px] text-primary">photo_library</span>
            <span className="text-sm text-on-surface-variant">Pick from Gallery...</span>
          </div>
        )}
      </div>

      {showPicker && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-surface border border-outline/20 shadow-xl rounded-lg z-50 p-2 max-h-80 overflow-y-auto" onClick={e => e.stopPropagation()}>
          {galleryPages.length === 0 ? (
            <div className="text-sm text-on-surface-variant text-center py-4">No gallery pages found.</div>
          ) : !selectedPageId ? (
            <>
              <div className="text-xs font-semibold text-on-surface-variant mb-1 uppercase tracking-wider px-1">Select a gallery page</div>
              {galleryPages.map(gp => (
                <div
                  key={gp.id}
                  onClick={() => setSelectedPageId(gp.id)}
                  className="flex items-center gap-2 px-2 py-1.5 hover:bg-on-surface/10 rounded cursor-pointer text-sm"
                >
                  <span className="material-symbols-outlined text-[16px] text-on-surface-variant">photo_library</span>
                  {gp.title || 'Untitled'}
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="flex items-center gap-1 mb-1">
                <button onClick={() => setSelectedPageId(null)} className="p-0.5 hover:bg-on-surface/10 rounded">
                  <span className="material-symbols-outlined text-[14px]">arrow_back</span>
                </button>
                <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
                  {galleryPages.find(gp => gp.id === selectedPageId)?.title || 'Gallery'}
                </span>
              </div>
              {galleryItems.length === 0 ? (
                <div className="text-sm text-on-surface-variant text-center py-4">No images in this gallery.</div>
              ) : (
                galleryItems.map(item => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleImage(item.id)}
                      className={`flex items-center gap-2 px-2 py-1.5 hover:bg-on-surface/10 rounded cursor-pointer ${isSelected ? 'bg-on-surface/5' : ''}`}
                    >
                      <img src={item.url} alt={item.title} className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{item.title || 'Untitled'}</div>
                        {item.tags && item.tags.length > 0 && (
                          <div className="text-[10px] text-on-surface-variant truncate">{item.tags.join(', ')}</div>
                        )}
                      </div>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-primary shrink-0">check_circle</span>
                      )}
                    </div>
                  );
                })
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── small swatch + ColorPicker for predefined options ─── */
function ColorSwatchButton({ value, onChange, size = 'md' }: { value: string; onChange: (c: string) => void; size?: 'sm' | 'md' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Click-outside handling that also accounts for the portaled panel
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current?.contains(e.target as Node)) return;
      if (panelRef.current?.contains(e.target as Node)) return;
      setOpen(false);
      setPos(null);
    };
    // Use setTimeout to avoid the same mousedown that opened the picker from closing it
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handler);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handler);
    };
  }, [open]);

  /* ── viewport-aware position ── */
  const calculatePosition = useCallback((btnRect: DOMRect) => {
    const panelWidth = 260;  // w-60 (~240px) + padding buffer
    const panelHeight = 390; // approximate max height of the color picker panel (~370px + buffer)
    const margin = 8;

    // Default: centered below the button
    let top = btnRect.bottom + 4;
    let left = btnRect.left + btnRect.width / 2;

    // If not enough room below, try above
    if (top + panelHeight > window.innerHeight - margin) {
      top = btnRect.top - panelHeight - 4;
    }

    // If above also overflows the top, clamp to margin from top
    if (top < margin) {
      top = margin;
    }

    // Keep the panel horizontally within the viewport (centered on button)
    const halfPanel = panelWidth / 2;
    if (left - halfPanel < margin) {
      left = margin + halfPanel;
    } else if (left + halfPanel > window.innerWidth - margin) {
      left = window.innerWidth - margin - halfPanel;
    }

    return { top: Math.round(top), left: Math.round(left) };
  }, []);

  const btnSize = size === 'sm' ? 'w-6 h-6 rounded' : 'w-8 h-8 rounded-lg';
  const hoverScale = size === 'sm' ? 'hover:scale-125' : 'hover:scale-110';

  return (
    <div className="relative shrink-0" ref={ref}>
      <Tooltip label="Pick a colour">
      <button
        onClick={() => {
          if (!open) {
            const rect = ref.current?.getBoundingClientRect();
            if (rect) {
              setPos(calculatePosition(rect));
            }
          } else {
            setPos(null);
          }
          setOpen(!open);
        }}
        className={`${btnSize} border border-outline/20 ${hoverScale} transition-transform shrink-0 cursor-pointer`}
        style={{ backgroundColor: value }}
      />
      </Tooltip>
      {open && pos && createPortal(
        <div ref={panelRef} style={{ position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)', zIndex: 9999 }}>
          <ColorPicker value={value} onChange={onChange} onClose={() => { setOpen(false); setPos(null); }} />
        </div>,
        document.body
      )}
    </div>
  );
}

/* ─── available column icons ─── */
const COLUMN_ICONS = [
  'text_fields', 'notes', 'article', 'description', 'list_alt',
  'image', 'photo', 'photo_library', 'panorama',
  'label', 'sell', 'bookmark', 'flag', 'star',
  'link', 'attach_file', 'open_in_new', 'launch', 'tab',
  'tag', 'category', 'check_circle', 'radio_button_checked', 'toggle_on',
  'calendar_month', 'schedule', 'pin', 'push_pin',
  'database', 'table', 'grid_view', 'reorder',
  'person', 'email', 'phone', 'location_on', 'language',
];

/* ═══════════════════════════════════════════════
   HEADER EDITOR — click to rename, shows icon with dropdown
   ═══════════════════════════════════════════════ */
function HeaderEditor({ name, icon, onChange, onIconChange, onDelete }: { name: string; icon?: string; onChange: (n: string) => void; onIconChange?: (icon: string) => void; onDelete: () => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(name);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const committedRef = useRef(false);

  useClickOutside(pickerRef, useCallback(() => setShowIconPicker(false), []));

  useEffect(() => {
    setVal(name);
  }, [name]);

  // Reset committedRef every time the editor opens (avoids stale flag from previous session)
  useEffect(() => {
    if (editing) committedRef.current = false;
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (val !== name) onChange(val);
  };

  if (editing) {
    return (
      <input
        autoFocus
        type="text"
        value={val}
        onChange={e => setVal(e.target.value)}
        onBlur={() => {
          // If Enter already committed via onKeyDown, skip the blur commit
          if (committedRef.current) {
            committedRef.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault();
            committedRef.current = true;
            commit();
          }
        }}
        className="w-full h-full px-4 py-2 bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 text-sm"
      />
    );
  }

  return (
    <div className="w-full h-full px-2 py-2 flex items-center gap-1 group">
      {/* Icon with picker */}
      <div className="relative" ref={pickerRef}>
        <Tooltip label="Change icon">
        <button
          onClick={e => { e.stopPropagation(); setShowIconPicker(!showIconPicker); }}
          className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[16px]">{icon || 'text_fields'}</span>
        </button>
        </Tooltip>
        {showIconPicker && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-surface border border-outline/20 rounded-lg shadow-xl z-50 p-2 max-h-48 overflow-y-auto grid grid-cols-7 gap-1">
            {COLUMN_ICONS.map(ico => (
              <button
                key={ico}
                onClick={e => {
                  e.stopPropagation();
                  onIconChange?.(ico);
                  setShowIconPicker(false);
                }}
                className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                  icon === ico
                    ? 'bg-primary/20 text-primary ring-1 ring-primary/40'
                    : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">{ico}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Name */}
      <Tooltip label="Click to rename">
      <div
        className="flex-1 cursor-pointer hover:text-on-surface transition-colors truncate text-sm"
        onClick={() => setEditing(true)}
      >
        {name}
      </div>
      </Tooltip>

      {/* Delete */}
      <Tooltip label="Delete column">
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="p-1 rounded-md hover:bg-red-500/15 text-on-surface-variant hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all shrink-0"
      >
        <span className="material-symbols-outlined text-[14px]">delete</span>
      </button>
      </Tooltip>
    </div>
  );
}
