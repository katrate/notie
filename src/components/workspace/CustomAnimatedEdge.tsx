import React from 'react';
import { EdgeProps, getBezierPath, getSmoothStepPath } from '@xyflow/react';

export function CustomAnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}: EdgeProps) {
  // Use smooth step for hierarchy, bezier for others by default, or read from data
  const isHierarchy = data?.type === 'hierarchy';
  
  const [edgePath] = isHierarchy
    ? getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      })
    : getBezierPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
      });

  const particleColor = (style.stroke as string) || '#98cbff';

  return (
    <>
      {/* The main visible edge line */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
      />
      
      {/* The animated particle flowing along the path */}
      <circle r="3" fill={particleColor} filter={`drop-shadow(0 0 3px ${particleColor})`}>
        <animateMotion dur="2.5s" repeatCount="indefinite">
          <mpath href={`#${id}`} />
        </animateMotion>
      </circle>
    </>
  );
}
