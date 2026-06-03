import { useState, useEffect, useRef, useMemo } from 'react';
import { Editor } from '@tiptap/react';
import { useProjectStore } from '../../stores/projectStore';

interface EditorContextMenuProps {
  editor: Editor;
  activePageId: string;
  projectId: string;
}

export function EditorContextMenu({ editor, activePageId }: EditorContextMenuProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [showInsertSubmenu, setShowInsertSubmenu] = useState(false);
  const [search, setSearch] = useState('');
  const menuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef(editor);
  editorRef.current = editor;

  const filtered = useMemo(() => {
    const items: { type: string; label: string; icon: string; iconColor: string; action: () => void }[] = [];
    const ed = editorRef.current;
    const store = useProjectStore.getState();
    const allPages = store.pages;

    allPages.filter(p => p.id !== activePageId && p.type !== 'dashboard').forEach(p => {
      items.push({
        type: 'page', label: p.title, icon: p.icon || 'description', iconColor: '',
        action: () => {
          (ed.commands as any).insertPageLink({ pageId: p.id, pageTitle: p.title, pageIcon: p.icon || 'description' });
          store.setPendingGraphLink({ sourcePageId: activePageId, targetPageId: p.id });
          closeMenu();
        },
      });
    });

    allPages.filter(p => p.type === 'gallery' && Array.isArray(p.content)).forEach(p => {
      (p.content as any[]).forEach((item: any) => {
        if (!item.id || !item.title) return;
        items.push({
          type: 'gallery', label: `${item.title}  —  ${p.title}`, icon: 'image', iconColor: 'text-cyan-400',
          action: () => {
            (ed.commands as any).insertGalleryImage({ imgUrl: item.url, title: item.title, pageId: p.id, itemId: item.id });
            closeMenu();
          },
        });
      });
    });

    allPages.filter(p => p.type === 'board' && Array.isArray(p.content)).forEach(p => {
      (p.content as any[]).forEach((card: any) => {
        if (!card.id || !card.title) return;
        items.push({
          type: 'board', label: `${card.title}  —  ${p.title}`, icon: 'sticky_note_2', iconColor: 'text-violet-400',
          action: () => {
            (ed.commands as any).insertBoardCard({ cardId: card.id, title: card.title, pageId: p.id });
            // Also add the current page to the card's linkedPages for bidirectional linking
            const boardPage = allPages.find(bp => bp.id === p.id);
            if (boardPage && Array.isArray(boardPage.content)) {
              const currentPage = allPages.find(cp => cp.id === activePageId);
              if (currentPage) {
                const newContent = [...boardPage.content];
                const cardIdx = newContent.findIndex((c: any) => c.id === card.id);
                if (cardIdx !== -1) {
                  const updatedCard = { ...newContent[cardIdx] };
                  const linkedPages = updatedCard.linkedPages || [];
                  if (!linkedPages.some((lp: any) => lp.pageId === activePageId)) {
                    updatedCard.linkedPages = [...linkedPages, { pageId: activePageId, pageTitle: currentPage.title || 'Untitled' }];
                    newContent[cardIdx] = updatedCard;
                    store.updatePageContent(p.id, newContent);
                  }
                }
              }
            }
            store.setPendingGraphLink({ sourcePageId: activePageId, targetPageId: p.id });
            closeMenu();
          },
        });
      });
    });

    items.sort((a, b) => a.label.localeCompare(b.label));

    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(i => i.label.toLowerCase().includes(q));
  }, [search, activePageId]);

  const closeMenu = () => {
    setVisible(false);
    setShowInsertSubmenu(false);
    setSearch('');
  };

  useEffect(() => {
    const editorElement = editor.view.dom;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      const editorRect = editorElement.closest('.w-full.relative.group')?.getBoundingClientRect();
      if (!editorRect) return;
      setPosition({ x: e.clientX - editorRect.left, y: e.clientY - editorRect.top });
      setVisible(true);
      setShowInsertSubmenu(false);
      setSearch('');
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) closeMenu();
    };

    editorElement.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      editorElement.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [editor]);

  useEffect(() => {
    if (showInsertSubmenu && searchInputRef.current) searchInputRef.current.focus();
  }, [showInsertSubmenu]);

  if (!visible) return null;

  return (
    <div ref={menuRef} className="absolute z-50" style={{ left: position.x, top: position.y }}>
      <div className="bg-surface border border-outline/10 shadow-2xl rounded-lg py-1.5 w-48 backdrop-blur-xl">
        {/* Create Block */}
        <button onClick={() => { editor.commands.insertContentBlock(); closeMenu(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">check_box_outline_blank</span>
          Content Block
        </button>

        {/* Code Block */}
        <button onClick={() => { editor.chain().focus().toggleCodeBlock().run(); closeMenu(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">code</span>
          Code Block
        </button>

        {/* Callout */}
        <button onClick={() => { editor.commands.insertCalloutBlock('info'); closeMenu(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">call_to_action</span>
          Callout
        </button>

        {/* Toggle */}
        <button onClick={() => { editor.commands.insertToggleBlock(); closeMenu(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">unfold_more</span>
          Toggle
        </button>

        {/* Divider */}
        <button onClick={() => { editor.chain().focus().setHorizontalRule().run(); closeMenu(); }} className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-on-surface-variant">horizontal_rule</span>
          Divider
        </button>

        {/* Insert */}
        <div className="relative" onMouseEnter={() => setShowInsertSubmenu(true)} onMouseLeave={() => { setShowInsertSubmenu(false); setSearch(''); }}>
          <button className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface justify-between">
            <span className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">add</span>
              Insert
            </span>
            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">chevron_right</span>
          </button>

          {showInsertSubmenu && (
            <div className="absolute left-full top-0 ml-1 bg-surface border border-outline/10 shadow-2xl rounded-lg py-1.5 w-72 backdrop-blur-xl max-h-96 flex flex-col">
              <div className="px-3 pb-1 flex-shrink-0">
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-on-surface/5 border border-outline/10">
                  <span className="material-symbols-outlined text-[14px] text-on-surface-variant">search</span>
                  <input
                    ref={searchInputRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search pages, images, cards..."
                    className="bg-transparent outline-none text-sm text-on-surface w-full placeholder:text-on-surface-variant/50"
                  />
                  {search && <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-on-surface"><span className="material-symbols-outlined text-[14px]">close</span></button>}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 max-h-72">
                {filtered.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-on-surface-variant italic">No results</div>
                ) : (
                  filtered.map((item, i) => (
                    <button
                      key={`${item.type}-${i}`}
                      onClick={item.action}
                      className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 hover:bg-on-surface/10 transition-colors text-on-surface"
                    >
                      <span className={`material-symbols-outlined text-[16px] flex-shrink-0 ${item.iconColor || 'text-on-surface-variant'}`}>{item.icon}</span>
                      <span className="truncate">{item.label}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}