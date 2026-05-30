import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';

import { Editor } from '@tiptap/react';
import { FontColorControls } from './FontColorControls';
import { Tooltip } from '../Tooltip';
import { platformShortcut } from '../../stores/shortcutStore';

interface TextControlPanelProps {
  editor: Editor | null;
}

/** Dropdown that uses fixed positioning to avoid being clipped by overflow containers */
function FixedDropdown({ open, onClose, children, className = '', triggerRef }: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  triggerRef: React.RefObject<HTMLElement | null>;
}) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Compute position in useLayoutEffect so it's ready before paint (no flicker).
  // Uses a functional updater to bail out when coordinates haven't changed,
  // preventing the infinite re-render loop caused by creating a new object each time.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPos(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const newLeft = rect.left;
    const newTop = rect.bottom + 4;
    setPos(prev => {
      if (prev && prev.left === newLeft && prev.top === newTop) return prev;
      return { left: newLeft, top: newTop };
    });
  }, [open, triggerRef]);

  // Click-outside handler — bubble phase with trigger button exclusion
  // so clicking the toggle button doesn't close-then-reopen the dropdown.
  // Uses a ref for onClose to avoid re-attaching the listener on every render.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      // Don't close if clicking the trigger button
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, triggerRef]);

  if (!open) return null;

  return createPortal(
    <div
      ref={dropdownRef}
      className={`fixed z-[9999] bg-surface border border-outline/10 shadow-xl rounded-md py-1 ${className}`}
      style={pos ? { left: pos.left + 'px', top: pos.top + 'px' } : undefined}
    >
      {children}
    </div>,
    document.body
  );
}

// ─── Toolbar item definitions ───────────────────────────────────────────────
// Each section has a unique id and priority (lower = hidden first when shrinking)

interface ToolbarSection {
  id: string;
  priority: number;
  render: (editor: Editor) => React.ReactNode;
}

