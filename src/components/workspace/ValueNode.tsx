import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from '@xyflow/react';

/* ── Compute contrast text color ── */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/* ── Custom handle style helper ── */
function handleStyle(
  isConnected: boolean,
  dotColor: string,
  size: number = 10,
): React.CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    backgroundColor: isConnected ? dotColor : 'rgba(255,255,255,0.15)',
    border: isConnected
      ? `2px solid ${dotColor}`
      : '2px solid rgba(255,255,255,0.3)',
    opacity: isConnected ? 1 : 0.35,
    transition: 'all 0.15s ease',
    boxShadow: isConnected ? `0 0 6px ${dotColor}80` : 'none',
  };
}

function handleEvents(e: React.MouseEvent, isConnected: boolean) {
  if (!isConnected) {
    (e.currentTarget as HTMLElement).style.opacity = '1';
    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.7)';
  }
}

const iconMap: Record<string, string> = {
  predefined: 'label',
  text: 'text_fields',
  number: 'numbers',
  date: 'calendar_today',
  attachment: 'attach_file',
  'page link': 'link',
  gallery: 'photo_library',
  url: 'public',
  email: 'alternate_email',
  boolean: 'toggle_on',
  file: 'insert_drive_file',
  image: 'image',
};

export const ValueNode = React.memo(function ValueNode({ id, data }: any) {
  const label = data.label || '';
  const icon = data.icon || iconMap[data.colType] || 'circle';
  const hasColor = data.backgroundColor && data.backgroundColor.startsWith('#');
  const bgStyle = hasColor
    ? { backgroundColor: data.backgroundColor + '25', borderColor: data.backgroundColor + '60', color: data.textColor || getContrastColor(data.backgroundColor) }
    : {};
  const dotColor = data.backgroundColor || '#60a5fa';

  const edges = useEdges();
  const isConnected = useMemo(() => {
    return edges.some(e => e.target === id);
  }, [edges, id]);
  const isRightConnected = useMemo(() => {
    return edges.some(e => e.source === id && e.sourceHandle === 'right');
  }, [edges, id]);
  const isBottomConnected = useMemo(() => {
    return edges.some(e => e.source === id && (!e.sourceHandle || e.sourceHandle === 'bottom'));
  }, [edges, id]);
  const isTopConnected = useMemo(() => {
    return edges.some(e => e.target === id && e.targetHandle === 'top');
  }, [edges, id]);

  const hideLeft = data.hideLeftHandle === true;
  const showTop = data.showTopHandle === true;
  const showRight = data.showRightHandle === true;
  return (
    <div
      className="px-3 py-2 shadow-md rounded-xl bg-surface border flex items-center gap-2 group min-w-[120px] relative"
      style={{
        borderColor: data.backgroundColor ? data.backgroundColor + '50' : 'rgba(255,255,255,0.15)',
        ...bgStyle,
      }}
    >
      {/* Top target handle — for chain connections (timeline blocks) */}
      {showTop && (
        <Handle
          type="target"
          position={Position.Top}
          id="top"
          className="!bg-transparent cursor-pointer"
          style={{
            ...handleStyle(isTopConnected, dotColor, 10),
            position: 'absolute',
            top: -5,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={(e) => handleEvents(e, isTopConnected)}
          onMouseLeave={(e) => {
            if (!isTopConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          }
        />
      )}

      {/* Left target handle — hidden for timeline blocks */}
      {!hideLeft && (
        <Handle
          type="target"
          position={Position.Left}
          className="!relative !transform-none !static cursor-pointer"
          style={handleStyle(isConnected, dotColor)}
          onMouseEnter={(e) => handleEvents(e, isConnected)}
          onMouseLeave={(e) => {
            if (!isConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          }
        />
      )}

      {data.imgUrl ? (
        <div className="w-7 h-7 rounded-md overflow-hidden bg-surface-variant flex-shrink-0 graph-node-img">
          <img src={data.imgUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-variant/50 flex-shrink-0 graph-node-icon">
          <span className="material-symbols-outlined text-sm">{icon}</span>
        </div>
      )}

      <span className="text-xs font-medium text-on-surface truncate">{label}</span>

      {data.subLabel && (
        <span className="text-[10px] text-on-surface-variant truncate ml-auto">{data.subLabel}</span>
      )}

      {/* Bottom source handle — inline static by default, absolute for timeline blocks */}
      {showTop ? (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!bg-transparent cursor-crosshair"
          style={{
            ...handleStyle(isBottomConnected, dotColor, 10),
            position: 'absolute',
            bottom: -5,
            left: '50%',
            transform: 'translateX(-50%)',
          }}
          onMouseEnter={(e) => handleEvents(e, isBottomConnected)}
          onMouseLeave={(e) => {
            if (!isBottomConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          }
        />
      ) : (
        <Handle
          type="source"
          position={Position.Bottom}
          id="bottom"
          className="!relative !transform-none !static cursor-crosshair"
          style={{
            ...handleStyle(isBottomConnected, dotColor, 8),
            marginLeft: 2,
          }}
          onMouseEnter={(e) => handleEvents(e, isBottomConnected)}
          onMouseLeave={(e) => {
            if (!isBottomConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          }
        />
      )}

      {showRight && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!relative !transform-none !static cursor-crosshair"
          style={{
            ...handleStyle(isRightConnected, dotColor, 10),
            marginLeft: 2,
          }}
          onMouseEnter={(e) => handleEvents(e, isRightConnected)}
          onMouseLeave={(e) => {
            if (!isRightConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }}
          }
        />
      )}
    </div>
  );
});