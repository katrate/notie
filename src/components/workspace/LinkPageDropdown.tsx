import { useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { Editor } from '@tiptap/react';
import { Tooltip } from '../Tooltip'

interface LinkPageDropdownProps {
  editor: Editor | null;
  activePageId: string;
  projectId: string;
}

const PAGE_TYPES = [
  { type: 'text', label: 'Text', icon: 'article' },
  { type: 'table', label: 'Table', icon: 'grid_on' },
  { type: 'board', label: 'Board', icon: 'dashboard' },
  { type: 'chart', label: 'Chart', icon: 'bar_chart' },
  { type: 'gallery', label: 'Gallery', icon: 'photo_library' },
  { type: 'folder', label: 'Folder', icon: 'folder' },
  { type: 'checklist', label: 'Checklist', icon: 'checklist' },
].filter(pt => pt.type !== 'dashboard');

export function LinkPageDropdown({ editor, activePageId, projectId }: LinkPageDropdownProps) {
  const { createPage, fetchPages, setPendingGraphLink } = useProjectStore();
  const [open, setOpen] = useState(false);

  const handleCreateAndLink = async (pt: typeof PAGE_TYPES[0]) => {
    setOpen(false);
    const newPageTitle = `Untitled ${pt.label}`;
    const metadata = activePageId ? { parentId: activePageId, parentedViaLink: true } : {};
    const newPage = await createPage(projectId, newPageTitle, pt.type, metadata, pt.icon);
    await fetchPages(projectId);
    if (editor && newPage) {
      (editor.commands as any).insertPageLink({
        pageId: newPage.id,
        pageTitle: newPage.title,
        pageIcon: newPage.icon || pt.icon,
      });
    }
    if (newPage) {
      setPendingGraphLink({
        sourcePageId: activePageId,
        targetPageId: newPage.id,
      });
    }
  };

  return (
    <div className="relative ml-1">
      <Tooltip label="Create child page" position="top">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-md text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface transition-colors"
      >
        <span className="material-symbols-outlined text-[18px]">add</span>
      </button>
      </Tooltip>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-64 bg-surface border border-outline/10 shadow-xl rounded-lg py-2 z-50">
          <div className="px-3 py-1 text-xs font-semibold text-on-surface-variant uppercase tracking-wider">
            New Page
          </div>
          {PAGE_TYPES.map(pt => (
            <button
              key={pt.type}
              onClick={() => handleCreateAndLink(pt)}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-on-surface hover:bg-on-surface/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[16px] text-on-surface-variant">{pt.icon}</span>
              {pt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
