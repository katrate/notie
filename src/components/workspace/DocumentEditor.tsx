import { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Color, FontSize, FontFamily, TextStyle } from '@tiptap/extension-text-style';
import { Placeholder } from '@tiptap/extension-placeholder';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Underline } from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { CaseConverter } from './extensions/CaseConverter';
import { LineSpacing } from './extensions/LineSpacing';
import { CustomBulletList } from './extensions/CustomBulletList';
import { ContentBlock } from './extensions/ContentBlock';
import { PageLinkBlock } from './extensions/PageLinkBlock';
import { GalleryImageBlock } from './extensions/GalleryImageBlock';
import { BoardCardBlock } from './extensions/BoardCardBlock';
import { CalloutBlock } from './extensions/CalloutBlock';
import { ToggleBlock, ToggleSummary } from './extensions/ToggleBlock';
import { EditorContextMenu } from './EditorContextMenu';
import { useProjectStore } from '../../stores/projectStore';
import { useThemeStore } from '../../stores/themeStore';

const lowlight = createLowlight(common);

interface DocumentEditorProps {
  pageId: string
  projectId?: string
  initialContent?: any
  onEditorReady?: (editor: any) => void
}

export function DocumentEditor({ pageId, projectId, initialContent, onEditorReady }: DocumentEditorProps) {
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { updatePageContent, setActivePage, updatePage } = useProjectStore()
  const { theme } = useThemeStore()

  const proseClass = theme === 'dark'
    ? 'prose prose-invert prose-p:text-body-lg prose-headings:text-headline-md max-w-none focus:outline-none min-h-[400px]'
    : 'prose prose-p:text-body-lg prose-headings:text-headline-md max-w-none focus:outline-none min-h-[400px]'

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false, // disable default bulletList to use custom one
        codeBlock: false,  // disable built-in codeBlock to use CodeBlockLowlight
      }),
      TextStyle,
      Color,
      FontSize,
      FontFamily,
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Underline,
      Highlight.configure({
        multicolor: true,
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      CaseConverter,
      LineSpacing,
      CustomBulletList,
      ContentBlock,
      CalloutBlock,
      ToggleBlock,
      ToggleSummary,
      PageLinkBlock,
      GalleryImageBlock,
      BoardCardBlock,
      Placeholder.configure({
        placeholder: 'Press "/" for commands, or start typing...',
      }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: proseClass,
      },
    },
    onUpdate: ({ editor }) => {
      const json = editor.getJSON()
      
      // Debounce saving to Supabase
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      
      saveTimeoutRef.current = setTimeout(() => {
        updatePageContent(pageId, json)
      }, 1000)
    }
  })

  useEffect(() => {
    if (onEditorReady) {
      onEditorReady(editor);
    }
    return () => {
      if (onEditorReady) onEditorReady(null);
    }
  }, [editor, onEditorReady]);

  // Update editor content if page changes
  useEffect(() => {
    if (!editor) return;
    const stringifiedInitial = JSON.stringify(initialContent);
    const stringifiedCurrent = JSON.stringify(editor.getJSON());
    if (stringifiedInitial === stringifiedCurrent) return;
    try {
      editor.commands.setContent(initialContent || '')
    } catch {
      editor.commands.setContent('')
    }
  }, [pageId, editor, initialContent])

  // Sync editor styling when theme changes
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    dom.classList.toggle('prose-invert', theme === 'dark');
    dom.style.caretColor = theme === 'dark' ? '#e5e2e1' : '#1c1b1b';
  }, [theme, editor])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Handle clicks on page link blocks (navigate) and close buttons (remove)
  useEffect(() => {
    if (!editor) return;
    const handleClick = (e: MouseEvent) => {
      // Get fresh pages from store to avoid stale closures
      const freshPages = useProjectStore.getState().pages;
      const target = e.target as HTMLElement;
      // Check if close button was clicked
      const closeBtn = target.closest('[data-remove-link], [data-remove-gallery-image], [data-remove-board-card]') as HTMLElement;
      if (closeBtn) {
        e.preventDefault();
        e.stopPropagation();
        // Gallery image block removal
        const galleryBlock = closeBtn.closest('[data-gallery-image-block]') as HTMLElement;
        if (galleryBlock) {
          const view = editor.view;
          const pos = view.posAtDOM(galleryBlock, 0);
          if (pos !== null && pos !== undefined) {
            const node = view.state.doc.nodeAt(pos);
            if (node && node.type.name === 'galleryImageBlock') {
              const tr = view.state.tr.delete(pos, pos + node.nodeSize);
              view.dispatch(tr);
            }
          }
          return;
        }
        // Board card block removal
        const boardBlock = closeBtn.closest('[data-board-card-block]') as HTMLElement;
        if (boardBlock) {
          const view = editor.view;
          const pos = view.posAtDOM(boardBlock, 0);
          if (pos !== null && pos !== undefined) {
            const node = view.state.doc.nodeAt(pos);
            if (node && node.type.name === 'boardCardBlock') {
              const tr = view.state.tr.delete(pos, pos + node.nodeSize);
              view.dispatch(tr);
            }
          }
          return;
        }
        const linkBlock = closeBtn.closest('[data-page-link-block]') as HTMLElement;
        if (linkBlock) {
          const linkedPageId = linkBlock.getAttribute('data-page-id');
          // If the linked page was intentionally parented via a link action, unparent it
          if (linkedPageId) {
            const linkedPage = freshPages.find(p => p.id === linkedPageId);
            if (linkedPage && linkedPage.metadata?.parentedViaLink && linkedPage.metadata?.parentId === pageId) {
              const { parentId: _, parentedViaLink: __, ...restMetadata } = linkedPage.metadata;
              updatePage(linkedPageId, { metadata: restMetadata });
            }
          }
          // Delete the link block node from editor
          const view = editor.view;
          const pos = view.posAtDOM(linkBlock, 0);
          if (pos !== null && pos !== undefined) {
            const node = view.state.doc.nodeAt(pos);
            if (node && node.type.name === 'pageLinkBlock') {
              const tr = view.state.tr.delete(pos, pos + node.nodeSize);
              view.dispatch(tr);
            }
          }
        }
        return;
      }
      // Navigate on link block click
      const linkBlock = target.closest('[data-page-link-block]') as HTMLElement;
      if (linkBlock) {
        e.preventDefault();
        const pageIdAttr = linkBlock.getAttribute('data-page-id');
        if (pageIdAttr) {
          setActivePage(pageIdAttr);
        }
        return;
      }

      // Toggle block: clicking the summary toggles open/close
      const toggleSummary = (target as HTMLElement).closest('summary[data-toggle-summary]') as HTMLElement;
      if (toggleSummary) {
        e.preventDefault();
        e.stopPropagation();
        const details = toggleSummary.closest('details[data-toggle-block]');
        if (details) {
          const isOpen = details.hasAttribute('open');
          if (isOpen) {
            details.removeAttribute('open');
          } else {
            details.setAttribute('open', '');
          }
        }
        return;
      }
    };
    // Use capture phase so this runs BEFORE ProseMirror's click handler
    editor.view.dom.addEventListener('click', handleClick, { capture: true });
    return () => {
      editor.view.dom.removeEventListener('click', handleClick, { capture: true });
    };
  }, [editor, setActivePage, pageId, updatePage]);

  return (
    <div className="w-full relative group">
      <EditorContent editor={editor} />
      {editor && projectId && (
        <>
          <EditorContextMenu
            editor={editor}
            activePageId={pageId}
            projectId={projectId}
          />

        </>
      )}
      <div className="absolute -top-6 right-0 opacity-0 group-hover:opacity-100 transition-opacity text-label-sm text-on-surface-variant flex items-center gap-1 z-10 bg-background/50 backdrop-blur-sm px-2 rounded">
        <span className="material-symbols-outlined text-[14px]">cloud_sync</span>
        Auto-saving
      </div>
    </div>
  )
}
