import React, { useState } from 'react';
import { Handle, Position } from '@xyflow/react';

export const CustomNode = React.memo(function CustomNode({ data }: any) {
  if (data.isFolderGroup) {
    return (
      <div className="bg-primary/5 border border-primary/20 rounded-2xl pointer-events-none" style={{ width: '100%', height: '100%' }} />
    );
  }

  const [hovered, setHovered] = useState(false);
  const bgColor = data.backgroundColor || '#98cbff';
  const label = data.label || '';
  const NODE_SIZE = 36;
  const RADIUS = NODE_SIZE / 2;

  return (
    <div
      className="relative"
      style={{ width: NODE_SIZE, height: NODE_SIZE }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Shared center handle — invisible, both source and target at the same center point.
          CustomAnimatedEdge uses circleIntersect to draw the actual line to the sphere perimeter. */}
      <Handle
        type="source"
        position={Position.Top}
        id="center"
        style={{
          position: 'absolute', top: RADIUS, left: RADIUS,
          width: 1, height: 1, opacity: 0, pointerEvents: 'all', zIndex: 10,
          transform: 'translate(-50%, -50%)',
        }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="t-center"
        style={{
          position: 'absolute', top: RADIUS, left: RADIUS,
          width: 1, height: 1, opacity: 0, zIndex: 10,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Connection guide dots on hover — show NSEW perimeter hints */}
      {hovered && (
        <>
          <div className="sphere-connection-dot" style={{ top: -2, left: '50%', marginLeft: -2, background: bgColor }} />
          <div className="sphere-connection-dot" style={{ bottom: -2, left: '50%', marginLeft: -2, background: bgColor }} />
          <div className="sphere-connection-dot" style={{ left: -2, top: '50%', marginTop: -2, background: bgColor }} />
          <div className="sphere-connection-dot" style={{ right: -2, top: '50%', marginTop: -2, background: bgColor }} />
        </>
      )}

      {/* Sphere */}
      <div
        className={`rounded-full graph-sphere ${hovered ? 'graph-sphere-hovered' : ''}`}
        style={{
          width: NODE_SIZE, height: NODE_SIZE,
          backgroundColor: bgColor,
          boxShadow: hovered
            ? `0 0 20px ${bgColor}80, 0 0 60px ${bgColor}30`
            : `0 0 10px ${bgColor}40`,
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.3s ease',
          cursor: 'pointer',
        }}
      >
        {/* Label tooltip on hover */}
        {hovered && label && (
          <div className="sphere-tooltip">
            {label}
          </div>
        )}
      </div>
    </div>
  );
});
