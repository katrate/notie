import React, { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Editor } from '@tiptap/react';
import { ColorPicker } from './ColorPicker';
import { Tooltip } from '../Tooltip';

// 50 common MS Word fonts (subset for brevity – you can extend as needed)
const MS_WORD_FONTS = [
  'Arial', 'Calibri', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel',
  'Courier New', 'Georgia', 'Helvetica', 'Impact', 'Lucida Console', 'Lucida Sans Unicode',
  'Microsoft Sans Serif', 'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
  'Trebuchet MS', 'Verdana', 'Arial Black', 'Baskerville', 'Bodoni MT', 'Book Antiqua',
  'Bradley Hand ITC', 'Britannic', 'Century Gothic', 'Ebrima', 'Franklin Gothic Medium',
  'Garamond', 'Goudy Old Style', 'Harlow Solid Italic', 'Haettenschweiler', 'Ink Free',
  'Javanese Text', 'Kristen ITC', 'Leelawadee UI', 'Lucida Bright', 'Magneto', 'Microsoft YaHei',
  'Mongolian Baiti', 'MS Gothic', 'MS Mincho', 'MV Boli', 'Niagara Eng', 'Nirmala UI',
  'Palace Script MT', 'Papyrus', 'Perpetua', 'Rockwell', 'Sitka', 'Sylfaen', 'Symbol',
  'Tempus Sans ITC', 'Vijaya',
  'Wingdings', 'Yu Gothic',
];

interface FontColorControlsProps {
  editor: Editor | null;
}

export function FontColorControls({ editor }: FontColorControlsProps) {
  const [font, setFont] = useState('Arial');
  const [size, setSize] = useState('14');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [color, setColor] = useState('#000000');
  const [pickerOrigin, setPickerOrigin] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const closePicker = useCallback(() => {
    setShowColorPicker(false);
    setPickerOrigin(null);
  }, []);

  const togglePicker = () => {
    if (showColorPicker) {
      closePicker();
    } else {
      if (buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        setPickerOrigin({ top: rect.bottom + 4, left: rect.left });
      }
      setShowColorPicker(true);
    }
  };

  const applyFont = (fontFamily: string) => {
    if (!editor) return;
    editor.chain().focus().setFontFamily(fontFamily).run();
  };

  const applySize = (sz: string) => {
    if (!editor) return;
    editor.chain().focus().setFontSize(`${sz}px`).run();
  };

  const applyColor = (col: string) => {
    if (!editor) return;
    editor.chain().focus().setColor(col).run();
  };

  const onFontChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const f = e.target.value;
    setFont(f);
    applyFont(f);
  };

  const onSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = e.target.value;
    setSize(s);
    applySize(s);
  };

  const onColorSelect = (col: string) => {
    setColor(col);
    applyColor(col);
  };

  return (
    <div className="flex items-center gap-2">
      {/* Font selector */}
      <select
        value={font}
        onChange={onFontChange}
        className="rounded-md bg-surface border border-outline/10 text-sm text-on-surface p-0.5 w-32 truncate"
      >
        {MS_WORD_FONTS.map(f => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      {/* Font size selector */}
      <select
        value={size}
        onChange={onSizeChange}
        className="rounded-md bg-surface border border-outline/10 text-sm text-on-surface p-0.5 w-16"
      >
        {['10', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '72'].map(sz => (
          <option key={sz} value={sz}>{sz}px</option>
        ))}
      </select>

      {/* Colour picker trigger */}
      <Tooltip label="Colour palette">
        <button
          ref={buttonRef}
          onClick={togglePicker}
          className="flex items-center gap-1.5 p-1.5 rounded-md bg-surface border border-outline/10 hover:bg-on-surface/10 transition-colors group"
        >
          <span className="material-symbols-outlined text-[18px]">palette</span>
          <span
            className="w-3.5 h-3.5 rounded-sm border border-outline/20 group-hover:scale-110 transition-transform"
            style={{ backgroundColor: color }}
          />
        </button>
      </Tooltip>

      {/* Portaled Colour picker */}
      {showColorPicker && pickerOrigin && createPortal(
        <>
          {/* Backdrop to capture outside clicks */}
          <div
            className="fixed inset-0 z-[99998]"
            onClick={closePicker}
          />
          {/* Picker positioned below the button */}
          <div
            className="fixed z-[99999]"
            style={{ top: pickerOrigin.top, left: pickerOrigin.left }}
            onMouseDown={e => e.stopPropagation()}
          >
            <ColorPicker
              value={color}
              onChange={col => onColorSelect(col)}
              onClose={closePicker}
            />
          </div>
        </>,
        document.body
      )}
    </div>
  );
}
