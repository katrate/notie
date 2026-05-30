import { useEffect, useState, useRef, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../stores/authStore'
import { useProjectStore, saveExpandedProjects, fetchExpandedProjects } from '../../stores/projectStore'
import { useTemplateStore, type TemplateNode } from '../../stores/templateStore'
import { useCommandStore } from '../../stores/commandStore'
import { CreatePagePanel } from './CreatePagePanel'
import { SearchModal } from '../search/SearchModal'
import { DeleteConfirmModal } from './DeleteConfirmModal'
import { Tooltip } from '../Tooltip'
import { useShortcutStore } from '../../stores/shortcutStore'
import { SettingsModal } from '../settings/SettingsModal'


function countTemplateNodes(node: TemplateNode): number {
  let count = 1
  for (const child of node.children) {
    count += countTemplateNodes(child)
  }
  return count
}

function FromTemplateButton({ projectId }: { projectId: string }) {
  const { templates, loading, fetchTemplates } = useTemplateStore()
  const { createPage, fetchPages, updatePage } = useProjectStore()
  const [showDropdown, setShowDropdown] = useState(false)
  const [creating, setCreating] = useState<string | null>(null)
  const [createSuccess, setCreateSuccess] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLDivElement>(null)
  const [dropdownPos, setDropdownPos] = useState<{ left: number; top: number; width: number } | null>(null)

  useLayoutEffect(() => {
    if (!showDropdown || !btnRef.current) {
      setDropdownPos(null)
      return
    }
    const rect = btnRef.current.getBoundingClientRect()
    setDropdownPos({ left: rect.left, top: rect.bottom + 4, width: rect.width })
  }, [showDropdown])

  useEffect(() => {
    if (showDropdown) fetchTemplates()
  }, [showDropdown, fetchTemplates])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const applyTagsToPage = async (pageId: string, tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return
    const { getProjectTags, addProjectTag } = useProjectStore.getState()
    const existingTags = getProjectTags(projectId)
    for (const tagName of tags) {
      if (!existingTags.some(t => t.name === tagName)) {
        await addProjectTag(projectId, tagName, '#6b7280')
      }
    }
    const pageData = useProjectStore.getState().pages.find(p => p.id === pageId)
    if (pageData) {
      await updatePage(pageId, {
        metadata: { ...(pageData.metadata || {}), tags }
      })
    }
  }

  const createFromTemplate = async (template: typeof templates[0]) => {
    setCreating(template.id)
    setShowDropdown(false)

    const createChildren = async (nodes: TemplateNode[], parentId: string) => {
      for (const node of nodes) {
        const child = await createPage(projectId, node.title, node.type, { parentId }, node.icon)
        if (child) {
          await applyTagsToPage(child.id, node.tags)
          if (node.children.length > 0) {
            await createChildren(node.children, child.id)
          }
        }
      }
    }

    const root = await createPage(
      projectId,
      template.structure.title,
      template.structure.type,
      {},
      template.structure.icon
    )

    if (root) {
      await applyTagsToPage(root.id, template.structure.tags)
      if (template.structure.children.length > 0) {
        await createChildren(template.structure.children, root.id)
      }
    }

    await fetchPages(projectId)
    setCreating(null)
    setCreateSuccess(true)
    setTimeout(() => setCreateSuccess(false), 2000)
  }

  return (
    <div ref={btnRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={creating !== null}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg border border-outline/10 transition-all text-xs font-medium ${
          creating
            ? 'text-on-surface-variant/50 bg-on-surface/5'
            : 'text-on-surface-variant hover:text-primary hover:border-primary/30 hover:bg-primary/5'
        }`}
      >
        {creating ? (
          <>
            <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Creating...
          </>
        ) : createSuccess ? (
          <>
            <span className="material-symbols-outlined text-[14px] text-emerald-400">check</span>
            Created!
          </>
        ) : (
          <>
            <span className="material-symbols-outlined text-[14px]">bookmark</span>
            From Template
          </>
        )}
      </button>

      {showDropdown && createPortal(
        <div
          ref={dropdownRef}
          className="fixed bg-surface border border-outline/20 rounded-xl shadow-2xl p-2 z-[9999] backdrop-blur-xl max-h-48 overflow-y-auto"
          style={dropdownPos ? { left: dropdownPos.left + 'px', top: dropdownPos.top + 'px', width: dropdownPos.width + 'px' } : undefined}
        >
          {loading && templates.length === 0 ? (
            <div className="flex items-center justify-center py-4">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : templates.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-3">
              No templates yet.
            </p>
          ) : (
            templates.map(t => (
              <button
                key={t.id}
                onClick={() => createFromTemplate(t)}
                disabled={creating !== null}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-on-surface/10 transition-colors text-left disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px] text-primary flex-shrink-0">
                  {t.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-on-surface truncate">{t.name}</p>
                  <p className="text-[10px] text-on-surface-variant/60">
                    {countTemplateNodes(t.structure)} page{countTemplateNodes(t.structure) !== 1 ? 's' : ''}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

const getDisplayIcon = (icon: string | undefined): string => {
  if (!icon) return 'description';
  if (icon === '📁') return 'folder';
  if (icon === '📄') return 'description';
  return icon;
};

const getTagColor = (projectTags: { name: string; color: string }[], tagName: string): string => {
  const tag = projectTags.find(t => t.name === tagName);
  return tag ? tag.color : '#6b7280';
};

const PageTreeItem = ({ page, allPages, activePageId, navigateToPage, confirmDelete, deletePage, setDeleteModal, level = 0, projectId, projectTags, selectedPageIds, onToggleSelect }: any) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const itemRef = useRef<HTMLDivElement>(null);
  const childPages = allPages.filter((p: any) => p.metadata?.parentId === page.id).sort((a: any, b: any) => (a.position || 0) - (b.position || 0));
  const hasChildren = childPages.length > 0;

  return (
    <div className="w-full flex flex-col page-tree-item">
      <div
        ref={itemRef}
        data-page-id={page.id}
        className={`flex items-center w-full group/item ${level > 0 ? 'mt-0.5' : ''} ${selectedPageIds?.has(page.id) ? 'bg-primary/5' : ''}`}
        style={{ touchAction: 'none' }}
      >
        <div style={{ width: level * 8 }} className="flex-shrink-0" />
        <div className="w-5 flex-shrink-0 flex items-center justify-center text-on-surface-variant/20 cursor-grab active:cursor-grabbing">
          <span className="material-symbols-outlined text-[12px] pointer-events-none">drag_indicator</span>
        </div>
        <div className="w-[22px] flex-shrink-0 flex items-center justify-center">
          {hasChildren && (
            <button
              onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded); }}
              className="w-full h-full rounded text-on-surface-variant hover:text-on-surface flex items-center justify-center opacity-50 hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-[14px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>expand_more</span>
            </button>
          )}
        </div>
        <button
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey || e.shiftKey) {
              e.stopPropagation();
              onToggleSelect?.(page.id);
              return;
            }
            navigateToPage(page.project_id || projectId, page.id);
          }}
          className={`flex-1 flex items-center gap-1.5 px-1 py-1 rounded-md transition-colors text-left overflow-hidden ${
            activePageId === page.id ? 'bg-on-surface/10 text-primary' : 'hover:bg-on-surface/5 text-on-surface-variant'
          } ${selectedPageIds?.has(page.id) ? 'ring-2 ring-primary/50' : ''}`}
          style={(() => {
            const tags: string[] = page.metadata?.tags || [];
            if (tags.length > 0) {
              const color = getTagColor(projectTags, tags[0]);
              return { borderLeft: `3px solid ${color}` };
            }
            return {};
          })()}
        >
          <span className="material-symbols-outlined text-[14px] flex-shrink-0">{getDisplayIcon(page.icon)}</span>
          <span className="font-body-sm text-[12px] truncate flex-1">{page.title}</span>
          {page.metadata?.tags?.slice(0, 2).map((tag: string) => (
            <span
              key={tag}
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: getTagColor(projectTags, tag) }}
              title={tag}
            />
          ))}
        </button>
        <div className="sticky right-0 flex items-center justify-center bg-surface/90 backdrop-blur-sm opacity-0 group-hover/item:opacity-100 transition-opacity px-1 ml-1">
          {!page.metadata?.isProtected && (
          <Tooltip label="Delete page">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (e.shiftKey) {
                deletePage(page.id);
              } else {
                confirmDelete(
                  `Delete "${page.title}"?`,
                  'This will permanently remove the page. This cannot be undone.',
                  async () => {
                    setDeleteModal(null);
                    await deletePage(page.id);
                  }
                );
              }
            }}
            className="p-1 rounded flex items-center justify-center text-error hover:bg-error/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
          </button>
          </Tooltip>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && (
        <div className="flex flex-col">
          {childPages.map((child: any) => (
            <PageTreeItem
              key={child.id}
              page={child}
              allPages={allPages}
              activePageId={activePageId}
              navigateToPage={navigateToPage}
              confirmDelete={confirmDelete}
              deletePage={deletePage}
              setDeleteModal={setDeleteModal}
              level={level + 1}
              projectId={projectId}
              projectTags={projectTags}
              selectedPageIds={selectedPageIds}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export function Sidebar() {
  const [showCreatePage, setShowCreatePage] = useState(false);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [deleteModal, setDeleteModal] = useState<{ title: string; description: string; onConfirm: () => void } | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);

  // Load expanded projects from session on mount
  useEffect(() => {
    fetchExpandedProjects().then(ids => {
      const obj: Record<string, boolean> = {};
      ids.forEach(id => { obj[id] = true; });
      setExpandedProjects(obj);
    });
  }, []);

  // Save expanded projects whenever they change (debounced 500ms)
  useEffect(() => {
    const ids = Object.entries(expandedProjects)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const timer = setTimeout(() => saveExpandedProjects(ids), 500);
    return () => clearTimeout(timer);
  }, [expandedProjects]);
  const [iconPickerProject, setIconPickerProject] = useState<string | null>(null);
  const [iconPickerPos, setIconPickerPos] = useState<{ left: number; top: number } | null>(null);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { updateProject, pages } = useProjectStore();

  // ── Project renaming state ──
  const [renamingProjectId, setRenamingProjectId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  // ── Project drag-and-drop state ──
  const projectDragStateRef = useRef({
    isDragging: false,
    draggedProjectId: null as string | null,
    startX: 0,
    startY: 0,
    ghostEl: null as HTMLElement | null,
    dragTargetEl: null as HTMLElement | null,
    currentTargetEl: null as HTMLElement | null,
    currentPosition: null as 'above' | 'below' | null,
    autoScrollRaf: null as number | null,
    autoScrollDirection: null as 'up' | 'down' | null,
  });

  // ── Pointer-based drag-and-drop state ──
  const dragStateRef = useRef({
    isDragging: false,
    draggedPageId: null as string | null,
    startX: 0,
    startY: 0,
    ghostEl: null as HTMLElement | null,
    dragTargetEl: null as HTMLElement | null,
    currentTargetEl: null as HTMLElement | null,
    currentPosition: null as 'top' | 'center' | 'bottom' | null,
    autoScrollRaf: null as number | null,
    autoScrollDirection: null as 'up' | 'down' | null,
  });

  const PROJECT_ICONS = ['folder', 'article', 'dashboard', 'bar_chart', 'checklist', 'photo_library', 'storage', 'code', 'public', 'menu_book', 'star', 'favorite', 'settings', 'group', 'school', 'palette'];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerProject(null);
        setIconPickerPos(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const sidebarRef = useRef<HTMLElement>(null);
  const user = useAuthStore(s => s.user);
  const { projects, activeProjectId, activePageId, fetchPages, createProject, setActiveProject, deleteProject, deletePage, navigateToPage, fetchStandalonePages, movePageToProject, setActivePage } = useProjectStore();

  // ── Multi-select state ──
  const [selectedPageIds, setSelectedPageIds] = useState<Set<string>>(new Set());
  const selectedPageIdsRef = useRef(selectedPageIds);
  selectedPageIdsRef.current = selectedPageIds;
  const togglePageSelection = (id: string) => {
    setSelectedPageIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedPageIds(new Set());
  const selectAllInProject = () => {
    const allProjectPageIds = pages
      .filter(p => p.project_id === activeProjectId)
      .map(p => p.id);
    setSelectedPageIds(new Set(allProjectPageIds));
  };

  // Only show Move button when at least one selected page is a standalone page
  const hasStandaloneSelected = selectedPageIds.size > 0 && pages.some(p => selectedPageIds.has(p.id) && (p.project_id === undefined || p.project_id === null));

  // Reset move-to-project dropdown when no standalone pages are selected
  useEffect(() => {
    if (!hasStandaloneSelected) setShowMoveToProject(false);
  }, [hasStandaloneSelected]);

  // ── Move-to-project dropdown state ──
  const [showMoveToProject, setShowMoveToProject] = useState(false);
  const [moveDropdownPos, setMoveDropdownPos] = useState<{ left: number; top: number } | null>(null);
  const moveToProjectRef = useRef<HTMLDivElement>(null);
  const moveToProjectBtnRef = useRef<HTMLButtonElement>(null);

  // Position dropdown relative to the Move button
  useLayoutEffect(() => {
    if (!showMoveToProject || !moveToProjectBtnRef.current) {
      setMoveDropdownPos(null);
      return;
    }
    const rect = moveToProjectBtnRef.current.getBoundingClientRect();
    setMoveDropdownPos({ left: rect.left, top: rect.bottom + 4 });
  }, [showMoveToProject]);

  // Close move-to-project dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        moveToProjectRef.current && !moveToProjectRef.current.contains(e.target as Node) &&
        moveToProjectBtnRef.current && !moveToProjectBtnRef.current.contains(e.target as Node)
      ) {
        setShowMoveToProject(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Context menu for standalone pages ──
  const [contextMenu, setContextMenu] = useState<{ pageId: string; x: number; y: number } | null>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Clear selection when clicking empty area in sidebar (not on a page/project item)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const handler = (e: MouseEvent) => {
      if (selectedPageIdsRef.current.size === 0) return;
      const target = e.target as HTMLElement;
      if (target.closest('[data-page-id]') || target.closest('button') || target.closest('input')) return;
      clearSelection();
    };
    container.addEventListener('mousedown', handler);
    return () => container.removeEventListener('mousedown', handler);
  }, []);

  // Ctrl+A / Cmd+A to select all pages in the active project
  useEffect(() => {
    const sidebarEl = sidebarRef.current;
    if (!sidebarEl) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        // Only intercept if the sidebar or its children have focus (or no input is focused)
        const activeEl = document.activeElement;
        const isInputFocused = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable);
        if (isInputFocused) return;
        e.preventDefault();
        if (activeProjectIdRef.current) {
          selectAllInProject();
        }
      }
    };
    sidebarEl.addEventListener('keydown', handler);
    // Also listen on document for when sidebar isn't focused but user is in the area
    document.addEventListener('keydown', handler);
    return () => {
      sidebarEl.removeEventListener('keydown', handler);
      document.removeEventListener('keydown', handler);
    };
  }, []);

  // Keep a ref to activeProjectId so the keyboard handler can access it
  const activeProjectIdRef = useRef(activeProjectId);
  activeProjectIdRef.current = activeProjectId;

  // Listen for command-store signal to open the project creation modal
  const { openCreateProjectModal, setOpenCreateProjectModal } = useCommandStore();
  useEffect(() => {
    if (openCreateProjectModal) {
      setShowProjectModal(true);
      setOpenCreateProjectModal(false);
    }
  }, [openCreateProjectModal, setOpenCreateProjectModal]);

  // Fetch standalone pages on mount
  useEffect(() => {
    fetchStandalonePages();
  }, [fetchStandalonePages]);

  // Standalone pages = pages not belonging to any project
  const standalonePages = pages.filter(p => p.project_id === undefined || p.project_id === null);

  // ── Pointer-based drag-and-drop ──
  // Listens for pointerdown on the scrollable container to start a potential drag
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;

      // Find the [data-page-id] ancestor
      const target = (e.target as HTMLElement).closest('[data-page-id]') as HTMLElement | null;
      if (!target) return;

      const pageId = target.getAttribute('data-page-id');
      if (!pageId) return;

      // Prevent default browser behavior (text selection, etc.) during potential drag
      e.preventDefault();

      // Don't capture the pointer yet — let clicks pass through naturally.
      // If the user drags (movement threshold reached), we'll capture in pointermove.
      const state = dragStateRef.current;
      state.draggedPageId = pageId;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.isDragging = false;
      state.dragTargetEl = target;
    };

    container.addEventListener('pointerdown', handlePointerDown);
    return () => container.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  // Document-level pointermove/pointerup for the actual drag
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state.draggedPageId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (!state.isDragging) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        // Movement threshold reached — this is a drag, not a click.
        state.isDragging = true;

        // Now create the ghost and capture the pointer
        const target = state.dragTargetEl;
        if (target) {
          const ghost = target.cloneNode(true) as HTMLElement;
          ghost.className = ghost.className.replace(/\bw-full\b/g, '') + ' shadow-xl';
          const s = ghost.style;
          s.position = 'fixed';
          s.width = target.offsetWidth + 'px';
          s.pointerEvents = 'none';
          s.opacity = '0.92';
          s.zIndex = '9999';
          s.borderRadius = '8px';
          s.boxShadow = '0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(136,145,157,0.12)';
          s.transform = 'rotate(1deg) scale(0.98)';
          s.transition = 'none';
          s.background = 'var(--color-surface, #1e1e1e)';
          s.padding = '4px 8px';
          s.margin = '0';
          s.left = '-9999px';
          s.top = '-9999px';
          // Remove delete button from ghost to keep it clean
          const deleteBtns = ghost.querySelectorAll('[class*="sticky"], [class*="right"]');
          deleteBtns.forEach(el => (el as HTMLElement).style.display = 'none');
          // Reset any transform from inner elements
          const spans = ghost.querySelectorAll('[style*="translate"], [style*="rotate"]');
          spans.forEach(el => (el as HTMLElement).style.transform = 'none');
          // Add multi-select count badge if dragging a selected item
          const selIds = selectedPageIdsRef.current;
          const isMultiDrag = selIds.has(state.draggedPageId!) && selIds.size > 1;
          if (isMultiDrag) {
            const badge = document.createElement('div');
            badge.textContent = `${selIds.size}`;
            Object.assign(badge.style, {
              position: 'absolute',
              top: '-8px',
              right: '-8px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              background: 'var(--color-primary, #98cbff)',
              color: 'var(--color-on-primary, #003354)',
              fontSize: '11px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              zIndex: '10000',
              pointerEvents: 'none',
            });
            ghost.appendChild(badge);
          }

          document.body.appendChild(ghost);
          state.ghostEl = ghost;

          // Set grabbing cursor
          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';

          // Animate source: jiggle + placeholder gap
          target.classList.add('side-dragging-source');
          const placeholder = document.createElement('div');
          placeholder.className = 'side-drag-placeholder';
          target.parentElement?.insertBefore(placeholder, target.nextSibling);

          // Now capture the pointer since we know this is a drag
          target.setPointerCapture(e.pointerId);
        }
      }

      // Move ghost
      if (state.ghostEl) {
        state.ghostEl.style.left = `${e.clientX + 16}px`;
        state.ghostEl.style.top = `${e.clientY - 8}px`;
      }

      // ── Auto-scroll when dragging near container edges ──
      // Use draggedPageId + isDragging for earlier activation (isDragging may not be set yet
      // if the cursor reaches the edge before crossing the 5px movement threshold)
      if (state.draggedPageId && scrollContainerRef.current) {
        const scrollContainer = scrollContainerRef.current;
        const rect = scrollContainer.getBoundingClientRect();
        const threshold = 30;
        // Only start auto-scrolling after drag threshold is met, or if cursor is at the very edge
        if (e.clientY < rect.top + threshold) {
          if (state.autoScrollDirection !== 'up') {
            state.autoScrollDirection = 'up';
            // Cancel existing to prevent duplicate loops
            if (state.autoScrollRaf) {
              cancelAnimationFrame(state.autoScrollRaf);
              state.autoScrollRaf = null;
            }
            const doScroll = () => {
              if (state.autoScrollDirection !== 'up') return;
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop -= 10;
              }
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else if (e.clientY > rect.bottom - threshold) {
          if (state.autoScrollDirection !== 'down') {
            state.autoScrollDirection = 'down';
            if (state.autoScrollRaf) {
              cancelAnimationFrame(state.autoScrollRaf);
              state.autoScrollRaf = null;
            }
            const doScroll = () => {
              if (state.autoScrollDirection !== 'down') return;
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop += 10;
              }
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

      // ── Y-coordinate-based drop target detection ──
      // Finds the nearest page item by Y position, works reliably in gaps between items
      let foundTarget: HTMLElement | undefined;
      let relY = 0.5;

      const pageNodes = scrollContainerRef.current?.querySelectorAll('[data-page-id]');
      if (pageNodes) {
        const pageItems = Array.from(pageNodes) as HTMLElement[];
        for (const el of pageItems) {
          const rect = el.getBoundingClientRect();
          const pageId = el.getAttribute('data-page-id');
          if (!pageId || pageId === state.draggedPageId) continue;

          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            // Cursor is inside this item
            foundTarget = el;
            relY = (e.clientY - rect.top) / rect.height;
            break;
          }
        }

        // If cursor is in a gap between items, find the nearest one
        if (!foundTarget) {
          let minDist = Infinity;
          for (const el of pageItems) {
            const rect = el.getBoundingClientRect();
            const pageId = el.getAttribute('data-page-id');
            if (!pageId || pageId === state.draggedPageId) continue;
            const dist = Math.min(
              Math.abs(e.clientY - rect.top),
              Math.abs(e.clientY - rect.bottom)
            );
            if (dist < minDist) {
              minDist = dist;
              foundTarget = el;
              // Closer to top edge → position above; closer to bottom → below
              relY = Math.abs(e.clientY - rect.top) <= Math.abs(e.clientY - rect.bottom) ? 0 : 1;
            }
          }
        }
      }

      // Remove previous highlights
      document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-target').forEach((el: Element) => {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-target');
      });

      if (foundTarget) {
        const targetPageId = foundTarget.getAttribute('data-page-id');
        if (targetPageId !== state.draggedPageId) {
          let position: 'top' | 'center' | 'bottom';
          if (relY < 0.3) {
            position = 'top';
          } else if (relY > 0.7) {
            position = 'bottom';
          } else {
            position = 'center';
          }
          state.currentTargetEl = foundTarget;
          state.currentPosition = position;
          const treeItem = foundTarget.closest('.page-tree-item') as HTMLElement | null;
          if (treeItem) {
            treeItem.classList.add(position === 'top' ? 'drag-over-top' : position === 'bottom' ? 'drag-over-bottom' : 'drag-over-target');
          }
        }
      } else {
        state.currentTargetEl = null;
        state.currentPosition = null;
      }


    };

    const handlePointerUp = async (e: PointerEvent) => {
      const state = dragStateRef.current;
      const { draggedPageId, isDragging, currentTargetEl, currentPosition, ghostEl } = state;

      // Stop auto-scroll
      if (state.autoScrollRaf) {
        cancelAnimationFrame(state.autoScrollRaf);
        state.autoScrollRaf = null;
        state.autoScrollDirection = null;
      }

      // Clean up ghost
      if (ghostEl && document.body.contains(ghostEl)) document.body.removeChild(ghostEl);

      // Clean up source animation
      document.querySelectorAll('.side-dragging-source').forEach(el => {
        el.classList.remove('side-dragging-source');
      });
      document.querySelectorAll('.side-drag-placeholder').forEach(el => {
        el.remove();
      });

      // Clean up highlights
      document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-over-target').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-over-target');
      });

      // Release any pointer capture
      if (state.dragTargetEl?.hasPointerCapture(e.pointerId)) {
        state.dragTargetEl.releasePointerCapture(e.pointerId);
      }

      if (isDragging && draggedPageId && currentTargetEl && currentPosition) {
        const targetPageId = currentTargetEl.getAttribute('data-page-id');
        if (targetPageId && targetPageId !== draggedPageId) {
          const selIds = selectedPageIdsRef.current;
          if (selIds.has(draggedPageId) && selIds.size > 1) {
            const activeProjId = useProjectStore.getState().activeProjectId;
            if (activeProjId) {
              await executeBulkDrop(Array.from(selIds), targetPageId, currentPosition, activeProjId);
            }
          } else {
            await executeDrop(draggedPageId, targetPageId, currentPosition);
          }
        }
      }

      // Reset cursor and selection
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Reset state
      state.isDragging = false;
      state.draggedPageId = null;
      state.currentTargetEl = null;
      state.currentPosition = null;
      state.ghostEl = null;
      state.dragTargetEl = null;
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
    document.addEventListener('pointercancel', handlePointerUp);

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);

      // Clean up any in-progress drag artifacts if component unmounts during a drag
      const state = dragStateRef.current;
      if (state.autoScrollRaf) {
        cancelAnimationFrame(state.autoScrollRaf);
        state.autoScrollRaf = null;
        state.autoScrollDirection = null;
      }
      if (state.ghostEl && document.body.contains(state.ghostEl)) document.body.removeChild(state.ghostEl);
      document.querySelectorAll('.side-dragging-source').forEach(el => el.classList.remove('side-dragging-source'));
      document.querySelectorAll('.side-drag-placeholder').forEach(el => el.remove());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // ── Project pointer-based drag-and-drop ──
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleProjectPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      // Check if the click is on a project drag handle
      const handle = (e.target as HTMLElement).closest('[data-project-drag-handle]') as HTMLElement | null;
      if (!handle) return;

      const projectEl = handle.closest('[data-project-id]') as HTMLElement | null;
      if (!projectEl) return;

      const projectId = projectEl.getAttribute('data-project-id');
      if (!projectId) return;

      e.preventDefault();

      const state = projectDragStateRef.current;
      state.draggedProjectId = projectId;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.isDragging = false;
      state.dragTargetEl = projectEl;
    };

    container.addEventListener('pointerdown', handleProjectPointerDown);
    return () => container.removeEventListener('pointerdown', handleProjectPointerDown);
  }, []);

  // Document-level pointermove/pointerup for project drag
  useEffect(() => {
    const handleProjectPointerMove = (e: PointerEvent) => {
      const state = projectDragStateRef.current;
      if (!state.draggedProjectId) return;

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;

      if (!state.isDragging) {
        if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
        state.isDragging = true;

        const target = state.dragTargetEl;
        if (target) {
          const ghost = target.cloneNode(true) as HTMLElement;
          ghost.className = ghost.className.replace(/\bw-full\b/g, '') + ' shadow-xl';
          const s = ghost.style;
          s.position = 'fixed';
          s.width = target.offsetWidth + 'px';
          s.pointerEvents = 'none';
          s.opacity = '0.92';
          s.zIndex = '9999';
          s.borderRadius = '8px';
          s.boxShadow = '0 12px 40px rgba(0,0,0,0.3), 0 0 0 1px rgba(136,145,157,0.12)';
          s.transform = 'rotate(1deg) scale(0.98)';
          s.transition = 'none';
          s.background = 'var(--color-surface, #1e1e1e)';
          s.padding = '4px 8px';
          s.margin = '0';
          s.left = '-9999px';
          s.top = '-9999px';
          // Hide delete button and action buttons in ghost
          const actionEls = ghost.querySelectorAll('[class*="opacity-0"], button[class*="hover:bg-error"]');
          actionEls.forEach(el => (el as HTMLElement).style.display = 'none');
          document.body.appendChild(ghost);
          state.ghostEl = ghost;

          document.body.style.cursor = 'grabbing';
          document.body.style.userSelect = 'none';

          target.classList.add('side-dragging-source');
          const placeholder = document.createElement('div');
          placeholder.className = 'side-drag-placeholder';
          target.parentElement?.insertBefore(placeholder, target.nextSibling);

          target.setPointerCapture(e.pointerId);
        }
      }

      // Move ghost
      if (state.ghostEl) {
        state.ghostEl.style.left = `${e.clientX + 16}px`;
        state.ghostEl.style.top = `${e.clientY - 8}px`;
      }

      // Auto-scroll
      const scrollContainer = scrollContainerRef.current;
      if (scrollContainer && state.isDragging) {
        const rect = scrollContainer.getBoundingClientRect();
        const threshold = 30;
        if (e.clientY < rect.top + threshold) {
          if (state.autoScrollDirection !== 'up') {
            state.autoScrollDirection = 'up';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'up') return;
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop -= 10;
              }
              state.autoScrollRaf = requestAnimationFrame(doScroll);
            };
            state.autoScrollRaf = requestAnimationFrame(doScroll);
          }
        } else if (e.clientY > rect.bottom - threshold) {
          if (state.autoScrollDirection !== 'down') {
            state.autoScrollDirection = 'down';
            const doScroll = () => {
              if (state.autoScrollDirection !== 'down') return;
              if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTop += 10;
              }
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

      // ── Y-coordinate-based project drop target detection ──
      let projectTargetEl: HTMLElement | undefined;

      const projectNodes = scrollContainerRef.current?.querySelectorAll('[data-project-id]');
      if (projectNodes) {
        const projectItems = Array.from(projectNodes) as HTMLElement[];
        for (const el of projectItems) {
          const rect = el.getBoundingClientRect();
          const projId = el.getAttribute('data-project-id');
          if (!projId || projId === state.draggedProjectId) continue;
          if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
            projectTargetEl = el;
            break;
          }
        }

        // If in a gap, find the nearest project
        if (!projectTargetEl) {
          let minDist = Infinity;
          for (const el of projectItems) {
            const rect = el.getBoundingClientRect();
            const projId = el.getAttribute('data-project-id');
            if (!projId || projId === state.draggedProjectId) continue;
            const dist = Math.min(
              Math.abs(e.clientY - rect.top),
              Math.abs(e.clientY - rect.bottom)
            );
            if (dist < minDist) {
              minDist = dist;
              projectTargetEl = el;
            }
          }
        }
      }

      // Remove previous highlights
      document.querySelectorAll('.project-drag-over-above, .project-drag-over-below').forEach((el: Element) => {
        el.classList.remove('project-drag-over-above', 'project-drag-over-below');
      });

      if (projectTargetEl) {
        const targetProjectId = projectTargetEl.getAttribute('data-project-id');
        if (targetProjectId !== state.draggedProjectId) {
          const targetRect = projectTargetEl.getBoundingClientRect();
          const relY = (e.clientY - targetRect.top) / targetRect.height;
          if (relY < 0.5) {
            projectTargetEl.classList.add('project-drag-over-above');
            state.currentPosition = 'above';
          } else {
            projectTargetEl.classList.add('project-drag-over-below');
            state.currentPosition = 'below';
          }
          state.currentTargetEl = projectTargetEl;
        }
      } else {
        state.currentTargetEl = null;
        state.currentPosition = null;
      }
    };

    const handleProjectPointerUp = async (e: PointerEvent) => {
      const state = projectDragStateRef.current;
      const { draggedProjectId, isDragging, currentTargetEl, currentPosition, ghostEl } = state;

      // Stop auto-scroll
      if (state.autoScrollRaf) {
        cancelAnimationFrame(state.autoScrollRaf);
        state.autoScrollRaf = null;
        state.autoScrollDirection = null;
      }

      // Clean up ghost
      if (ghostEl && document.body.contains(ghostEl)) document.body.removeChild(ghostEl);

      // Clean up source animation
      document.querySelectorAll('.side-dragging-source').forEach(el => {
        el.classList.remove('side-dragging-source');
      });
      document.querySelectorAll('.side-drag-placeholder').forEach(el => {
        el.remove();
      });

      // Clean up highlights
      document.querySelectorAll('.project-drag-over-above, .project-drag-over-below').forEach(el => {
        el.classList.remove('project-drag-over-above', 'project-drag-over-below');
      });

      // Release any pointer capture
      if (state.dragTargetEl?.hasPointerCapture(e.pointerId)) {
        state.dragTargetEl.releasePointerCapture(e.pointerId);
      }

      if (isDragging && draggedProjectId && currentTargetEl && currentPosition) {
        const targetProjectId = currentTargetEl.getAttribute('data-project-id');
        if (targetProjectId && targetProjectId !== draggedProjectId) {
          await executeProjectDrop(draggedProjectId, targetProjectId, currentPosition);
        }
      }

      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      // Reset state
      state.isDragging = false;
      state.draggedProjectId = null;
      state.currentTargetEl = null;
      state.currentPosition = null;
      state.ghostEl = null;
      state.dragTargetEl = null;
    };

    document.addEventListener('pointermove', handleProjectPointerMove);
    document.addEventListener('pointerup', handleProjectPointerUp);
    document.addEventListener('pointercancel', handleProjectPointerUp);

    return () => {
      document.removeEventListener('pointermove', handleProjectPointerMove);
      document.removeEventListener('pointerup', handleProjectPointerUp);
      document.removeEventListener('pointercancel', handleProjectPointerUp);

      const state = projectDragStateRef.current;
      if (state.autoScrollRaf) {
        cancelAnimationFrame(state.autoScrollRaf);
        state.autoScrollRaf = null;
        state.autoScrollDirection = null;
      }
      if (state.ghostEl && document.body.contains(state.ghostEl)) document.body.removeChild(state.ghostEl);
      document.querySelectorAll('.side-dragging-source').forEach(el => el.classList.remove('side-dragging-source'));
      document.querySelectorAll('.side-drag-placeholder').forEach(el => el.remove());
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  // Execute project drop: reorder projects
  const executeProjectDrop = async (draggedProjectId: string, targetProjectId: string, position: 'above' | 'below') => {
    const { projects, updateProject } = useProjectStore.getState();
    const sortedProjects = [...projects].sort((a, b) => (a.position || 0) - (b.position || 0));

    const draggedIdx = sortedProjects.findIndex(p => p.id === draggedProjectId);
    const targetIdx = sortedProjects.findIndex(p => p.id === targetProjectId);

    if (draggedIdx === -1 || targetIdx === -1) return;

    // Remove dragged from the sorted array
    sortedProjects.splice(draggedIdx, 1);

    // Find new index — target may have shifted if dragged was before it
    const newTargetIdx = sortedProjects.findIndex(p => p.id === targetProjectId);
    let insertAt = position === 'above' ? newTargetIdx : newTargetIdx + 1;

    // Re-insert dragged at the new position
    const draggedProj = projects.find(p => p.id === draggedProjectId);
    if (!draggedProj) return;
    sortedProjects.splice(insertAt, 0, draggedProj);

    // Reassign positions: 0, 1, 2, ...
    const updates = sortedProjects.map((p, i) => ({
      id: p.id,
      position: i,
    }));

    // Apply updates in parallel
    await Promise.all(
      updates.map(u => updateProject(u.id, { position: u.position }))
    );
  };

  // Execute bulk drop: reorder multiple selected pages together
  const executeBulkDrop = async (draggedPageIds: string[], targetPageId: string, position: 'top' | 'center' | 'bottom', projectId: string) => {
    const { pages, updatePage } = useProjectStore.getState();
    const allProjectPages = pages.filter(p => p.project_id === projectId);
    const targetPage = allProjectPages.find(p => p.id === targetPageId);
    if (!targetPage) return;

    // Sort selected pages by current position
    const sortedSelected = draggedPageIds
      .map(id => allProjectPages.find(p => p.id === id))
      .filter(Boolean)
      .sort((a, b) => (a!.position || 0) - (b!.position || 0));

    if (sortedSelected.length < 2) return;

    const targetParentId = targetPage.metadata?.parentId || null;
    const siblings = allProjectPages
      .filter(p => (p.metadata?.parentId || null) === targetParentId && !draggedPageIds.includes(p.id))
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    if (position === 'center') {
      // Reparent all selected under the target page
      for (let i = 0; i < sortedSelected.length; i++) {
        const p = sortedSelected[i];
        await updatePage(p!.id, {
          position: i,
          metadata: { ...(p!.metadata || {}), parentId: targetPage.id }
        });
      }
      return;
    }

    const targetIndex = siblings.findIndex(p => p.id === targetPage.id);
    if (targetIndex === -1) return;

    // Determine insertion index in the siblings array
    let insertIndex = position === 'top' ? targetIndex : targetIndex + 1;

    // Calculate base position
    let basePos: number;
    if (insertIndex <= 0) {
      basePos = (siblings[0]?.position || 0) - sortedSelected.length - 1;
    } else if (insertIndex >= siblings.length) {
      basePos = (siblings[siblings.length - 1]?.position || 0) + 1;
    } else {
      // Insert between siblings
      const before = siblings[insertIndex - 1]?.position || 0;
      const after = siblings[insertIndex]?.position || 0;
      basePos = (before + after) / 2 - (sortedSelected.length * 0.1);
    }

    // Assign positions to selected pages, preserving their relative order
    for (let i = 0; i < sortedSelected.length; i++) {
      const p = sortedSelected[i];
      await updatePage(p!.id, {
        position: basePos + i * 0.1,
        metadata: { ...(p!.metadata || {}), parentId: targetParentId }
      });
    }
  };

  // Execute the drop: reorder or reparent
  const executeDrop = async (draggedPageId: string, targetPageId: string, position: 'top' | 'center' | 'bottom') => {
    const { pages, activeProjectId, updatePage } = useProjectStore.getState();
    const allProjectPages = pages.filter(p => p.project_id === activeProjectId);
    const targetPage = allProjectPages.find(p => p.id === targetPageId);
    const draggedPage = allProjectPages.find(p => p.id === draggedPageId);

    if (!targetPage || !draggedPage) return;

    if (position === 'center') {
      // Drop ON the page → reparent as child
      let currentId = targetPage.id;
      let isCircular = false;
      let depth = 0;
      while (depth < 20) {
        const p = allProjectPages.find(pg => pg.id === currentId);
        if (!p || !p.metadata?.parentId) break;
        if (p.metadata.parentId === draggedPageId) { isCircular = true; break; }
        currentId = p.metadata.parentId;
        depth++;
      }
      if (isCircular) return;

      await updatePage(draggedPageId, {
        metadata: { ...(draggedPage.metadata || {}), parentId: targetPage.id }
      });
    } else {
      // Drop above/below → reorder at same level
      const parentId = targetPage.metadata?.parentId || null;

      const siblings = allProjectPages
        .filter(p => (p.metadata?.parentId || null) === parentId && p.id !== draggedPageId)
        .sort((a, b) => (a.position || 0) - (b.position || 0));

      const targetIndex = siblings.findIndex(p => p.id === targetPage.id);
      let newPosition: number;

      if (position === 'top') {
        newPosition = targetIndex <= 0
          ? (siblings[0]?.position || 0) - 1
          : ((siblings[targetIndex - 1]?.position || 0) + (siblings[targetIndex]?.position || 0)) / 2;
      } else {
        newPosition = (targetIndex >= siblings.length - 1 || targetIndex < 0)
          ? (siblings[siblings.length - 1]?.position || 0) + 1
          : ((siblings[targetIndex]?.position || 0) + (siblings[targetIndex + 1]?.position || 0)) / 2;
      }

      await updatePage(draggedPageId, {
        position: newPosition,
        metadata: { ...(draggedPage.metadata || {}), parentId }
      });
    }
  };
  const handleCreateProject = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (newProjectName.trim()) {
      await createProject(newProjectName.trim());
      setShowProjectModal(false);
      setNewProjectName("");
    }
  }

  const confirmDelete = (title: string, description: string, onConfirm: () => void) => {
    setDeleteModal({ title, description, onConfirm });
  };

  return (
    <aside ref={sidebarRef} className="h-full w-full flex-shrink-0 flex flex-col border-r border-outline/30 shadow-[2px_0_15px_rgba(0,0,0,0.3)] bg-surface/50 backdrop-blur-md z-20" onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}>
        <div className="p-3 flex items-center gap-2 border-b border-outline/10">
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-6 h-6 rounded overflow-hidden flex items-center justify-center">
              <img src="/logo.jpg" alt="Notie Logo" className="w-full h-full object-cover" />
            </div>
          </div>
          <button
            onClick={() => setShowSearchModal(true)}
            className="flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-variant/30 border border-outline/10 hover:border-primary/30 hover:bg-primary/5 transition-all text-left min-w-0"
          >
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant/60 flex-shrink-0">search</span>
            <span className="text-[12px] text-on-surface-variant/40 truncate flex-1">Search pages…</span>
            <SearchShortcut />
          </button>
        </div>
      
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto overflow-x-hidden hide-scrollbar py-4">
        {/* ════ Standalone Pages ════ */}
        {standalonePages.length > 0 && (
          <div className="px-2 mb-3">
            <div className="px-2 mb-1.5 flex items-center justify-between group">
              <span className="text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/60">Standalone Pages</span><span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ml-1.5">{standalonePages.length}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              {standalonePages.map(page => (
                <div key={page.id} className="flex items-center w-full group/page-item" data-page-id={page.id}>
                  <button
                    onClick={(e) => {
                      if (e.ctrlKey || e.metaKey || e.shiftKey) {
                        e.stopPropagation();
                        togglePageSelection(page.id);
                        return;
                      }
                      if (selectedPageIds.size > 0) {
                        clearSelection();
                      }
                      setActivePage(page.id);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setContextMenu({ pageId: page.id, x: e.clientX, y: e.clientY });
                    }}
                    className={`flex-1 flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors text-left ${
                      activePageId === page.id ? 'bg-primary/10 text-primary' : 'hover:bg-on-surface/5 text-on-surface-variant'
                    } ${
                      selectedPageIds.has(page.id) ? 'ring-2 ring-primary/50 bg-primary/5' : ''
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px] flex-shrink-0">{getDisplayIcon(page.icon)}</span>
                    <span className="font-body-sm text-[12px] truncate flex-1">{page.title}</span>
                    {page.type && page.type !== 'text' && (
                      <span className="text-[9px] uppercase tracking-wider text-on-surface-variant/40 flex-shrink-0">{page.type}</span>
                    )}
                  </button>
                  {!page.metadata?.isProtected && (
                    <Tooltip label="Delete page">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (e.shiftKey) {
                            deletePage(page.id);
                          } else {
                            confirmDelete(
                              `Delete "${page.title}"?`,
                              'This will permanently remove the page. This cannot be undone.',
                              async () => {
                                setDeleteModal(null);
                                await deletePage(page.id);
                              }
                            );
                          }
                        }}
                        className="p-1 rounded flex items-center justify-center text-error hover:bg-error/10 transition-colors opacity-0 group-hover/page-item:opacity-100"
                      >
                        <span className="material-symbols-outlined text-[14px]">delete</span>
                      </button>
                    </Tooltip>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <StandalonePageCreator />

        <div className="pb-2">
          <div className="px-4 mb-2 flex items-center justify-between group">
            <span className="text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant">Projects</span>
            <span className="bg-primary/15 text-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full leading-none ml-1">{projects.length}</span>
            <button 
              className="opacity-60 hover:opacity-100 transition-opacity"
              onClick={() => setShowProjectModal(true)}
            >
              <span className="material-symbols-outlined text-[14px] text-on-surface-variant hover:text-primary">add</span>
            </button>
          </div>
          
          <nav className="space-y-0.5 px-2">
          {projects.length === 0 ? (
            <div className="px-2 py-4 text-center text-label-md text-on-surface-variant">
              No projects yet. Click + to create one.
            </div>
          ) : (
            projects.map(p => {
              const isExpanded = expandedProjects[p.id] ?? (activeProjectId === p.id);
              
              return (
              <div key={p.id} data-project-id={p.id} className="w-full mb-1 relative group/project">
                <div className="flex items-center w-full" style={{ touchAction: 'none' }}>
                  {/* Drag handle */}
                  <button
                    data-project-drag-handle
                    className="w-5 flex-shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing text-on-surface-variant/20 hover:text-on-surface-variant/60 transition-colors opacity-0 group-hover/project:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[14px] pointer-events-none">drag_indicator</span>
                  </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveProject(p.id);
                        // If expanding and pages for this project aren't loaded yet, fetch them
                        if (!isExpanded) {
                          const hasPages = pages.some(page => page.project_id === p.id);
                          if (!hasPages) {
                            fetchPages(p.id);
                          }
                        }
                        setExpandedProjects(prev => ({ ...prev, [p.id]: !isExpanded }));
                      }}
                      className="p-1 mr-0.5 rounded hover:bg-on-surface/10 text-on-surface-variant transition-colors flex items-center justify-center">
                        <span className="material-symbols-outlined text-[16px] transition-transform duration-200" style={{ transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>expand_more</span>
                      </button>
                  <div
                    onClick={() => {
                      setActiveProject(p.id);
                      setExpandedProjects(prev => ({ ...prev, [p.id]: true }));
                    }}
                    className={`flex-1 flex items-center gap-2 px-1 py-1.5 rounded-lg transition-colors cursor-pointer ${
                      activeProjectId === p.id ? 'bg-primary/10 text-primary' : 'hover:bg-on-surface/5 text-on-surface-variant'
                    }`}
                  >
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (iconPickerProject === p.id) {
                          setIconPickerProject(null);
                          setIconPickerPos(null);
                        } else {
                          setIconPickerProject(p.id);
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          setIconPickerPos({ left: rect.left, top: rect.bottom + 4 });
                        }
                      }}
                      className={`material-symbols-outlined text-[16px] ${activeProjectId === p.id ? 'text-primary' : 'hover:text-primary'} transition-colors hover:scale-110 flex-shrink-0`}
                    >{getDisplayIcon(p.icon)}</button>
                    {renamingProjectId === p.id ? (
                      <input
                        ref={renameInputRef}
                        autoFocus
                        type="text"
                        value={projectNameDraft}
                        onChange={(e) => setProjectNameDraft(e.target.value)}
                        onBlur={async () => {
                          const trimmed = projectNameDraft.trim();
                          if (trimmed && trimmed !== p.name) {
                            await updateProject(p.id, { name: trimmed });
                          }
                          setRenamingProjectId(null);
                          setProjectNameDraft('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Escape') {
                            setRenamingProjectId(null);
                            setProjectNameDraft('');
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className={`flex-1 bg-background/60 border border-primary/40 rounded px-1.5 py-0.5 text-[13px] outline-none min-w-0 ${
                          activeProjectId === p.id ? 'text-primary font-medium' : 'text-on-surface'
                        }`}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setRenamingProjectId(p.id);
                          setProjectNameDraft(p.name);
                          // Focus input after render
                          requestAnimationFrame(() => renameInputRef.current?.select());
                        }}
                        className={`font-body-md text-[13px] flex-1 truncate cursor-default ${
                          activeProjectId === p.id ? 'text-primary font-medium' : 'hover:text-on-surface text-on-surface-variant'
                        }`}
                      >{p.name}</span>
                    )}
                  </div>
                  <Tooltip label="Delete project">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (e.shiftKey) {
                        deleteProject(p.id);
                      } else {
                        confirmDelete(
                          `Delete "${p.name}"?`,
                          'This will permanently remove the project and all its pages. This cannot be undone.',
                          async () => {
                            setDeleteModal(null);
                            await deleteProject(p.id);
                          }
                        );
                      }
                    }}
                    className="ml-1 p-1 rounded hover:bg-error/10 transition-colors opacity-0 group-hover/project:opacity-100"
                  >
                    <span className="material-symbols-outlined text-[14px] text-error">delete</span>
                  </button>
                  </Tooltip>
                </div>

                {iconPickerProject === p.id && iconPickerPos && createPortal(
                  <div ref={iconPickerRef} className="fixed bg-surface border border-outline/20 rounded-xl shadow-2xl p-2 w-48 backdrop-blur-xl z-[9999]" style={{ left: iconPickerPos.left + 'px', top: iconPickerPos.top + 'px' }}>
                    <div className="text-[10px] font-semibold text-on-surface-variant uppercase tracking-wider px-1 mb-1.5">Project Icon</div>
                    <div className="grid grid-cols-5 gap-1">
                      {PROJECT_ICONS.map(ic => (
                        <button
                          key={ic}
                          onClick={() => { updateProject(p.id, { icon: ic }); setIconPickerProject(null); }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                            (p.icon === ic || (!p.icon && ic === 'folder')) ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-surface/50 hover:text-primary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px]">{ic}</span>
                        </button>
                      ))}
                    </div>
                  </div>,
                  document.body
                )}
                
                {/* Render Pages and Create Buttons for Project */}
                {isExpanded && (
                  <div className="pl-6 pr-2 mt-1 flex flex-col gap-1">
                    {/* Page list */}
                    <div className="rounded-md transition-colors">
                      {pages.filter(page => page.project_id === p.id && !page.metadata?.parentId).sort((a, b) => {
                        if (a.type === 'dashboard') return -1;
                        if (b.type === 'dashboard') return 1;
                        return (a.position || 0) - (b.position || 0);
                      }).map(page => (
                        <PageTreeItem
                          key={page.id}
                          page={page}
                          allPages={pages.filter(pg => pg.project_id === p.id)}
                          activePageId={activePageId}
                          navigateToPage={navigateToPage}
                          confirmDelete={confirmDelete}
                          deletePage={deletePage}
                          setDeleteModal={setDeleteModal}
                          projectId={p.id}
                          projectTags={p.settings?.projectTags || []}
                          selectedPageIds={selectedPageIds}
                          onToggleSelect={togglePageSelection}
                        />
                      ))}
                    </div>

                    <div className="mt-2 mb-1 px-1">
                      <div className="text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/70 mb-1.5">Add Page</div>
                      <div className="grid grid-cols-[repeat(auto-fill,minmax(28px,1fr))] gap-1">
                        {[
                          { type: 'text', label: 'Text', icon: 'article' },
                          { type: 'table', label: 'Table', icon: 'grid_on' },
                          { type: 'board', label: 'Board', icon: 'dashboard' },
                          { type: 'chart', label: 'Chart', icon: 'bar_chart' },
                          { type: 'gallery', label: 'Gallery', icon: 'photo_library' },
                          { type: 'dashboard', label: 'Dashboard', icon: 'dashboard_customize' },
                          { type: 'folder', label: 'Folder', icon: 'folder' },
                          { type: 'checklist', label: 'Checklist', icon: 'checklist' },
                          { type: 'canvas', label: 'Canvas', icon: 'gesture' },
                          { type: 'audio', label: 'Audio', icon: 'mic' },
                          { type: 'video', label: 'Video', icon: 'videocam' },
                          { type: 'file', label: 'Files', icon: 'description' }
                        ].filter(pt => pt.type !== 'dashboard' || !pages.some(pg => pg.project_id === p.id && pg.type === 'dashboard')).map(pt => (
                          <Tooltip key={pt.type} label={`Add ${pt.label}`}>
                          <button
                            onClick={async () => {
                              const store = useProjectStore.getState();
                              await store.createPage(p.id, `Untitled ${pt.label}`, pt.type, {}, pt.icon);
                              await store.fetchPages(p.id);
                            }}
                            className="p-1.5 rounded-md hover:bg-primary/20 text-on-surface-variant hover:text-primary transition-colors border border-outline/10 hover:border-primary/30"
                          >
                            <span className="material-symbols-outlined text-[14px] block">{pt.icon}</span>
                          </button>
                          </Tooltip>
                        ))}
                      </div>
                    </div>

                    {/* Create from Template */}
                    <div className="mt-3 mb-1 px-1">
                      <FromTemplateButton projectId={p.id} />
                    </div>
                  </div>
                )}
              </div>
            );
          }))}
        </nav>
        </div>
      </div>

      <div className="p-3 border-t border-outline/10 flex items-center gap-2">
        <button
          onClick={() => setShowSettings(true)}
          className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs text-primary font-bold hover:bg-primary/30 transition-colors cursor-pointer flex-shrink-0"
        >
          {(user?.email?.charAt(0) || 'U').toUpperCase()}
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-medium text-on-surface truncate">{user?.email || 'User'}</p>
          <p className="text-[9px] text-on-surface-variant/50">Account settings</p>
        </div>
        <Tooltip label="Settings">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-lg text-on-surface-variant/50 hover:text-on-surface hover:bg-on-surface/10 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">settings</span>
          </button>
        </Tooltip>
      </div>

      {/* ════ Multi-select Action Bar ════ */}
      {selectedPageIds.size > 0 && (
        <div className="p-3 border-t border-primary/20 bg-primary/5 backdrop-blur-md flex items-center gap-2">
          <span className="text-xs text-on-surface-variant flex-1">
            <span className="font-semibold text-primary">{selectedPageIds.size}</span> selected
          </span>
          <button
            onClick={selectAllInProject}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors text-xs font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">select_all</span>
            Select All
          </button>
          {hasStandaloneSelected && (
          <div className="relative">
            <button
              ref={moveToProjectBtnRef}
              onClick={() => setShowMoveToProject(!showMoveToProject)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors text-xs font-medium"
            >
              <span className="material-symbols-outlined text-[14px]">drive_file_move</span>
              Move
            </button>
            {showMoveToProject && createPortal(
              <div
                ref={moveToProjectRef}
                className="fixed z-[9999] min-w-[180px] bg-surface border border-outline/20 rounded-xl shadow-2xl p-1.5 backdrop-blur-xl"
                style={moveDropdownPos ? { left: moveDropdownPos.left + 'px', top: moveDropdownPos.top + 'px' } : undefined}
              >
                <div className="px-2 py-1.5 text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/60">
                  Move to Project
                </div>
                {projects.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-on-surface-variant/40">No projects available</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto">
                    {projects.map(proj => (
                      <button
                        key={proj.id}
                        onClick={async () => {
                          setShowMoveToProject(false);
                          const ids = Array.from(selectedPageIds);
                          for (const id of ids) {
                            await movePageToProject(id, proj.id);
                          }
                          clearSelection();
                          if (activeProjectId && activeProjectId !== proj.id) {
                            await fetchPages(activeProjectId);
                          }
                          await fetchPages(proj.id);
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-on-surface/10 transition-colors text-left"
                      >
                        <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{getDisplayIcon(proj.icon)}</span>
                        <span className="text-xs text-on-surface truncate">{proj.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>,
              document.body
            )}
          </div>
          )}
          <button
            onClick={() => {
              const count = selectedPageIds.size;
              confirmDelete(
                `Delete ${count} page${count !== 1 ? 's' : ''}?`,
                `This will permanently remove ${count} page${count !== 1 ? 's' : ''}. This cannot be undone.`,
                async () => {
                  const ids = Array.from(selectedPageIds);
                  for (const id of ids) {
                    await deletePage(id);
                  }
                  setDeleteModal(null);
                  clearSelection();
                }
              );
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-error/15 text-error hover:bg-error/25 transition-colors text-xs font-medium"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Delete
          </button>
          <button
            onClick={clearSelection}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-xs"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        </div>
      )}

      {showCreatePage && activeProjectId && <CreatePagePanel onClose={() => setShowCreatePage(false)} projectId={activeProjectId} />}

      {/* Custom Project Creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface border border-outline/20 rounded-xl p-6 w-full max-w-sm shadow-2xl">
            <h3 className="text-lg font-bold text-on-surface mb-2">Create New Project</h3>
            <p className="text-sm text-on-surface-variant mb-4">Enter a name for your new workspace.</p>
            <form onSubmit={handleCreateProject}>
              <input
                autoFocus
                type="text"
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="e.g. Personal Wiki, Marketing Campaign..."
                className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary mb-5"
              />
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newProjectName.trim()}
                  className="px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

       {/* Delete Confirmation Modal */}
       {deleteModal && (
         <DeleteConfirmModal
           title={deleteModal.title}
           description={deleteModal.description}
           onConfirm={deleteModal.onConfirm}
           onCancel={() => setDeleteModal(null)}
         />
       )}
       
       {/* Search Modal */}
       {showSearchModal && <SearchModal onClose={() => setShowSearchModal(false)} />}

       {/* Context menu for standalone pages */}
       {contextMenu && createPortal(
         <div
           ref={contextMenuRef}
           className="fixed z-[9999] min-w-[180px] bg-surface border border-outline/20 rounded-xl shadow-2xl p-1.5 backdrop-blur-xl"
           style={{ left: contextMenu.x, top: contextMenu.y }}
         >
           <div className="px-2 py-1.5 text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant/60">
             Move to Project
           </div>
           {projects.length === 0 ? (
             <p className="px-2 py-2 text-xs text-on-surface-variant/40">No projects available</p>
           ) : (
             <div className="max-h-48 overflow-y-auto">
               {projects.map(proj => (
                 <button
                   key={proj.id}
                   onClick={async () => {
                     await movePageToProject(contextMenu.pageId, proj.id);
                     setContextMenu(null);
                     // Navigate to the page within the project
                     if (activeProjectId !== proj.id) {
                       await setActiveProject(proj.id);
                     } else {
                       await fetchPages(proj.id);
                     }
                     setActivePage(contextMenu.pageId);
                   }}
                   className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-on-surface/10 transition-colors text-left"
                 >
                   <span className="material-symbols-outlined text-[14px] text-on-surface-variant">{getDisplayIcon(proj.icon)}</span>
                   <span className="text-xs text-on-surface truncate">{proj.name}</span>
                 </button>
               ))}
             </div>
           )}
         </div>,
         document.body
       )}      {/* Command-store triggered search modal */}
      <CommandSearchBridge />

      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

     </aside>
   )
 }

/** Bridge that listens for command-store signal to open the search modal */
function CommandSearchBridge() {
  const { openSearchModal, setOpenSearchModal } = useCommandStore()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (openSearchModal) {
      setOpen(true)
      setOpenSearchModal(false)
    }
  }, [openSearchModal, setOpenSearchModal])

  return open ? <SearchModal onClose={() => setOpen(false)} /> : null
}

/** Badge showing the keyboard shortcut to open search (Ctrl+P / ⌘P) */
function SearchShortcut() {
  const shortcut = useShortcutStore(s => s.getDisplayString('commandPalette'))
  return (
    <kbd className="text-[9px] text-on-surface-variant/30 bg-surface-variant/50 px-1 py-0.5 rounded font-mono border border-outline/5 flex-shrink-0">{shortcut}</kbd>
  )
}

/** All page types available for creation */
const STANDALONE_PAGE_TYPES = [
  { type: 'text', label: 'Text', icon: 'article' },
  { type: 'table', label: 'Table', icon: 'grid_on' },
  { type: 'board', label: 'Board', icon: 'dashboard' },
  { type: 'chart', label: 'Chart', icon: 'bar_chart' },
  { type: 'gallery', label: 'Gallery', icon: 'photo_library' },
  { type: 'checklist', label: 'Checklist', icon: 'checklist' },
  { type: 'canvas', label: 'Canvas', icon: 'gesture' },
  { type: 'audio', label: 'Audio', icon: 'mic' },
  { type: 'video', label: 'Video', icon: 'videocam' },
  { type: 'file', label: 'Files', icon: 'description' },
];

/** Button to create a new standalone page with any type */
function StandalonePageCreator() {
  const [showPicker, setShowPicker] = useState(false)
  const [title, setTitle] = useState('')
  const [selectedType, setSelectedType] = useState<string>('text')
  const inputRef = useRef<HTMLInputElement>(null)
  const { createStandalonePage } = useProjectStore()

  useEffect(() => {
    if (showPicker) setTimeout(() => inputRef.current?.focus(), 50)
  }, [showPicker])

  const handleCreate = async (type?: string) => {
    const pageType = type || selectedType
    const name = title.trim() || `Untitled ${STANDALONE_PAGE_TYPES.find(t => t.type === pageType)?.label || 'Page'}`
    const icon = STANDALONE_PAGE_TYPES.find(t => t.type === pageType)?.icon || 'description'
    await createStandalonePage(name, pageType, icon)
    setTitle('')
    setSelectedType('text')
    setShowPicker(false)
  }

  return (
    <div className="px-3 mb-3">
      {showPicker ? (
        <div className="flex flex-col gap-2">
          {/* Title input */}
          <div className="flex items-center gap-1.5">
            <input
              ref={inputRef}
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') { setShowPicker(false); setTitle(''); setSelectedType('text') }
              }}
              placeholder="Page title (optional)..."
              className="flex-1 bg-surface-variant/40 border border-outline/20 rounded-lg px-2.5 py-1.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/40"
            />
            <button
              onClick={() => { setShowPicker(false); setTitle(''); setSelectedType('text') }}
              className="p-1.5 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
            </button>
          </div>
          {/* Type picker grid */}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(36px,1fr))] gap-1">
            {STANDALONE_PAGE_TYPES.map(pt => (
              <button
                key={pt.type}
                onClick={() => handleCreate(pt.type)}
                title={pt.label}
                className={`p-1.5 rounded-md transition-all border text-on-surface-variant hover:text-primary ${
                  selectedType === pt.type
                    ? 'border-primary/40 bg-primary/15 text-primary'
                    : 'border-outline/10 hover:border-primary/30 hover:bg-primary/5'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] block">{pt.icon}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <Tooltip label="Create standalone page">
          <button
            onClick={() => setShowPicker(true)}
            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-dashed border-outline/20 text-on-surface-variant hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all text-xs"
          >
            <span className="material-symbols-outlined text-[14px]">add</span>
            <span className="font-medium">New Standalone Page</span>
          </button>
        </Tooltip>
      )}
    </div>
  )
}

