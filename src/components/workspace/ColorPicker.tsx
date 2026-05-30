import { useState, useEffect, useRef, useCallback } from 'react';
import { Tooltip } from '../Tooltip';

/* ─── colour utilities ─── */
function hexToHsv(hex: string): { h: number; s: number; v: number } {
  let r = 0, g = 0, b = 0;
  const cleaned = hex.replace('#', '');
  if (cleaned.length === 3) {
    r = parseInt(cleaned[0] + cleaned[0], 16);
    g = parseInt(cleaned[1] + cleaned[1], 16);
    b = parseInt(cleaned[2] + cleaned[2], 16);
  } else if (cleaned.length >= 6) {
    r = parseInt(cleaned.substring(0, 2), 16);
    g = parseInt(cleaned.substring(2, 4), 16);
    b = parseInt(cleaned.substring(4, 6), 16);
  }
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0, v = max;
  const d = max - min;
  s = max === 0 ? 0 : d / max;
  if (max !== min) {
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), v: Math.round(v * 100) };
}

function hsvToHex(h: number, s: number, v: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  v = Math.max(0, Math.min(100, v));
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v / 100 * (1 - s / 100 * Math.max(0, Math.min(k, 4 - k, 1)));
  };
  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const b = Math.round(f(1) * 255);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ─── presets ─── */
const PRESETS = [
  '#ff0000', '#ff8000', '#ffff00', '#80ff00', '#00ff00', '#00ff80',
  '#00ffff', '#0080ff', '#0000ff', '#8000ff', '#ff00ff', '#ff0080',
  '#800000', '#804000', '#808000', '#408000', '#008000', '#008040',
  '#008080', '#004080', '#000080', '#400080', '#800080', '#800040',
  '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc',
  '#d9d9d9', '#efefef', '#ffffff',
];

const RECENT_KEY = 'notie_recent_colors';
function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveRecent(colors: string[]) {
  localStorage.setItem(RECENT_KEY, JSON.stringify(colors.slice(0, 9)));
}

/* ─── click-outside ─── */
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
   COLOR PICKER — dropdown panel
   ═══════════════════════════════════════════════ */
interface ColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  onClose?: () => void;
}

