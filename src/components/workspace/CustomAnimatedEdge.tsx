import { EdgeProps, getStraightPath } from '@xyflow/react';

const SPHERE_RADIUS = 18; // matches 36px sphere diameter

/**
 * Compute the intersection point on a circle (sphere) perimeter
 * from the circle center toward a target point.
 */
function circleIntersect(
  cx: number, cy: number,
  tx: number, ty: number,
  radius: number,
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return { x: cx, y: cy };
  return {
    x: cx + (dx / dist) * radius,
    y: cy + (dy / dist) * radius,
  };
}

export function CustomAnimatedEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  style = {},
  markerEnd,
  sourceHandleId,
  targetHandleId,
}: EdgeProps) {
  // Detect sphere connection by handle IDs
  const isSrcSphere = sourceHandleId === 'center';
  const isTgtSphere = targetHandleId === 't-center';

  // Compute perimeter intersection for sphere endpoints
  const sx = isSrcSphere ? circleIntersect(sourceX, sourceY, targetX, targetY, SPHERE_RADIUS).x : sourceX;
  const sy = isSrcSphere ? circleIntersect(sourceX, sourceY, targetX, targetY, SPHERE_RADIUS).y : sourceY;
  const tx = isTgtSphere ? circleIntersect(targetX, targetY, sourceX, sourceY, SPHERE_RADIUS).x : targetX;
  const ty = isTgtSphere ? circleIntersect(targetX, targetY, sourceX, sourceY, SPHERE_RADIUS).y : targetY;

  // Straight paths for all edges (cleaner look, better for sphere perimeter rotation)
  const [edgePath] = getStraightPath({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty });

  return (
    <>
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
        fill="none"
      />
    </>
  );
}
