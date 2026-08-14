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

const categoryColors: Record<string, string> = {
  rows: '#98cbff',
  columns: '#60a5fa',
  tasks: '#a78bfa',
  images: '#06b6d4',
  files: '#f59e0b',
  cards: '#a78bfa',
  tags: '#a855f7',
  links: '#98cbff',
  audio: '#06b6d4',
  video: '#a855f7',
  pages: '#60a5fa',
  timeline: '#f59e0b',
};

interface CategorySocket {
  id: string;
  label: string;
  count: number;
}

export const PageNode = React.memo(function PageNode({ id, data }: any) {
  const label = data.label || 'Untitled';
  const icon = data.icon || 'description';
  const sockets: CategorySocket[] = data.sockets || [];
  const hasBg = data.backgroundColor && data.backgroundColor.startsWith('#');
  const bgColor = data.backgroundColor || '#98cbff';

  const edges = useEdges();
  const connectedSockets = useMemo(() => {
    const set = new Set<string>();
    edges.forEach(e => {
      if (e.target === id && e.targetHandle) set.add(e.targetHandle);
    });
    return set;
  }, [edges, id]);

  return (
    <div className="shadow-md rounded-xl bg-surface border border-outline/20 overflow-hidden min-w-[140px] relative">
      {/* Sphere connection handle — small circle on top connecting to the project sphere */}
      <Handle
        type="target"
        position={Position.Top}
        id="sphere-target"
        className="!bg-transparent"
        style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          position: 'absolute',
          top: -4,
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: bgColor + '80',
          border: `2px solid ${bgColor}`,
          zIndex: 10,
          cursor: 'pointer',
          transition: 'all 0.15s ease',
          opacity: 0.6,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
          (e.currentTarget as HTMLElement).style.transform = 'translateX(-50%) scale(1.3)';
          (e.currentTarget as HTMLElement).style.boxShadow = `0 0 8px ${bgColor}80`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '0.6';
          (e.currentTarget as HTMLElement).style.transform = 'translateX(-50%)';
          (e.currentTarget as HTMLElement).style.boxShadow = 'none';
        }}
      />

      {/* Title bar with left/right circular handles */}
      <div
        className="px-3 py-2.5 flex items-center gap-2 border-b border-outline/15 relative"
        style={hasBg ? { backgroundColor: bgColor + '25', borderBottomColor: bgColor + '40' } : {}}
      >
        <Handle
          type="target"
          position={Position.Left}
          className="custom-handle target-handle opacity-0 hover:opacity-100"
        />

        <div
          className="flex items-center justify-center p-1.5 rounded-lg flex-shrink-0 ml-1 graph-node-icon"
          style={hasBg ? { backgroundColor: bgColor + '30', color: getContrastColor(bgColor) } : { color: 'var(--color-primary, #98cbff)' }}
        >
          <span className="material-symbols-outlined text-xl">{icon}</span>
        </div>

        <span className="text-sm font-semibold text-on-surface truncate flex-1 min-w-0">{label}</span>

        <Handle
          type="source"
          position={Position.Right}
          className="custom-handle source-handle opacity-0 hover:opacity-100"
        />
      </div>

      {/* Category sockets below the title */}
      {sockets.length > 0 && (
        <div className="divide-y divide-outline/5">
          {sockets.map((sock) => {
            const handleId = `cat-${sock.id}`;
            const isConnected = connectedSockets.has(handleId);
            const dotColor = categoryColors[sock.id] || '#98cbff';

            return (
              <div
                key={sock.id}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-surface-variant/20 transition-colors group"
              >
                <Handle
                  type="target"
                  position={Position.Left}
                  id={handleId}
                  className="!relative !transform-none !static cursor-pointer"
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    flexShrink: 0,
                    backgroundColor: isConnected ? dotColor : 'rgba(255,255,255,0.12)',
                    border: isConnected
                      ? `2px solid ${dotColor}`
                      : '2px solid rgba(255,255,255,0.25)',
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
                      (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
                    }
                  }}
                />

                <span className="text-[11px] text-on-surface-variant truncate flex-1">{sock.label}</span>

                <span
                  className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor + '25', color: dotColor }}
                >
                  {sock.count}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom source handle — drag connections from this page downward */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="custom-handle source-handle opacity-0 hover:opacity-100"
      />
    </div>
  );
});