export function TextControlPanel({ editor }: TextControlPanelProps) {
  if (!editor) return null;

  const [showHighlight, setShowHighlight] = useState(false);
  const [showBulletTypes, setShowBulletTypes] = useState(false);
  const [showCalloutTypes, setShowCalloutTypes] = useState(false);
  const [showInsertBlocks, setShowInsertBlocks] = useState(false);
  const calloutBtnRef = useRef<HTMLButtonElement>(null);
  const bulletBtnRef = useRef<HTMLButtonElement>(null);
  const insertBtnRef = useRef<HTMLButtonElement>(null);
  const highlightBtnRef = useRef<HTMLButtonElement>(null);

  const highlightColors = [
    { name: 'Yellow', color: '#ffff00', textColor: '#000000' },
    { name: 'Green', color: '#00ff00', textColor: '#000000' },
    { name: 'Pink', color: '#ff00ff', textColor: '#ffffff' },
    { name: 'Blue', color: '#00ffff', textColor: '#000000' },
    { name: 'Orange', color: '#ff9900', textColor: '#000000' },
  ];

  // ─── Toolbar sections with priorities ──────────────────────────────────

  const sections: ToolbarSection[] = useMemo(() => [
    {
      // Text formatting (Bold, Italic)
      id: 'text-format',
      priority: 1,
      render: (ed) => (
        <div key="text-format" className="flex items-center gap-1">
          <Tooltip label="Bold" shortcut={platformShortcut('Ctrl+B')}>
            <button
              onClick={() => ed.chain().focus().toggleBold().run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('bold') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_bold</span>
            </button>
          </Tooltip>
          <Tooltip label="Italic" shortcut={platformShortcut('Ctrl+I')}>
            <button
              onClick={() => ed.chain().focus().toggleItalic().run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('italic') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_italic</span>
            </button>
          </Tooltip>
          <Tooltip label="Underline" shortcut={platformShortcut('Ctrl+U')}>
            <button
              onClick={() => ed.chain().focus().toggleUnderline().run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('underline') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_underlined</span>
            </button>
          </Tooltip>
          <Tooltip label="Strikethrough" shortcut={platformShortcut('Ctrl+Shift+X')}>
            <button
              onClick={() => ed.chain().focus().toggleStrike().run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('strike') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">strikethrough_s</span>
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      // Headings
      id: 'headings',
      priority: 2,
      render: (ed) => (
        <div key="headings" className="flex items-center gap-1">
          <Tooltip label="Heading 1" shortcut={platformShortcut('Ctrl+Alt+1')}>
            <button
              onClick={() => ed.chain().focus().toggleHeading({ level: 1 }).run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('heading', { level: 1 }) ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_h1</span>
            </button>
          </Tooltip>
          <Tooltip label="Heading 2" shortcut={platformShortcut('Ctrl+Alt+2')}>
            <button
              onClick={() => ed.chain().focus().toggleHeading({ level: 2 }).run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('heading', { level: 2 }) ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_h2</span>
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      // Bullet list + Task list
      id: 'lists',
      priority: 3,
      render: (ed) => (
        <div key="lists" className="flex items-center gap-1">
          <div className="relative">
            <button
              ref={bulletBtnRef}
              onClick={() => setShowBulletTypes(!showBulletTypes)}
              className={`p-1.5 rounded-md transition-colors flex items-center ${ed.isActive('bulletList') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">format_list_bulleted</span>
              <span className="material-symbols-outlined text-[14px]">arrow_drop_down</span>
            </button>
            <FixedDropdown open={showBulletTypes} onClose={() => setShowBulletTypes(false)} className="w-32" triggerRef={bulletBtnRef}>
              <button onClick={() => { ed.chain().focus().toggleBulletList().updateAttributes('bulletList', { listStyleType: 'disc' }).run(); setShowBulletTypes(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-on-surface/10">● Disc</button>
              <button onClick={() => { ed.chain().focus().toggleBulletList().updateAttributes('bulletList', { listStyleType: 'circle' }).run(); setShowBulletTypes(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-on-surface/10">○ Circle</button>
              <button onClick={() => { ed.chain().focus().toggleBulletList().updateAttributes('bulletList', { listStyleType: 'square' }).run(); setShowBulletTypes(false); }} className="w-full text-left px-3 py-1.5 text-sm hover:bg-on-surface/10">■ Square</button>
            </FixedDropdown>
          </div>
          <Tooltip label="Task List" shortcut={platformShortcut('Ctrl+Shift+9')}>
            <button
              onClick={() => ed.chain().focus().toggleTaskList().run()}
              className={`p-1.5 rounded-md transition-colors ${ed.isActive('taskList') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
            >
              <span className="material-symbols-outlined text-[18px]">checklist</span>
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      // Insert blocks (divider, toggle, code block)
      id: 'insert-blocks',
      priority: 4,
      render: (ed) => (
        <div key="insert-blocks" className="flex items-center gap-1">
          <div className="relative">
            <Tooltip label="Insert Blocks" shortcut={platformShortcut('Ctrl+Shift+/')}>
              <button
                ref={insertBtnRef}
                onClick={() => setShowInsertBlocks(!showInsertBlocks)}
                className={`p-1.5 rounded-md transition-colors flex items-center ${showInsertBlocks ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
              </button>
            </Tooltip>
            <FixedDropdown open={showInsertBlocks} onClose={() => setShowInsertBlocks(false)} className="w-44" triggerRef={insertBtnRef}>
              <button onClick={() => { ed.commands.insertContentBlock(); setShowInsertBlocks(false); }} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-on-surface/10">
                <span className="material-symbols-outlined text-[16px]">check_box_outline_blank</span> Content Block
              </button>
              <button onClick={() => { ed.chain().focus().setHorizontalRule().run(); setShowInsertBlocks(false); }} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-on-surface/10">
                <span className="material-symbols-outlined text-[16px]">horizontal_rule</span> Divider
              </button>
              <button onClick={() => { ed.commands.insertToggleBlock(); setShowInsertBlocks(false); }} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-on-surface/10">
                <span className="material-symbols-outlined text-[16px]">unfold_more</span> Toggle
              </button>
              <button onClick={() => { ed.chain().focus().toggleCodeBlock().run(); setShowInsertBlocks(false); }} className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-on-surface/10 ${ed.isActive('codeBlock') ? 'text-primary' : ''}`}>
                <span className="material-symbols-outlined text-[16px]">code</span> Code Block
              </button>
            </FixedDropdown>
          </div>
        </div>
      ),
    },
    {
      // Callout + Toggle + Divider + Code block
      id: 'blocks',
      priority: 5,
      render: (ed) => (
        <div key="blocks" className="flex items-center gap-1">
          <div className="relative">
            <Tooltip label="Callout" shortcut={platformShortcut('Ctrl+Shift+C')}>
              <button
                ref={calloutBtnRef}
                onClick={() => setShowCalloutTypes(!showCalloutTypes)}
                className={`p-1.5 rounded-md transition-colors flex items-center ${ed.isActive('calloutBlock') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[18px]">call_to_action</span>
              </button>
            </Tooltip>
            <FixedDropdown open={showCalloutTypes} onClose={() => setShowCalloutTypes(false)} className="w-36" triggerRef={calloutBtnRef}>
              {([
                { type: 'info', label: 'Info', icon: 'info', color: '#60a5fa' },
                { type: 'warning', label: 'Warning', icon: 'warning', color: '#eab308' },
                { type: 'error', label: 'Error', icon: 'error', color: '#ef4444' },
                { type: 'success', label: 'Success', icon: 'check_circle', color: '#22c55e' },
                { type: 'tip', label: 'Tip', icon: 'lightbulb', color: '#a855f7' },
              ] as const).map((ct) => (
                <button key={ct.type} onClick={() => { ed.commands.insertCalloutBlock(ct.type); setShowCalloutTypes(false); }} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 hover:bg-on-surface/10">
                  <span className="material-symbols-outlined text-[16px]" style={{ color: ct.color }}>{ct.icon}</span>
                  {ct.label}
                </button>
              ))}
            </FixedDropdown>
          </div>
          <Tooltip label="Toggle" shortcut={platformShortcut('Ctrl+Shift+T')}>
            <button onClick={() => ed.commands.insertToggleBlock()} className="p-1.5 rounded-md transition-colors text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface">
              <span className="material-symbols-outlined text-[18px]">unfold_more</span>
            </button>
          </Tooltip>
          <Tooltip label="Code Block">
            <button onClick={() => ed.chain().focus().toggleCodeBlock().run()} className={`p-1.5 rounded-md transition-colors ${ed.isActive('codeBlock') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}>
              <span className="material-symbols-outlined text-[18px]">code</span>
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      // Line spacing + Highlight
      id: 'spacing-highlight',
      priority: 6,
      render: (ed) => (
        <div key="spacing-highlight" className="flex items-center gap-1">
          <Tooltip label="Line Spacing">
            <select
              value={ed.getAttributes('paragraph').lineHeight || '1.5'}
              onChange={(e) => ed.commands.setLineSpacing(e.target.value)}
              className="rounded-md bg-surface border border-outline/10 text-sm text-on-surface p-0.5 w-16"
            >
              <option value="1.0">1.0</option>
              <option value="1.15">1.15</option>
              <option value="1.5">1.5</option>
              <option value="2.0">2.0</option>
            </select>
          </Tooltip>
          <div className="relative">
            <Tooltip label="Highlight" shortcut={platformShortcut('Ctrl+Shift+H')}>
              <button
                ref={highlightBtnRef}
                onClick={() => setShowHighlight(!showHighlight)}
                className={`p-1.5 rounded-md transition-colors flex items-center ${ed.isActive('highlight') ? 'bg-primary/20 text-primary' : 'text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface'}`}
              >
                <span className="material-symbols-outlined text-[18px]">format_ink_highlighter</span>
              </button>
            </Tooltip>
            <FixedDropdown open={showHighlight} onClose={() => setShowHighlight(false)} className="p-2 flex gap-1" triggerRef={highlightBtnRef}>
              {highlightColors.map((hc) => (
                <button key={hc.name} onClick={() => { ed.chain().focus().setHighlight({ color: hc.color }).setColor(hc.textColor).run(); setShowHighlight(false); }}
                  style={{ backgroundColor: hc.color }} className="w-5 h-5 rounded-full border border-outline/20" />
              ))}
              <button onClick={() => { ed.chain().focus().unsetHighlight().unsetColor().run(); setShowHighlight(false); }} className="w-5 h-5 rounded-full flex items-center justify-center border border-outline/20 hover:bg-on-surface/10 text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px]">format_color_reset</span>
              </button>
            </FixedDropdown>
          </div>
        </div>
      ),
    },
    {
      // Toggle Case
      id: 'toggle-case',
      priority: 7,
      render: (ed) => (
        <div key="toggle-case" className="flex items-center gap-1">
          <Tooltip label="Toggle Case" shortcut={platformShortcut('Ctrl+Shift+U')}>
            <button
              onClick={() => ed.commands.toggleCase()}
              className="p-1.5 rounded-md transition-colors text-on-surface-variant hover:bg-on-surface/10 hover:text-on-surface font-semibold text-sm"
            >
              Aa
            </button>
          </Tooltip>
        </div>
      ),
    },
    {
      // Font & color controls (font, size, color)
      id: 'font-controls',
      priority: 8,
      render: (ed) => (
        <div key="font-controls">
          <FontColorControls editor={ed} />
        </div>
      ),
    },
  ], [showBulletTypes, showInsertBlocks, showCalloutTypes, showHighlight]);

  // Sort sections by priority (lowest number = highest priority)
  const sortedSections = useMemo(() =>
    [...sections].sort((a, b) => a.priority - b.priority),
    [sections]
  );

  return (
    <div className="relative w-full max-w-full">
      <div
        className="flex items-center gap-2 mb-4 bg-surface/50 backdrop-blur-md border border-outline/10 p-2 rounded-xl w-fit max-w-full overflow-x-auto"
      >
        {sortedSections.map((section, idx) => (
          <div
            key={section.id}
            className="flex items-center gap-1 shrink-0"
          >
            {idx > 0 && (
              <div className="w-px h-5 bg-outline/10 mr-1 shrink-0" />
            )}
            {section.render(editor)}
          </div>
        ))}
      </div>
    </div>
  );
}
