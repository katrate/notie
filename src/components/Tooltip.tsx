import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface TooltipProps {
  /** Main tooltip text */
  label: string;
  /** Optional keyboard shortcut displayed as a badge */
  shortcut?: string;
  /** Tooltip position relative to the child element */
  position?: 'top' | 'bottom' | 'left' | 'right';
  children: React.ReactNode;
}

export function Tooltip({ label, shortcut, position = 'bottom', children }: TooltipProps) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  const showTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const gap = 6;
      if (position === 'left') {
        setPos({
          top: rect.top + rect.height / 2,
          left: rect.left - gap,
        });
      } else if (position === 'right') {
        setPos({
          top: rect.top + rect.height / 2,
          left: rect.right + gap,
        });
      } else {
        setPos({
          top: position === 'bottom' ? rect.bottom + gap : rect.top - gap,
          left: rect.left + rect.width / 2,
        });
      }
      setShow(true);
    }, 600);
  }, [position]);

  const hideTooltip = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  // Determine the correct transform based on position
  const getTransform = () => {
    switch (position) {
      case 'left':
        return 'translateX(-100%) translateY(-50%)'; // right edge aligns with pos.left, vertically centered
      case 'right':
        return 'translateY(-50%)'; // left edge aligns with pos.left, vertically centered
      default:
        return 'translateX(-50%)'; // centered horizontally on pos.left
    }
  };

  // Arrow rotation: the arrow is a square with border-left and border-top,
  // forming a corner. rotate-45 points UP, rotate-135 points RIGHT,
  // rotate-225 (-135) points DOWN, rotate-315 (-45) points LEFT.
  const getArrowRotation = () => {
    switch (position) {
      case 'top':    return 'rotate-[-135deg]'; // arrow points DOWN toward tooltip body
      case 'left':   return 'rotate-135';        // arrow points RIGHT toward element
      case 'right':  return 'rotate-[-45deg]';   // arrow points LEFT toward element
      default:       return 'rotate-45';          // arrow points UP toward element (bottom position)
    }
  };

  // Arrow placement relative to the tooltip body
  const getArrowStyle = () => {
    switch (position) {
      case 'left':
        return { left: 'calc(100% - 4px)', top: '50%', transform: 'translateY(-50%)' };
      case 'right':
        return { left: -4, top: '50%', transform: 'translateY(-50%)' };
      case 'top':
        return { left: '50%', bottom: -4, transform: 'translateX(-50%)' };
      default: // bottom
        return { left: '50%', top: -4, transform: 'translateX(-50%)' };
    }
  };

  return (
    <div
      ref={ref}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      className="inline-flex"
    >
      {children}

      {show && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top,
            left: pos.left,
            transform: getTransform(),
            zIndex: 99999,
            pointerEvents: 'none',
          }}
          className={`
            px-2.5 py-1.5
            bg-black/85 backdrop-blur-xl
            border border-white/10
            rounded-lg shadow-2xl
            whitespace-nowrap
            text-xs text-white/90
            animate-in fade-in zoom-in-95
            duration-150
          `}
        >
          {label}
          {shortcut && (
            <span className="ml-2 px-1.5 py-0.5 rounded bg-white/15 text-white/60 text-[10px] font-mono">
              {shortcut}
            </span>
          )}
          {/* Arrow */}
          <div
            style={getArrowStyle()}
            className={`w-2 h-2 bg-black/85 border-l border-t border-white/10 ${getArrowRotation()}`}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
