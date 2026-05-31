import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from '@xyflow/react';

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
    ? { backgroundColor: data.backgroundColor + '25', borderColor: data.backgroundColor + '60', color: data.textColor || '#fff' }
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
    return edges.some(e => e.source === id && !e.sourceHandle);
  }, [edges, id]);

  return (
    <div
      className="px-3 py-2 shadow-md rounded-xl bg-surface border flex items-center gap-2 group min-w-[120px]"
      style={{
        borderColor: data.backgroundColor ? data.backgroundColor + '50' : 'rgba(255,255,255,0.15)',
        ...bgStyle,
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!relative !transform-none !static cursor-pointer"
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isConnected ? dotColor : 'rgba(255,255,255,0.15)',
          border: isConnected
            ? `2px solid ${dotColor}`
            : '2px solid rgba(255,255,255,0.3)',
          opacity: isConnected ? 1 : 0.35,
          transition: 'all 0.15s ease',
          boxShadow: isConnected ? `0 0 6px ${dotColor}80` : 'none',
        }}
        onMouseEnter={(e) => {
          if (!isConnected) {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.7)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isConnected) {
            (e.currentTarget as HTMLElement).style.opacity = '0.35';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
          }
        }}
      />

      {data.imgUrl ? (
        <div className="w-7 h-7 rounded-md overflow-hidden bg-surface-variant flex-shrink-0">
          <img src={data.imgUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className="w-6 h-6 flex items-center justify-center rounded-md bg-surface-variant/50 flex-shrink-0">
          <span className="material-symbols-outlined text-sm">{icon}</span>
        </div>
      )}

      <span className="text-xs font-medium text-on-surface truncate">{label}</span>

      {data.subLabel && (
        <span className="text-[10px] text-on-surface-variant truncate ml-auto">{data.subLabel}</span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!relative !transform-none !static cursor-crosshair"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: isBottomConnected ? dotColor : 'rgba(255,255,255,0.15)',
          border: isBottomConnected
            ? `2px solid ${dotColor}`
            : '2px solid rgba(255,255,255,0.3)',
          opacity: isBottomConnected ? 1 : 0.35,
          transition: 'all 0.15s ease',
          boxShadow: isBottomConnected ? `0 0 6px ${dotColor}80` : 'none',
          marginLeft: 2,
        }}
        onMouseEnter={(e) => {
          if (!isBottomConnected) {
            (e.currentTarget as HTMLElement).style.opacity = '1';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.7)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isBottomConnected) {
            (e.currentTarget as HTMLElement).style.opacity = '0.35';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
          }
        }}
      />

      {data.showRightHandle && (
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="!relative !transform-none !static cursor-crosshair"
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            flexShrink: 0,
            backgroundColor: isRightConnected ? dotColor : 'rgba(255,255,255,0.15)',
            border: isRightConnected
              ? `2px solid ${dotColor}`
              : '2px solid rgba(255,255,255,0.3)',
            opacity: isRightConnected ? 1 : 0.35,
            transition: 'all 0.15s ease',
            boxShadow: isRightConnected ? `0 0 6px ${dotColor}80` : 'none',
            marginLeft: 2,
          }}
          onMouseEnter={(e) => {
            if (!isRightConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '1';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.7)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isRightConnected) {
              (e.currentTarget as HTMLElement).style.opacity = '0.35';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)';
            }
          }}
        />
      )}
    </div>
  );
});