export function ColorPicker({ value, onChange, onClose }: ColorPickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [hsv, setHsv] = useState(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const [recent, setRecent] = useState<string[]>(() => loadRecent());

  // SV square drag state
  const svDragging = useRef(false);
  const svRectRef = useRef<DOMRect | null>(null);

  // Hue slider drag state
  const hueDragging = useRef(false);
  const hueRectRef = useRef<DOMRect | null>(null);

  useClickOutside(panelRef, () => onClose?.());

  // Sync external value
  useEffect(() => {
    setHsv(hexToHsv(value));
    setHexInput(value);
  }, [value]);

  /* ── SV square ── */
  const updateSV = useCallback((clientX: number, clientY: number) => {
    if (!svRectRef.current) return;
    const rect = svRectRef.current;
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    const s = Math.round(x * 100);
    const v = Math.round((1 - y) * 100);
    setHsv(prev => {
      const next = { ...prev, s, v };
      const hex = hsvToHex(next.h, next.s, next.v);
      setHexInput(hex);
      return next;
    });
  }, []);

  const onSVMouseDown = (e: React.MouseEvent) => {
    svDragging.current = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    svRectRef.current = rect;
    updateSV(e.clientX, e.clientY);
    e.preventDefault();
  };

  /* ── Hue slider ── */
  const updateHue = useCallback((clientX: number) => {
    if (!hueRectRef.current) return;
    const rect = hueRectRef.current;
    let x = (clientX - rect.left) / rect.width;
    x = Math.max(0, Math.min(1, x));
    const h = Math.round(x * 360);
    setHsv(prev => {
      const next = { ...prev, h };
      const hex = hsvToHex(next.h, next.s, next.v);
      setHexInput(hex);
      return next;
    });
  }, []);

  const onHueMouseDown = (e: React.MouseEvent) => {
    hueDragging.current = true;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    hueRectRef.current = rect;
    updateHue(e.clientX);
    e.preventDefault();
  };

  /* ── Global mouse tracking ── */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (svDragging.current) updateSV(e.clientX, e.clientY);
      if (hueDragging.current) updateHue(e.clientX);
    };
    const onUp = () => {
      if (svDragging.current || hueDragging.current) {
        // Save to recent on drag end
        const hex = hsvToHex(hsv.h, hsv.s, hsv.v);
        const newRecent = [hex, ...recent.filter(c => c !== hex)];
        setRecent(newRecent);
        saveRecent(newRecent);
        onChange(hex);
      }
      svDragging.current = false;
      hueDragging.current = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [hsv, recent, updateSV, updateHue, onChange]);

  // Commit on any change (for preset clicks and hex input)
  const commitColor = (hex: string) => {
    const normalized = hex.startsWith('#') ? hex : '#' + hex;
    const newRecent = [normalized, ...recent.filter(c => c !== normalized)];
    setRecent(newRecent);
    saveRecent(newRecent);
    onChange(normalized);
  };

  const currentHex = hsvToHex(hsv.h, hsv.s, hsv.v);

  return (
    <div
      ref={panelRef}
      className="w-60 bg-surface border border-outline/20 rounded-xl shadow-2xl p-3 z-50 animate-in"
      onMouseDown={e => e.stopPropagation()}
      style={{ animation: 'fadeScaleIn 0.15s ease-out' }}
    >
      {/* ── SV square ── */}
      <div
        className="relative w-full h-44 rounded-lg cursor-crosshair mb-2.5 overflow-hidden"
        style={{
          background: `hsl(${hsv.h}, 100%, 50%)`,
        }}
        onMouseDown={onSVMouseDown}
      >
        {/* White → transparent (left → right) */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to right, white, transparent)' }}
        />
        {/* Transparent → black (bottom → top) */}
        <div className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(to top, black, transparent)' }}
        />
        {/* Picker handle */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: `${hsv.s}%`,
            top: `${100 - hsv.v}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3), 0 0 6px rgba(0,0,0,0.4)',
          }}
        />
      </div>

      {/* ── Hue slider ── */}
      <div
        className="relative w-full h-5 rounded-full cursor-pointer mb-2.5"
        style={{
          background: 'linear-gradient(to right, ' +
            'hsl(0,100%,50%), hsl(60,100%,50%), hsl(120,100%,50%), ' +
            'hsl(180,100%,50%), hsl(240,100%,50%), hsl(300,100%,50%), hsl(360,100%,50%)' +
          ')',
        }}
        onMouseDown={onHueMouseDown}
      >
        <div
          className="absolute top-1/2 w-4 h-4 rounded-full border-2 border-white shadow-lg pointer-events-none"
          style={{
            left: `${(hsv.h / 360) * 100}%`,
            transform: 'translate(-50%, -50%)',
            boxShadow: '0 0 0 1px rgba(0,0,0,0.3)',
          }}
        />
      </div>

      {/* ── Preview + hex input ── */}
      <div className="flex items-center gap-2 mb-2.5">
        <div
          className="w-8 h-8 rounded-lg shrink-0 border border-outline/20"
          style={{ backgroundColor: currentHex }}
        />
        <div className="relative flex-1">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-mono">#</span>
          <input
            type="text"
            value={hexInput.startsWith('#') ? hexInput.slice(1).toUpperCase() : hexInput.toUpperCase()}
            onChange={e => {
              const raw = e.target.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
              setHexInput('#' + raw);
              if (raw.length === 6) {
                const hex = '#' + raw;
                setHsv(hexToHsv(hex));
                commitColor(hex);
              }
            }}
            className="w-full pl-6 pr-2 py-1.5 bg-background border border-outline/20 rounded-lg text-xs font-mono text-on-surface focus:outline-none focus:border-primary/50 transition-colors"
            placeholder="FFFFFF"
          />
        </div>
        <Tooltip label="Close" position="top">
        <button
          onClick={() => onClose?.()}
          className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-on-surface/10 text-on-surface-variant hover:text-on-surface transition-colors shrink-0"
        >
          <span className="material-symbols-outlined text-[14px]">close</span>
        </button>
        </Tooltip>
      </div>

      {/* ── Recent colours ── */}
      {recent.length > 0 && (
        <div className="mb-2">
          <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wider mb-1.5">Recent</div>
          <div className="flex flex-wrap gap-1">
            {recent.map(col => (
              <button
                key={col}
                onClick={() => {
                  setHsv(hexToHsv(col));
                  setHexInput(col);
                  commitColor(col);
                }}
                className="w-5 h-5 rounded-full border border-outline/20 hover:scale-125 transition-transform shrink-0"
                style={{ backgroundColor: col }}
                title={col}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Presets ── */}
      <div>
        <div className="text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-wider mb-1.5">Palette</div>
        <div className="grid grid-cols-11 gap-1">
          {PRESETS.map(col => (
            <button
              key={col}
              onClick={() => {
                setHsv(hexToHsv(col));
                setHexInput(col);
                commitColor(col);
              }}
              className={`w-4 h-4 rounded-full border transition-all shrink-0 ${
                currentHex.toLowerCase() === col.toLowerCase()
                  ? 'border-primary scale-125 ring-1 ring-primary/40'
                  : 'border-outline/20 hover:scale-125'
              }`}
              style={{ backgroundColor: col }}
              title={col}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
