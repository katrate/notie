import React from 'react';
import { Handle, Position } from '@xyflow/react';

/* ── Compute contrast text color ── */
function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

export const CustomNode = React.memo(function CustomNode({ data }: any) {
  // Convert emoji/Lucide icons to Material Symbols names for display
  const getDisplayIcon = (icon: string | undefined): string => {
    if (!icon) return 'description';
    // Emoji mappings
    if (icon === '📁') return 'folder';
    if (icon === '📄') return 'description';
    // Lucide → Material Symbols mappings (from graph icon names)
    const lucideToMaterial: Record<string, string> = {
      'FileText': 'description',
      'Table2': 'table',
      'LayoutDashboard': 'dashboard',
      'PieChart': 'pie_chart',
      'CheckSquare': 'checklist',
      'Images': 'photo_library',
      'Database': 'database',
      'Label': 'label',
      'Folder': 'folder',
      'Hash': 'tag',
      'Timeline': 'timeline',
    };
    if (lucideToMaterial[icon]) return lucideToMaterial[icon];
    return icon; // assume it's already a Material Symbols name
  };

  const displayIcon = getDisplayIcon(data.icon);

  // Support both Tailwind classes and direct hex colors
  const hasHexColor = data.backgroundColor && typeof data.backgroundColor === 'string' && data.backgroundColor.startsWith('#');
  const iconContainerClass = hasHexColor ? '' : (data.color || 'bg-primary/20 text-primary');
  const iconContainerStyle = hasHexColor
    ? { backgroundColor: data.backgroundColor, color: data.textColor || getContrastColor(data.backgroundColor) }
    : {};

  return (
    <div
      className="px-3 py-3 shadow-md rounded-xl bg-surface border flex flex-col items-center gap-2 group hover:border-primary/50 transition-colors min-w-[90px]"
      style={{
        borderColor: data.imgUrl ? 'rgba(6, 182, 212, 0.3)' : (hasHexColor ? data.backgroundColor + '60' : 'rgba(255,255,255,0.2)'),
      }}
    >
      <Handle type="target" position={Position.Top} className="custom-handle target-handle opacity-30 group-hover:opacity-100" />
      
      {data.imgUrl ? (
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-variant flex-shrink-0 graph-node-img">
          <img src={data.imgUrl} alt="" className="w-full h-full object-cover" />
        </div>
      ) : (
        <div className={`flex items-center justify-center p-2 rounded-lg graph-node-icon ${iconContainerClass}`} style={iconContainerStyle}>
          <span className="material-symbols-outlined text-2xl">{displayIcon}</span>
        </div>
      )}
      
      <div className="flex flex-col items-center text-center">
        <div className="text-sm font-semibold text-on-surface line-clamp-2 leading-tight">{data.label}</div>
        {data.subLabel && <div className="text-[10px] text-on-surface-variant mt-0.5">{data.subLabel}</div>}
      </div>

      <Handle type="source" position={Position.Bottom} className="custom-handle source-handle opacity-30 group-hover:opacity-100" />
    </div>
  );
});
