import React, { useMemo } from 'react';
import { Handle, Position, useEdges } from '@xyflow/react';

const TEXT_TYPES = new Set(['text', 'number', 'url', 'email', 'page link', 'predefined', 'boolean', 'date']);

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

interface ColumnSocket {
  colId: string;
  colName: string;
  value: string;
  type: string;
  color?: string;
}

export const RowNode = React.memo(function RowNode({ id, data }: any) {
  const columns: ColumnSocket[] = data.columns || [];
  const rowLabel = data.label || 'Untitled';
  const rowColor = data.color || 'bg-surface-variant text-on-surface-variant';

  const edges = useEdges();
  const connectedHandles = useMemo(() => {
    const set = new Set<string>();
    edges.forEach(e => {
      if (e.source === id && e.sourceHandle) set.add(e.sourceHandle);
      if (e.target === id && e.targetHandle) set.add(e.targetHandle);
    });
    return set;
  }, [edges, id]);

  return (
    <div className="shadow-md rounded-xl bg-surface border border-outline/30 overflow-hidden min-w-[200px]">
      <Handle
        type="target"
        position={Position.Top}
        className="w-3 h-3 !bg-primary/40 opacity-40 border-2 border-primary/60"
      />

      <div className={`px-3 py-2 flex items-center gap-2 border-b border-outline/20 ${rowColor}`}>
        <span className="material-symbols-outlined text-lg">database</span>
        <span className="text-sm font-semibold text-on-surface truncate">{rowLabel}</span>
      </div>

      <div className="divide-y divide-outline/10">
        {columns.map((col) => {
          const handleId = `col-${col.colId}`;
          const isConnected = connectedHandles.has(handleId);
          const hasColor = col.color && col.color.startsWith('#');
          const showInlineText = TEXT_TYPES.has(col.type);

          return (
            <div
              key={col.colId}
              className="flex items-center gap-1.5 px-3 py-1.5 hover:bg-surface-variant/30 transition-colors group min-h-[32px]"
            >
              <span className="text-[11px] font-medium text-on-surface-variant w-[72px] truncate flex-shrink-0">
                {col.colName}
              </span>

              {showInlineText ? (
                <div
                  className="flex-1 text-xs text-on-surface truncate px-1.5 py-0.5 rounded"
                  style={
                    hasColor
                      ? { backgroundColor: col.color + '30', color: getContrastColor(col.color!) }
                      : {}
                  }
                >
                  {col.value || '—'}
                </div>
              ) : (
                <div className="flex-1 text-[10px] text-on-surface-variant/50 italic truncate px-1">
                  {col.value ? 'connected' : '—'}
                </div>
              )}

              <Handle
                type="source"
                position={Position.Right}
                id={handleId}
                className="!relative !transform-none !static cursor-crosshair"
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  flexShrink: 0,
                  backgroundColor: isConnected
                    ? (col.color || '#98cbff')
                    : 'rgba(255,255,255,0.15)',
                  border: isConnected
                    ? `2px solid ${col.color || '#98cbff'}`
                    : '2px solid rgba(255,255,255,0.3)',
                  opacity: isConnected ? 1 : 0.35,
                  transition: 'all 0.15s ease',
                  boxShadow: isConnected
                    ? `0 0 6px ${(col.color || '#98cbff') + '80'}`
                    : 'none',
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
            </div>
          );
        })}
      </div>

      {columns.length === 0 && (
        <div className="px-3 py-2 text-xs text-on-surface-variant text-center italic">
          No columns
        </div>
      )}
    </div>
  );
});