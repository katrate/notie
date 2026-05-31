import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import { RotateCcw } from 'lucide-react';
import { useProjectStore } from '../../stores/projectStore';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, useReactFlow, ReactFlowProvider } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CustomNode } from './CustomNode';
import { RowNode } from './RowNode';
import { ValueNode } from './ValueNode';
import { PageNode } from './PageNode';
import dagre from '@dagrejs/dagre';
import { Tooltip } from '../Tooltip';

const nodeTypes = { custom: CustomNode, rowNode: RowNode, valueNode: ValueNode, pageNode: PageNode };

/* Default tag definitions matching BoardView and GalleryView defaults */
const BOARD_DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: 'bug', color: '#f43f5e' },
  { name: 'feature', color: '#3b82f6' },
  { name: 'improvement', color: '#10b981' },
  { name: 'urgent', color: '#f59e0b' },
  { name: 'design', color: '#8b5cf6' },
  { name: 'docs', color: '#06b6d4' },
];

const GALLERY_DEFAULT_TAGS: { name: string; color: string }[] = [
  { name: 'art', color: '#f43f5e' },
  { name: 'design', color: '#3b82f6' },
  { name: 'photo', color: '#10b981' },
  { name: 'nature', color: '#f59e0b' },
  { name: 'architecture', color: '#8b5cf6' },
  { name: 'abstract', color: '#06b6d4' },
];

/* ── helpers ── */

function getContrastColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

function getNodeDimensions(id: string, data?: any): { width: number; height: number } {
  if (id.startsWith('proj-')) return { width: 160, height: 70 };
  if (id.startsWith('page-')) {
    const sockCount = data?.sockets?.length || 0;
    return { width: 160, height: 50 + sockCount * 28 };
  }
  if (id.startsWith('row-') || id.startsWith('tasklevel-')) {
    const colCount = data?.columns?.length || 1;
    const rowHeight = 32;
    return { width: 200, height: 44 + colCount * rowHeight };
  }
  if (id.startsWith('task-')) return { width: 140, height: 52 };
  if (id.startsWith('img-') || id.startsWith('vid-') || id.startsWith('aud-')) return { width: 130, height: 52 };
  if (id.startsWith('file-')) return { width: 130, height: 52 };
  if (id.startsWith('boardcard-')) return { width: 130, height: 52 };
  if (id.startsWith('boardcol-')) return { width: 120, height: 48 };
  if (id.startsWith('cell-')) return { width: 130, height: 44 };
  if (id.startsWith('sortval-')) return { width: 130, height: 48 };
  return { width: 130, height: 50 };
}

/* ── Find all descendant nodes reachable via directed edges ── */
function findDescendants(nodeId: string, allEdges: any[]): string[] {
  const childMap = new Map<string, string[]>();
  allEdges.forEach(e => {
    if (!childMap.has(e.source)) childMap.set(e.source, []);
    childMap.get(e.source)!.push(e.target);
  });

  const result: string[] = [];
  const stack = [nodeId];
  const visited = new Set<string>([nodeId]);

  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const childId of childMap.get(current) || []) {
      if (!visited.has(childId)) {
        visited.add(childId);
        result.push(childId);
        stack.push(childId);
      }
    }
  }
  return result;
}

function layoutNodesWithDagre(nodes: any[], edges: any[]): any[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: 'TB',
    ranksep: 160,
    nodesep: 80,
    marginx: 80,
    marginy: 80,
  });

  nodes.forEach(node => {
    const { width, height } = getNodeDimensions(node.id, node.data);
    g.setNode(node.id, { width, height });
  });

  edges.forEach(edge => {
    g.setEdge(edge.source, edge.target);
  });

  dagre.layout(g);

  return nodes.map(node => {
    const dagreNode = g.node(node.id);
    if (dagreNode) {
      return {
        ...node,
        position: {
          x: dagreNode.x - (dagreNode.width || 120) / 2,
          y: dagreNode.y - (dagreNode.height || 60) / 2,
        },
      };
    }
    return node;
  });
}

/**
 * Radial tree layout using subtree angular allocation.
 * Each node gets angular space proportional to its leaf-descendant count,
 * so children of the same parent are clustered together — far less messy
 * than evenly distributing nodes at each depth level.
 *
 * Improvements over basic radial layout:
 *  - Root node centered at origin for a true tree-like appearance
 *  - Angular padding between sibling groups to prevent label overlap
 *  - Siblings sorted by subtree size for cleaner contiguous grouping
 *  - Dynamic ring spacing based on node dimensions and count
 *  - Start angle offset (-PI/2) so first child sits at top for better visual balance
 */
function layoutNodesCircular(nodes: any[], edges: any[]): any[] {
  if (nodes.length === 0) return nodes;

  // ── 1. Build tree structure ──
  const structuralEdges = edges.filter(
    e => !e.id.startsWith('edge-linkblock-') && !e.id.startsWith('edge-table-link-')
  );

  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  nodes.forEach(n => { indegree.set(n.id, 0); children.set(n.id, []); });
  structuralEdges.forEach(e => {
    indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
    if (!children.has(e.source)) children.set(e.source, []);
    children.get(e.source)!.push(e.target);
  });

  // ── 2. BFS depth from root(s) ──
  const depth = new Map<string, number>();
  const roots = nodes.filter(n => (indegree.get(n.id) || 0) === 0);
  const queue: string[] = [];
  (roots.length ? roots : [nodes[0]]).forEach(r => { depth.set(r.id, 0); queue.push(r.id); });

  while (queue.length > 0) {
    const current = queue.shift()!;
    const d = depth.get(current) || 0;
    for (const child of children.get(current) || []) {
      if (!depth.has(child)) { depth.set(child, d + 1); queue.push(child); }
    }
  }
  nodes.forEach(n => { if (!depth.has(n.id)) depth.set(n.id, 1); });

  // ── 3. Count leaf-descendants per node (subtree angular weight) ──
  const leafCount = new Map<string, number>();
  function countLeafs(id: string): number {
    if (leafCount.has(id)) return leafCount.get(id)!;
    const childList = children.get(id) || [];
    if (childList.length === 0) { leafCount.set(id, 1); return 1; }
    const total = childList.reduce((s, c) => s + countLeafs(c), 0);
    leafCount.set(id, total || 1);
    return leafCount.get(id)!;
  }
  nodes.forEach(n => countLeafs(n.id));

  // Sort children of each node by leaf count descending for cleaner grouping
  for (const [, childList] of children.entries()) {
    childList.sort((a, b) => (leafCount.get(b) || 1) - (leafCount.get(a) || 1));
  }

  // ── 4. Assign angular spans (subtree-proportional) ──
  const angStart = new Map<string, number>();
  const angSpan = new Map<string, number>();
  const ANGULAR_PADDING = 0.025; // minimum gap between sibling groups (radians)

  function assignAngles(id: string, start: number, span: number) {
    angStart.set(id, start);
    angSpan.set(id, span);
    const childList = children.get(id) || [];
    if (childList.length === 0) return;
    const childLeafSum = childList.reduce((s, c) => s + (leafCount.get(c) || 1), 0) || 1;
    // Reserve padding between children
    const totalPadding = ANGULAR_PADDING * childList.length;
    const availableSpan = Math.max(span - totalPadding, 0.001);
    let curr = start;
    for (let i = 0; i < childList.length; i++) {
      const child = childList[i];
      const childSpan = availableSpan * ((leafCount.get(child) || 1) / childLeafSum);
      assignAngles(child, curr, childSpan);
      curr += childSpan + ANGULAR_PADDING;
    }
  }

  const rootLeafSum = roots.reduce((s, r) => s + (leafCount.get(r.id) || 1), 0) || 1;
  let currAngle = 0;
  for (const root of roots.length ? roots : [nodes[0]]) {
    const span = (2 * Math.PI) * ((leafCount.get(root.id) || 1) / rootLeafSum);
    assignAngles(root.id, currAngle, span);
    currAngle += span;
  }

  // ── 5. Compute dynamic radii per depth ──
  const maxDepth = Math.max(...Array.from(depth.values()), 0);
  const depthCount = new Map<number, number>();
  nodes.forEach(n => {
    const d = depth.get(n.id) || 0;
    depthCount.set(d, (depthCount.get(d) || 0) + 1);
  });

  const avgWidth = 130;
  const nodePadding = 50;
  const minRingSpacing = 130; // minimum space between rings

  const depthRadii = new Map<number, number>();
  // Depth 0: root at center
  depthRadii.set(0, 0);

  // For other depths, ensure enough circumference to fit all nodes
  for (let d = 1; d <= maxDepth; d++) {
    const count = depthCount.get(d) || 1;
    const minCircum = count * (avgWidth + nodePadding);
    const minRadiusForDepth = minCircum / (2 * Math.PI);
    // Also ensure at least minRingSpacing from previous ring
    const prevRadius = depthRadii.get(d - 1) || 0;
    const minRadiusBySpacing = prevRadius + minRingSpacing;
    depthRadii.set(d, Math.max(minRadiusForDepth, minRadiusBySpacing));
  }

  // ── 6. Position each node at the midpoint of its angular span ──
  // Offset all angles by -PI/2 so the layout starts at the top, giving a more
  // natural tree/organization-chart look
  const ANGLE_OFFSET = -Math.PI / 2;

  return nodes.map(node => {
    const d = depth.get(node.id) || 0;
    const { width, height } = getNodeDimensions(node.id, node.data);

    if (d === 0) {
      // Root node centered at origin
      return {
        ...node,
        position: {
          x: -(width || 160) / 2,
          y: -(height || 70) / 2,
        },
      };
    }

    const start = angStart.get(node.id) || 0;
    const span = angSpan.get(node.id) || (2 * Math.PI / nodes.length);
    const r = depthRadii.get(d) || d * minRingSpacing + 30;
    const angle = ANGLE_OFFSET + start + span / 2;

    return {
      ...node,
      position: {
        x: r * Math.cos(angle) - (width || 130) / 2,
        y: r * Math.sin(angle) - (height || 50) / 2,
      },
    };
  });
}

interface GraphCanvasProps {
  projectId: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ projectId }) => {
  return (
    <ReactFlowProvider>
      <GraphCanvasInner projectId={projectId} />
    </ReactFlowProvider>
  );
};

const GraphCanvasInner: React.FC<GraphCanvasProps> = ({ projectId }) => {
  // ── Granular store selectors (avoid full-store re-renders) ──
  const projects = useProjectStore(s => s.projects);
  const pages = useProjectStore(s => s.pages);
  const pendingGraphLink = useProjectStore(s => s.pendingGraphLink);
  const setPendingGraphLink = useProjectStore(s => s.setPendingGraphLink);

  const reactFlowInstance = useReactFlow();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  // ── Stable refs for store actions (avoids stale closures) ──
  const nodesRef = useRef<any[]>([]);
  nodesRef.current = nodes;

  // ── Shift-drag: track key state & descendant cache ──
  const shiftHeldRef = useRef(false);
  const draggingNodeIdRef = useRef<string | null>(null);
  const descendantIdsRef = useRef<string[]>([]);
  // Offset-from-start data for rigid group movement
  const shiftDragStartRef = useRef<{
    nodePos: { x: number; y: number };
    descPositions: Map<string, { x: number; y: number }>;
  } | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = true;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') shiftHeldRef.current = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, []);

  // Cleanup debounce timers on unmount
  useEffect(() => {
    return () => {
      if (posSaveTimerRef.current) clearTimeout(posSaveTimerRef.current);
      if (debounceViewportRef.current) clearTimeout(debounceViewportRef.current);
    };
  }, []);

  // ── Structure version: only changes when pages structurally change ──
  const structureKey = useMemo(() => {
    const projectPages = pages.filter(p => p.project_id === projectId)
      .sort((a, b) => (new Date((a as any).created_at || 0)).getTime() - (new Date((b as any).created_at || 0)).getTime());
    return projectPages.map(p =>
      `${p.id}:${p.type}:${p.metadata?.parentId || ''}:${p.title || ''}:${Array.isArray(p.content) ? p.content.length : (typeof p.content === 'object' ? 'o' : '0')}:gv=${(p.metadata?.graphVisibleColumns || []).join(',')}:sb=${(p.metadata?.sortByColIds || []).join(',')}:st=${p.metadata?.showTasksInGraph ? '1' : '0'}:sm=${p.metadata?.sortMode || 'default'}:${(Array.isArray(p.content) && p.type === 'checklist') ? p.content.map((t: any) => t.id + (t.completed ? '1' : '0') + (t.priority || '3') + (t.dueDate || '')).join(',') : ''}:${(Array.isArray(p.content) && p.type === 'gallery') ? p.content.map((t: any) => t.id + (t.title || '')).join(',') : ''}:${(Array.isArray(p.content) && p.type === 'board') ? p.content.map((t: any) => t.id + (t.title || '') + (t.columnId || '')).join(',') : ''}:      bc=${(p.metadata?.boardColumns || []).map((c: any) => c.id + c.title).join(',')}:tbl=${p.type === 'table' && Array.isArray(p.content) ? p.content.map((r: any) => Object.entries(r).map(([k, v]) => k + ':' + v).join(';')).join('||') : ''}`
    ).join('|');
  }, [projectId, pages]);

  // ── Project-level data (name, icon, saved positions/viewport) ──
  const project = useMemo(() => projects.find(p => p.id === projectId), [projectId, projects]);

  // ── Graph layout mode: 'hierarchy' (dagre) or 'circular' ──
  const graphLayoutMode = project?.settings?.graphLayoutMode || 'hierarchy';

  // ── Dagre layout cache: only recompute when structure changes ──
  const dagreLayoutRef = useRef<{ key: string; nodes: any[] }>({ key: '', nodes: [] });

  // ── Saved positions ref (avoid re-triggering graphData on position saves) ──
  // IMPORTANT: This must be declared BEFORE graphData useMemo that references it
  const savedPositionsRef = useRef<Record<string, { x: number; y: number }>>({});
  // Sync from project on first load / project change
  useEffect(() => {
    if (project?.settings?.graphNodePositions) {
      savedPositionsRef.current = { ...project.settings.graphNodePositions };
    } else {
      savedPositionsRef.current = {};
    }
  }, [project?.id, project?.settings?.graphNodePositions]);

  // ── Build graph data — dagre only re-runs on structural changes ──
  const graphData = useMemo(() => {
    if (!project) return { nodes: [], edges: [] };

    const newNodes: any[] = [];
    const newEdges: any[] = [];
    const projectPages = pages
      .filter(p => p.project_id === projectId)
      .sort((a, b) => (new Date((a as any).created_at || 0)).getTime() - (new Date((b as any).created_at || 0)).getTime());

    // Root Project Node
    newNodes.push({
      id: `proj-${project.id}`,
      type: 'custom',
      data: { 
        label: project.name, 
        icon: project.icon || 'folder',
        color: 'bg-primary/30 text-primary border-primary/50 border shadow-[0_0_15px_rgba(152,203,255,0.3)]' 
      },
      position: { x: 0, y: 0 },
    });

    projectPages.forEach((page) => {
      if (page.type === 'dashboard') return;
      const defaultIcon = page.type === 'table' ? 'Table2' : page.type === 'board' ? 'LayoutDashboard' : page.type === 'chart' ? 'PieChart' : page.type === 'checklist' ? 'CheckSquare' : page.type === 'gallery' ? 'Images' : page.type === 'folder' ? 'Folder' : 'FileText';
      
      const projectTags: { name: string; color: string }[] = project?.settings?.projectTags || [];
      const pageTags: string[] = page.metadata?.tags || [];
      const firstTag = pageTags.length > 0 ? projectTags.find(t => t.name === pageTags[0]) : null;

      const pageSockets: { id: string; label: string; count: number }[] = [];
      if (page.type === 'table' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'rows', label: 'Rows', count: page.content.length });
        const cols = page.metadata?.columns || [];
        pageSockets.push({ id: 'columns', label: 'Columns', count: cols.length });
      }
      if (page.type === 'checklist' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'tasks', label: 'Tasks', count: page.content.length });
      }
      if (page.type === 'gallery' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'images', label: 'Images', count: page.content.length });
      }
      if (page.type === 'board' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'cards', label: 'Cards', count: page.content.length });
      }
      if (page.type === 'file' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'files', label: 'Files', count: page.content.length });
      }
      if (page.type === 'video' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'video', label: 'Clips', count: page.content.length });
      }
      if (page.type === 'audio' && Array.isArray(page.content)) {
        pageSockets.push({ id: 'audio', label: 'Clips', count: page.content.length });
      }
      if (page.type === 'folder') {
        const childCount = projectPages.filter(p => p.metadata?.parentId === page.id).length;
        pageSockets.push({ id: 'pages', label: 'Pages', count: childCount });
      }

      newNodes.push({
        id: `page-${page.id}`,
        type: 'pageNode',
        data: { 
          label: page.title || 'Untitled', 
          icon: page.icon || defaultIcon, 
          color: firstTag ? '' : 'bg-secondary/20 text-secondary',
          backgroundColor: firstTag ? firstTag.color : undefined,
          textColor: firstTag ? getContrastColor(firstTag.color) : undefined,
          pageType: page.type,
          sockets: pageSockets,
        },
        position: { x: 0, y: 0 },
      });

      let parentId = page.metadata?.parentId;
      if (parentId && !projectPages.find(p => p.id === parentId)) {
        parentId = null;
      }
      const sourceId = parentId ? `page-${parentId}` : `proj-${project.id}`;

      newEdges.push({
        id: `edge-${sourceId}-${page.id}`,
        source: sourceId,
        target: `page-${page.id}`,
        animated: true,
        style: { stroke: 'rgba(152, 203, 255, 0.4)', strokeWidth: 2 },
      });          try {
        if ((page.type === 'text' || !page.type) && page.content && typeof page.content === 'object') {
          buildTextSubGraph(page, projectPages, newNodes, newEdges, projectTags);
        } else if (page.type === 'table' && Array.isArray(page.content)) {
          buildTableSubGraph(page, projectPages, newNodes, newEdges);
        } else if (page.type === 'checklist' && page.metadata?.showTasksInGraph && Array.isArray(page.content)) {
          buildChecklistSubGraph(page, newNodes, newEdges);
        } else if (page.type === 'gallery' && Array.isArray(page.content)) {
          buildGallerySubGraph(page, projectTags, newNodes, newEdges);
        } else if (page.type === 'file' && Array.isArray(page.content)) {
          buildFileSubGraph(page, newNodes, newEdges);
        } else if (page.type === 'video' && Array.isArray(page.content)) {
          buildMediaSubGraph(page, newNodes, newEdges, 'video');
        } else if (page.type === 'audio' && Array.isArray(page.content)) {
          buildMediaSubGraph(page, newNodes, newEdges, 'audio');
        } else if (page.type === 'board' && Array.isArray(page.content)) {
          buildBoardSubGraph(page, projectTags, newNodes, newEdges);
        } else if (page.content) {
          buildPageLinkCrossEdges(page, projectPages, newEdges);
        }
      } catch (err) {
        console.warn('Graph: failed to parse content for page', page.id, err);
      }
    });

    // Layout — dagre (hierarchy) or circular
    const hierarchyEdges = newEdges.filter(e => !e.id.startsWith('edge-linkblock-') && !e.id.startsWith('edge-table-link-'));
    
    let laidOutNodes: any[];
    
    if (graphLayoutMode === 'circular') {
      // Circular layout — computed fresh each time (caching not needed, it's fast)
      laidOutNodes = layoutNodesCircular(newNodes, hierarchyEdges);
    } else {
      // Dagre (hierarchy) layout — cached when structure unchanged
      if (dagreLayoutRef.current.key === structureKey) {
        const cache = dagreLayoutRef.current.nodes;
        const allCached = newNodes.every(n => cache.some((c: any) => c.id === n.id));
        if (allCached) {
          laidOutNodes = newNodes.map(n => {
            const cached = cache.find((c: any) => c.id === n.id);
            return cached ? { ...n, position: { x: cached.position.x, y: cached.position.y } } : n;
          });
        } else {
          laidOutNodes = layoutNodesWithDagre(newNodes, hierarchyEdges);
          dagreLayoutRef.current = { key: structureKey, nodes: laidOutNodes.map(n => ({ id: n.id, position: { x: n.position.x, y: n.position.y } })) };
        }
      } else {
        laidOutNodes = layoutNodesWithDagre(newNodes, hierarchyEdges);
        dagreLayoutRef.current = { key: structureKey, nodes: laidOutNodes.map(n => ({ id: n.id, position: { x: n.position.x, y: n.position.y } })) };
      }
    }

    // Apply saved positions (override layout) — read from ref to avoid project dependency
    const savedPositions = savedPositionsRef.current;
    if (Object.keys(savedPositions).length > 0) {
      laidOutNodes.forEach(node => {
        if (savedPositions[node.id]) {
          node.position = { ...savedPositions[node.id] };
        }
      });
    }

    return { nodes: laidOutNodes, edges: newEdges };
  }, [project, structureKey]);  // Only depends on project identity + page structure

  // ── Debounced viewport save (avoids cascade of re-renders from updateProject) ──
  const debounceViewportRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const posSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveViewport = useCallback((viewport: { x: number; y: number; zoom: number }) => {
    if (debounceViewportRef.current) clearTimeout(debounceViewportRef.current);
    debounceViewportRef.current = setTimeout(() => {
      const p = useProjectStore.getState().projects.find(p => p.id === projectId);
      if (!p) return;
      useProjectStore.getState().updateProject(projectId, {
        settings: { ...(p.settings || {}), graphViewport: viewport },
      });
    }, 300);
  }, [projectId]);

  // ── Apply graph state only when data actually changes ──
  const appliedRef = useRef(false);

  useEffect(() => {
    if (graphData.nodes.length === 0 && !appliedRef.current) {
      return;
    }

    if (graphData.nodes.length > 0) {
      setNodes(graphData.nodes);
      setEdges(graphData.edges);
      appliedRef.current = true;
    }

    if (graphData.nodes.length > 0) {
      const timer = setTimeout(() => {
        if (project?.settings?.graphViewport) {
          reactFlowInstance.setViewport(project.settings.graphViewport);
        } else {
          reactFlowInstance.fitView({ padding: 0.2 });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [graphData, project, setNodes, setEdges, reactFlowInstance]);

  // Watch for pendingGraphLink
  useEffect(() => {
    if (!pendingGraphLink) return;
    const { sourcePageId, targetPageId } = pendingGraphLink;

    const edgeId = `edge-linkblock-${sourcePageId}-${targetPageId}`;
    setEdges(eds => {
      if (eds.some(e => e.id === edgeId)) return eds;
      return [...eds, {
        id: edgeId,
        source: `page-${sourcePageId}`,
        target: `page-${targetPageId}`,
        animated: true,
        style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
      }];
    });

    // Auto-parent the target under the source (skip if would create a cycle)
    const sourcePage = pages.find(p => p.id === sourcePageId);
    const targetPage = pages.find(p => p.id === targetPageId);
    if (sourcePage && targetPage) {
      if (!isAncestor(sourcePageId, targetPageId)) {
        useProjectStore.getState().updatePage(targetPageId, {
          metadata: { ...(targetPage.metadata || {}), parentId: sourcePageId, parentedViaLink: true },
        });
      }
    }

    setPendingGraphLink(null);
  }, [pendingGraphLink, pages, setEdges, setPendingGraphLink]);

  // ── Handlers ──

  const onNodeDragStart = useCallback((_event: any, node: any) => {
    draggingNodeIdRef.current = node.id;
    shiftDragStartRef.current = null;
    // Precompute descendants using structural edges only
    const structuralEdges = edges.filter(
      e => !e.id.startsWith('edge-linkblock-') && !e.id.startsWith('edge-table-link-')
    );
    descendantIdsRef.current = findDescendants(node.id, structuralEdges);
  }, [edges]);

  const onNodeDrag = useCallback((_event: any, node: any) => {
    if (node.id !== draggingNodeIdRef.current) return;

    if (shiftHeldRef.current) {
      const ids = descendantIdsRef.current;
      if (ids.length === 0) return;

      // First frame of Shift-drag — capture current positions as baseline
      if (!shiftDragStartRef.current) {
        const descPositions = new Map<string, { x: number; y: number }>();
        const currentNodes = nodesRef.current;
        ids.forEach(id => {
          const n = currentNodes.find(n => n.id === id);
          if (n) descPositions.set(id, { x: n.position.x, y: n.position.y });
        });
        shiftDragStartRef.current = {
          nodePos: { x: node.position.x, y: node.position.y },
          descPositions,
        };
        return; // First frame, positions captured, no update needed yet
      }

      // Compute total offset from drag start and apply rigidly
      const offsetX = node.position.x - shiftDragStartRef.current.nodePos.x;
      const offsetY = node.position.y - shiftDragStartRef.current.nodePos.y;
      if (offsetX === 0 && offsetY === 0) return;

      const descPositions = shiftDragStartRef.current.descPositions;
      setNodes(nds =>
        nds.map(n => {
          const initPos = descPositions.get(n.id);
          if (!initPos) return n;
          return { ...n, position: { x: initPos.x + offsetX, y: initPos.y + offsetY } };
        })
      );
    } else {
      // Not Shift-dragging — reset shift start data
      shiftDragStartRef.current = null;
    }
  }, [setNodes]);

  const onMoveEnd = useCallback((_event: any, viewport: { x: number; y: number; zoom: number }) => {
    saveViewport(viewport);
  }, [saveViewport]);

  const onNodeDragStop = useCallback((_event: React.MouseEvent, node: any) => {
    // Update saved positions ref directly (avoids re-triggering graphData via project dependency)
    savedPositionsRef.current[node.id] = { x: node.position.x, y: node.position.y };

    // If Shift was held, persist descendant positions too
    if (shiftHeldRef.current && descendantIdsRef.current.length > 0) {
      const currentNodes = nodesRef.current;
      const ids = descendantIdsRef.current;
      currentNodes.forEach(n => {
        if (ids.includes(n.id)) {
          savedPositionsRef.current[n.id] = { x: n.position.x, y: n.position.y };
        }
      });
    }

    // Debounce the save to the store so it doesn't cascade into re-layouts
    if (posSaveTimerRef.current) clearTimeout(posSaveTimerRef.current);
    posSaveTimerRef.current = setTimeout(() => {
      const p = useProjectStore.getState().projects.find(p => p.id === projectId);
      if (!p) return;
      useProjectStore.getState().updateProject(projectId, {
        settings: { ...(p.settings || {}), graphNodePositions: { ...savedPositionsRef.current } },
      });
    }, 200);

    draggingNodeIdRef.current = null;
    shiftDragStartRef.current = null;
  }, [projectId]);

  const isAncestor = useCallback((sourcePageId: string, targetPageId: string): boolean => {
    const allPages = useProjectStore.getState().pages;
    let currentId = sourcePageId;
    for (let depth = 0; depth < 20; depth++) {
      const page = allPages.find(p => p.id === currentId);
      if (!page || !page.metadata?.parentId) return false;
      if (page.metadata.parentId === targetPageId) return true;
      currentId = page.metadata.parentId;
    }
    return false;
  }, []);

  const onConnect = useCallback(async (connection: any) => {
    const { source, target } = connection;
    if (!source || !target || source === target) return;

    const store = useProjectStore.getState();
    const { pages, updatePageContent, updatePage, graphEditorInsert, activePageId } = store;

    // ── Tag connection: card/image/row → tag node adds that tag ──
    let tagName: string | null = null;

    if (target.startsWith('tag-')) {
      const afterPrefix = target.slice(4); // remove 'tag-'
      const sepIdx = afterPrefix.lastIndexOf('-#');
      if (sepIdx !== -1) {
        tagName = afterPrefix.slice(sepIdx + 2); // strip '-#'
      }
    } else if (target.startsWith('taggroup-')) {
      // taggroup-{36-char-pageId}-{tagName}
      const afterPrefix = target.slice(9); // remove 'taggroup-'
      tagName = afterPrefix.slice(37); // skip 36-char UUID + '-'
    } else if (target.startsWith('boardtag-')) {
      // boardtag-{36-char-pageId}-{tagName}
      const afterPrefix = target.slice(9); // remove 'boardtag-'
      tagName = afterPrefix.slice(37); // skip 36-char UUID + '-'
    }

    if (tagName !== null) {
      // Skip untagged group — just create the visual edge
      if (tagName === '__untagged__') {
        const edgeId = `edge-tag-link-${source}-${target}`;
        setEdges(eds => {
          if (eds.some(e => e.id === edgeId)) return eds;
          return [...eds, {
            id: edgeId, source, target, animated: true,
            style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
          }];
        });
        return;
      }

      // Board card → tag
      if (source.startsWith('boardcard-')) {
        const match = source.match(/^boardcard-(.+)-([a-z0-9]+)$/);
        if (match) {
          const [, boardPageId, cardId] = match;
          const boardPage = pages.find(p => p.id === boardPageId);
          if (boardPage && Array.isArray(boardPage.content)) {
            const newContent = [...boardPage.content];
            const idx = newContent.findIndex((c: any) => c.id === cardId);
            if (idx !== -1) {
              const card = { ...newContent[idx] };
              const tags = card.tags || [];
              if (!tags.includes(tagName)) {
                card.tags = [...tags, tagName];
                newContent[idx] = card;
                await updatePageContent(boardPageId, newContent);
              }
            }
          }
        }
      }

      // Gallery image → tag
      else if (source.startsWith('img-')) {
        const match = source.match(/^img-(.+)-([a-z0-9]+)$/);
        if (match) {
          const [, galleryPageId, itemId] = match;
          const galleryPage = pages.find(p => p.id === galleryPageId);
          if (galleryPage && Array.isArray(galleryPage.content)) {
            const newContent = [...galleryPage.content];
            const idx = newContent.findIndex((i: any) => i.id === itemId);
            if (idx !== -1) {
              const item = { ...newContent[idx] };
              const tags = item.tags || [];
              if (!tags.includes(tagName)) {
                item.tags = [...tags, tagName];
                newContent[idx] = item;
                await updatePageContent(galleryPageId, newContent);
              }
            }
          }
        }
      }

      // Table row → tag (adds tags field to the row object)
      else if (source.startsWith('row-')) {
        console.log('[Graph] Row→tag connection:', { source, target, tagName });
        const match = source.match(/^row-(.+)-(\d+)$/);
        if (match) {
          const [, tablePageId, rowIndexStr] = match;
          const rowIndex = parseInt(rowIndexStr);
          console.log('[Graph] Row regex matched:', { tablePageId, rowIndex });
          const tablePage = pages.find(p => p.id === tablePageId);
          console.log('[Graph] Found table page:', tablePage ? tablePage.id : 'NOT FOUND', 'content array?', Array.isArray(tablePage?.content));
          if (tablePage && Array.isArray(tablePage.content)) {
            const newContent = [...tablePage.content];
            console.log('[Graph] Row index valid?', { rowIndex, contentLength: newContent.length });
            if (rowIndex < newContent.length) {
              const row = { ...newContent[rowIndex] };
              console.log('[Graph] Row data before:', { id: row.id, tags: row.tags, tagName });
              const tags = row.tags || [];
              if (!tags.includes(tagName)) {
                row.tags = [...tags, tagName];
                newContent[rowIndex] = row;
                console.log('[Graph] Calling updatePageContent with tags:', row.tags);
                await updatePageContent(tablePageId, newContent);
                console.log('[Graph] updatePageContent completed');
              } else {
                console.log('[Graph] Tag already present on row, skipping');
              }
            } else {
              console.log('[Graph] Row index out of bounds!');
            }
          }
        } else {
          console.log('[Graph] Row regex did NOT match! Source:', source);
        }
      }

      // Create the visual edge in the graph
      const edgeId = `edge-tag-link-${source}-${target}`;
      setEdges(eds => {
        if (eds.some(e => e.id === edgeId)) return eds;
        return [...eds, {
          id: edgeId, source, target, animated: true,
          style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
        }];
      });
      return;
    }

    if (source.startsWith('page-')) {
      const sourcePageId = source.replace('page-', '');
      const sourcePage = pages.find(p => p.id === sourcePageId);
      if (!sourcePage) return;

      const targetPageId = target.startsWith('page-') ? target.replace('page-', '') : null;
      const targetPage = targetPageId ? pages.find(p => p.id === targetPageId) : null;
      const targetTitle = targetPage?.title || 'Untitled';
      const targetIcon = targetPage?.icon || 'description';

      if (targetPageId) {
        if (sourcePage.type === 'text' || !sourcePage.type) {
          const isActiveEditor = graphEditorInsert && activePageId === sourcePageId;
          if (isActiveEditor) {
            graphEditorInsert(sourcePageId, targetPageId, targetTitle, targetIcon);
          } else {
            const sourceContent = sourcePage.content || { type: 'doc', content: [] };
            const contentArray = Array.isArray(sourceContent.content) ? sourceContent.content : [];
            const alreadyLinked = contentArray.some(
              (n: any) => n.type === 'pageLinkBlock' && n.attrs?.pageId === targetPageId
            );
            if (!alreadyLinked) {
              const updatedContent = {
                ...sourceContent,
                content: [...contentArray, {
                  type: 'pageLinkBlock' as const,
                  attrs: { pageId: targetPageId, pageTitle: targetTitle, pageIcon: targetIcon },
                }],
              };
              await updatePageContent(sourcePageId, updatedContent);
            }
          }
        } else {
          const existingLinks: { targetPageId: string }[] = sourcePage.metadata?.links || [];
          if (!existingLinks.some((l: any) => l.targetPageId === targetPageId)) {
            await updatePage(sourcePageId, {
              metadata: {
                ...(sourcePage.metadata || {}),
                links: [...existingLinks, { targetPageId, targetTitle, targetIcon }],
              },
            });
          }
        }
      }

      const edgeId = `edge-linkblock-${sourcePageId}-${targetPageId || target}`;
      setEdges(eds => {
        if (eds.some(e => e.id === edgeId)) return eds;
        return [...eds, {
          id: edgeId,
          source, target, animated: true,
          style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
        }];
      });

      // Auto-parent: when connecting page-to-page, set target as child of source
      if (target.startsWith('page-') && targetPageId && sourcePage && targetPage) {
        if (isAncestor(sourcePageId, targetPageId)) {
          return;
        }
        await updatePage(targetPageId, {
          metadata: { ...(targetPage.metadata || {}), parentId: sourcePageId, parentedViaLink: true },
        });
      }

    } else if (source.startsWith('row-')) {
      // Row → target connections: auto-fill matching column cells
      const rowMatch = source.match(/^row-(.+)-(\d+)$/);
      if (!rowMatch) return;
      const tablePageId = rowMatch[1];
      const rowIndex = parseInt(rowMatch[2]);

      const tablePage = pages.find(p => p.id === tablePageId);
      if (!tablePage || !Array.isArray(tablePage.content)) return;

      const columns = tablePage.metadata?.columns || [];
      const newContent = [...tablePage.content];
      if (rowIndex >= newContent.length) return;
      const row = { ...newContent[rowIndex] };

      // Extract the column ID from sourceHandle, e.g. "col-{colId}"
      const sourceHandle = connection.sourceHandle as string | undefined;
      const targetColId = sourceHandle?.startsWith('col-') ? sourceHandle.slice(4) : null;

      let edgeSuffix: string | null = null;

      if (target.startsWith('file-')) {
        const fileMatch = target.match(/^file-(.+)-(.+)$/);
        if (fileMatch) {
          const fileItemId = fileMatch[2];
          const attachmentCol = targetColId
            ? columns.find((c: any) => c.id === targetColId)
            : columns.find((c: any) => c.type === 'attachment');
          if (attachmentCol) {
            const filePageId = fileMatch[1];
            const filePage = pages.find(p => p.id === filePageId);
            const fileItem = filePage && Array.isArray(filePage.content)
              ? (filePage.content as any[]).find((f: any) => f.id === fileItemId)
              : null;
            if (fileItem) {
              row[attachmentCol.id] = fileItem.name;
              newContent[rowIndex] = row;
              await updatePageContent(tablePageId, newContent);
            }
            edgeSuffix = `file-${fileItemId}`;
          }
        }
      } else if (target.startsWith('img-')) {
        const imgMatch = target.match(/^img-(.+)-(.+)$/);
        if (imgMatch) {
          const imageItemId = imgMatch[2];
          const galleryCol = targetColId
            ? columns.find((c: any) => c.id === targetColId)
            : columns.find((c: any) => c.type === 'gallery');
          if (galleryCol) {
            const currentVal = row[galleryCol.id] || '';
            let ids: string[];
            try {
              const parsed = JSON.parse(currentVal || '[]');
              ids = Array.isArray(parsed) ? parsed : [];
            } catch {
              ids = currentVal ? String(currentVal).split(',').filter(Boolean) : [];
            }
            if (!ids.includes(imageItemId)) {
              ids.push(imageItemId);
              row[galleryCol.id] = JSON.stringify(ids);
              newContent[rowIndex] = row;
              await updatePageContent(tablePageId, newContent);
            }
            edgeSuffix = `img-${imageItemId}`;
          }
        }
      } else if (target.startsWith('vid-') || target.startsWith('aud-')) {
        const prefix = target.startsWith('vid-') ? 'vid-' : 'aud-';
        const mediaMatch = target.match(new RegExp(`^${prefix}(.+)-(.+)$`));
        if (mediaMatch) {
          const mediaItemId = mediaMatch[2];
          const mediaCol = targetColId
            ? columns.find((c: any) => c.id === targetColId)
            : columns.find((c: any) => c.type === 'media');
          if (mediaCol) {
            const currentVal = row[mediaCol.id] || '';
            let ids: string[];
            try {
              const parsed = JSON.parse(currentVal || '[]');
              ids = Array.isArray(parsed) ? parsed : [];
            } catch {
              ids = currentVal ? String(currentVal).split(',').filter(Boolean) : [];
            }
            if (!ids.includes(mediaItemId)) {
              ids.push(mediaItemId);
              row[mediaCol.id] = JSON.stringify(ids);
              newContent[rowIndex] = row;
              await updatePageContent(tablePageId, newContent);
            }
            edgeSuffix = `${prefix}${mediaItemId}`;
          }
        }
      } else if (target.startsWith('page-')) {
        const targetPageId = target.replace('page-', '');
        const pageLinkCol = targetColId
          ? columns.find((c: any) => c.id === targetColId)
          : columns.find((c: any) => c.type === 'page link');
        if (pageLinkCol) {
          const currentVal = row[pageLinkCol.id] || '';
          const ids = currentVal ? currentVal.split(',').filter(Boolean) : [];
          if (!ids.includes(targetPageId)) {
            ids.push(targetPageId);
            row[pageLinkCol.id] = ids.join(',');
            newContent[rowIndex] = row;
            await updatePageContent(tablePageId, newContent);
          }
          edgeSuffix = `page-${targetPageId}`;
        }
      } else if (target.startsWith('sortval-')) {
        // Row → predefined sort-value node: fill the predefined column cell(s)
        const afterPrefix = target.slice(8); // remove 'sortval-'
        const sortvalPageId = afterPrefix.slice(0, 36);
        const pathKey = afterPrefix.slice(37); // skip 36-char UUID + '-'
        if (sortvalPageId === tablePageId && pathKey) {
          // Parse pathKey: "colId1|valId1__colId2|valId2"
          const segments = pathKey.split('__');
          let modified = false;
          segments.forEach((seg: string) => {
            const pipeIdx = seg.indexOf('|');
            if (pipeIdx === -1) return;
            const colId = seg.slice(0, pipeIdx);
            const valId = seg.slice(pipeIdx + 1);
            const col = columns.find((c: any) => c.id === colId);
            if (col && col.type === 'predefined') {
              const optExists = col.options?.some((o: any) => o.id === valId);
              if (optExists) {
                const currentVal = row[colId] || '';
                const valIds = currentVal ? String(currentVal).split(',').filter(Boolean) : [];
                if (!valIds.includes(valId)) {
                  valIds.push(valId);
                  row[colId] = valIds.join(',');
                  modified = true;
                }
              }
            }
          });
          if (modified) {
            newContent[rowIndex] = row;
            await updatePageContent(tablePageId, newContent);
          }
          edgeSuffix = `sortval-${pathKey.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
        }
      } else if (target.startsWith('cell-')) {
        // Row → cell node on another row: copy that cell's value to this row
        // cell-{36-char-pageId}-{rIndex}-{colId}-{vIdx}
        const afterPrefix = target.slice(5);
        const cellPageId = afterPrefix.slice(0, 36);
        if (cellPageId !== tablePageId) return;
        const rest = afterPrefix.slice(37);
        const firstDash = rest.indexOf('-');
        const targetRowIndex = parseInt(rest.slice(0, firstDash), 10);
        if (isNaN(targetRowIndex) || targetRowIndex >= newContent.length) return;
        if (targetRowIndex === rowIndex) return;
        const afterRowIndex = rest.slice(firstDash + 1);
        const lastDash = afterRowIndex.lastIndexOf('-');
        const cellColId = afterRowIndex.slice(0, lastDash);
        const vIdx = afterRowIndex.slice(lastDash + 1);

        // Use the column from the source socket when available, otherwise from the target cell
        const writeColId = targetColId || cellColId;
        const readColId = cellColId;

        const writeCol = columns.find((c: any) => c.id === writeColId);
        const readCol = columns.find((c: any) => c.id === readColId);
        if (!writeCol || !readCol) return;

        // Get the value from the target row's cell
        const targetRow = newContent[targetRowIndex];
        const cellValue = targetRow[readColId];
        if (cellValue == null || cellValue === '') return;

        if (readCol.type === 'predefined') {
          const targetValIds = String(cellValue).split(',').filter(Boolean);
          const sourceCurrentVal = row[writeColId] || '';
          const sourceValIds = sourceCurrentVal ? String(sourceCurrentVal).split(',').filter(Boolean) : [];
          let modified = false;
          targetValIds.forEach((valId: string) => {
            if (!sourceValIds.includes(valId)) {
              sourceValIds.push(valId);
              modified = true;
            }
          });
          if (modified) {
            row[writeColId] = sourceValIds.join(',');
            newContent[rowIndex] = row;
            await updatePageContent(tablePageId, newContent);
          }
        } else {
          row[writeColId] = cellValue;
          newContent[rowIndex] = row;
          await updatePageContent(tablePageId, newContent);
        }

        edgeSuffix = `cell-${writeColId}-${vIdx}`;
      }

      if (edgeSuffix) {
        const edgeId = `edge-row-link-${tablePageId}-${rowIndex}-${edgeSuffix}`;
        setEdges(eds => {
          if (eds.some(e => e.id === edgeId)) return eds;
          return [...eds, {
            id: edgeId, source, sourceHandle: connection.sourceHandle, target, animated: true,
            style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
          }];
        });
      }
    }
  }, []);

  const resetLayout = useCallback(() => {
    savedPositionsRef.current = {};
    const p = useProjectStore.getState().projects.find(p => p.id === projectId);
    if (!p) return;
    useProjectStore.getState().updateProject(projectId, {
      settings: { ...(p.settings || {}), graphNodePositions: {} },
    });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 100);
  }, [projectId, reactFlowInstance]);

  const toggleLayoutMode = useCallback(() => {
    const p = useProjectStore.getState().projects.find(p => p.id === projectId);
    if (!p) return;
    const currentMode = p.settings?.graphLayoutMode || 'hierarchy';
    const newMode = currentMode === 'hierarchy' ? 'circular' : 'hierarchy';
    // Clear saved positions so new layout takes full effect
    savedPositionsRef.current = {};
    useProjectStore.getState().updateProject(projectId, {
      settings: {
        ...(p.settings || {}),
        graphLayoutMode: newMode,
        graphNodePositions: {},
      },
    });
    setTimeout(() => reactFlowInstance.fitView({ padding: 0.2 }), 150);
  }, [projectId, reactFlowInstance]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: any) => {
    if (node.id.startsWith('page-')) {
      const state = useProjectStore.getState();
      state.setActivePage(node.id.replace('page-', ''));
      state.setViewMode('both');
    }
  }, []);

  return (
    <div style={{ width: '100%', height: '100%' }} className="rounded-lg overflow-hidden relative">        <ReactFlow 
        nodes={nodes} 
        edges={edges} 
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onMoveEnd={onMoveEnd}
        onConnect={onConnect}
        nodeTypes={nodeTypes} 
        zoomOnScroll={true}
        panOnDrag={true}
        panOnScroll={false}
        selectionKeyCode={null}
        className="dark"
        proOptions={{ hideAttribution: true }}
        style={{ '--xy-background-color': 'transparent' } as React.CSSProperties}
      >
        <Background color="rgba(255,255,255,0.05)" gap={16} size={1} />
        <Controls 
          showInteractive={false} 
          position="bottom-right" 
          className="opacity-20 hover:opacity-100 transition-opacity [&>button]:bg-surface-variant [&>button]:border-outline/20 [&>button]:text-on-surface-variant [&>button:hover]:bg-surface" 
        />

        {/* Layout toggle button */}
        <div className="absolute bottom-[160px] right-3 z-10">
          <Tooltip label={graphLayoutMode === 'hierarchy' ? 'Switch to circular layout' : 'Switch to hierarchy layout'} position="left">
            <button
              onClick={toggleLayoutMode}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-variant border border-outline/20 text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all cursor-pointer opacity-20 hover:opacity-100"
            >
              <span className="material-symbols-outlined text-[16px]">
                {graphLayoutMode === 'hierarchy' ? 'blur_circular' : 'account_tree'}
              </span>
            </button>
          </Tooltip>
        </div>

        {/* Reset layout button */}
        <div className="absolute bottom-[116px] right-3 z-10">
          <Tooltip label="Reset layout" position="left">
            <button
              onClick={resetLayout}
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-surface-variant border border-outline/20 text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all cursor-pointer opacity-20 hover:opacity-100"
            >
              <RotateCcw size={16} />
            </button>
          </Tooltip>
        </div>
      </ReactFlow>
    </div>
  );
};

/* ═══════════════════════════════════════════════
   Sub-graph builders
   ═══════════════════════════════════════════════ */

function buildTableSubGraph(
  page: any,
  projectPages: any[],
  newNodes: any[],
  newEdges: any[],
) {
  const columns = page.metadata?.columns || [];
  const visibleCols = page.metadata?.graphVisibleColumns?.length
    ? page.metadata.graphVisibleColumns
    : columns.map((c: any) => c.id);
  const primaryCol = columns[0];
  if (!primaryCol || !Array.isArray(page.content)) return;

  const sortByColIds: string[] = page.metadata?.sortByColIds ||
    (page.metadata?.sortByColId ? [page.metadata.sortByColId] : []);
  if (sortByColIds.length > 0) {
    const validCols = sortByColIds
      .map(id => columns.find((c: any) => c.id === id))
      .filter((c: any) => c && c.type === 'predefined');
    if (validCols.length > 0) {
      buildTableSubGraphWithSortBy(page, columns, visibleCols, primaryCol, validCols.map((c: any) => c.id), projectPages, newNodes, newEdges);
      return;
    }
  }

  page.content.forEach((row: any, rIndex: number) => {
    const rowLabel = row[primaryCol.id] || `Row ${rIndex + 1}`;
    if (!rowLabel) return;

    const rowId = `row-${page.id}-${rIndex}`;

    const colSockets = columns
      .filter((col: any) => visibleCols.includes(col.id))
      .map((col: any) => {
        const rawVal = row[col.id];
        const displayVal = rawVal != null ? String(rawVal).substring(0, 20) : '';
        let color: string | undefined;
        if (col.type === 'predefined' && rawVal) {
          const valIds = String(rawVal).split(',').filter(Boolean);
          const firstOpt = valIds.length > 0
            ? col.options?.find((o: any) => o.id === valIds[0])
            : null;
          if (firstOpt?.color) color = firstOpt.color;
        }
        return {
          colId: col.id,
          colName: col.name || col.id,
          value: displayVal,
          type: col.type || 'text',
          color,
        };
      });

    newNodes.push({
      id: rowId,
      type: 'rowNode',
      data: {
        label: String(rowLabel).substring(0, 30),
        icon: 'Database',
        color: 'bg-surface-variant text-on-surface-variant',
        columns: colSockets,
        pageId: page.id,
        rowIndex: rIndex,
      },
      position: { x: 0, y: 0 },
    });

    newEdges.push({
      id: `edge-row-${page.id}-${rIndex}`,
      source: `page-${page.id}`,
      target: rowId,
      sourceHandle: undefined,
      animated: true,
      style: { stroke: 'rgba(152, 203, 255, 0.4)', strokeWidth: 2 },
    });

    addRowCellNodes(page, row, rIndex, columns, visibleCols, primaryCol, rowId, projectPages, newNodes, newEdges);
  });
}

/** Add cell nodes for a given row (used by both default and sort-by modes) */
function addRowCellNodes(
  page: any,
  row: any,
  rIndex: number,
  columns: any[],
  visibleCols: string[],
  primaryCol: any,
  parentNodeId: string,
  projectPages: any[],
  newNodes: any[],
  newEdges: any[],
) {
  columns.forEach((col: any) => {
    if (col.id === primaryCol.id || !visibleCols.includes(col.id)) return;
    const rawCellValue = row[col.id];
    if (rawCellValue == null || rawCellValue === '') return;

    let valueIds: string[];
    if (col.type === 'gallery') {
      try {
        const parsed = JSON.parse(String(rawCellValue));
        valueIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [String(rawCellValue)];
      } catch {
        valueIds = String(rawCellValue).split(',').filter(Boolean);
      }
    } else if (col.type === 'predefined' || col.type === 'page link') {
      valueIds = String(rawCellValue).split(',').filter(Boolean);
    } else if (col.type === 'media') {
      try {
        const parsed = JSON.parse(String(rawCellValue));
        valueIds = Array.isArray(parsed) ? parsed.filter(Boolean) : [String(rawCellValue)];
      } catch {
        valueIds = String(rawCellValue).split(',').filter(Boolean);
      }
    } else {
      valueIds = [String(rawCellValue)];
    }

    valueIds.forEach((singleVal: string, vIdx: number) => {
      if (col.type === 'page link') {
        const linkedPage = projectPages.find(p => p.id === singleVal);
        if (linkedPage) {
          const refEdgeId = `edge-table-link-${parentNodeId}-${singleVal}`;
          const alreadyExists = newEdges.some(e => e.id === refEdgeId);
          if (!alreadyExists) {
            newEdges.push({
              id: refEdgeId,
              source: parentNodeId,
              sourceHandle: `col-${col.id}`,
              target: `page-${singleVal}`,
              animated: true,
              style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
            });
          }
        }
        return;
      }

      if (col.type === 'attachment') {
        return;
      }

      if (col.type === 'gallery') {
        const galleryPage = projectPages.find(p =>
          p.type === 'gallery' && Array.isArray(p.content) && p.content.some((item: any) => item.id === singleVal)
        );
        if (galleryPage) {
          const imgNodeId = `img-${galleryPage.id}-${singleVal}`;
          const refEdgeId = `edge-table-img-${parentNodeId}-${singleVal}`;
          const alreadyExists = newEdges.some(e => e.id === refEdgeId);
          if (!alreadyExists) {
            newEdges.push({
              id: refEdgeId,
              source: parentNodeId,
              sourceHandle: `col-${col.id}`,
              target: imgNodeId,
              animated: true,
              style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
            });
          }
        }
        return;
      }

      if (col.type === 'media') {
        const mediaPage = projectPages.find(p =>
          (p.type === 'audio' || p.type === 'video') && Array.isArray(p.content) && p.content.some((item: any) => item.id === singleVal)
        );
        if (mediaPage) {
          const prefix = mediaPage.type === 'video' ? 'vid' : 'aud';
          const mediaNodeId = `${prefix}-${mediaPage.id}-${singleVal}`;
          const refEdgeId = `edge-table-media-${parentNodeId}-${singleVal}`;
          const alreadyExists = newEdges.some(e => e.id === refEdgeId);
          if (!alreadyExists) {
            newEdges.push({
              id: refEdgeId,
              source: parentNodeId,
              sourceHandle: `col-${col.id}`,
              target: mediaNodeId,
              animated: true,
              style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
            });
          }
        }
        return;
      }

      let cellLabel = singleVal;
      let bgColor: string | undefined;
      let textColor: string | undefined;

      if (col.type === 'predefined') {
        const opt = col.options?.find((o: any) => o.id === singleVal);
        if (opt) {
          cellLabel = opt.value;
          bgColor = opt.color;
          textColor = getContrastColor(opt.color);
        }
      }

      const cellId = `cell-${page.id}-${rIndex}-${col.id}-${vIdx}`;

      const nodeData: any = {
        label: String(cellLabel).substring(0, 20),
        icon: col.icon || 'Label',
        colType: col.type,
      };
      if (bgColor) {
        nodeData.backgroundColor = bgColor;
        nodeData.textColor = textColor;
      } else {
        nodeData.color = 'bg-tertiary/20 text-tertiary';
      }

      newNodes.push({
        id: cellId,
        type: 'valueNode',
        data: nodeData,
        position: { x: 0, y: 0 },
      });
      newEdges.push({
        id: `edge-cell-${page.id}-${rIndex}-${col.id}-${vIdx}`,
        source: parentNodeId,
        sourceHandle: `col-${col.id}`,
        target: cellId,
        animated: true,
        style: { stroke: 'rgba(152, 203, 255, 0.4)', strokeWidth: 2 },
      });
    });
  });
}

/**
 * Multi-column sort-by mode: restructure the table sub-graph so predefined values
 * create a nested grouping hierarchy. The order of sortByColIds determines the
 * grouping level (first = top level). For each row, the Cartesian product of all
 * sort-by values is computed, producing a path table → level0 → level1 → … → row.
 * Shared grouping nodes are reused across rows with the same value path.
 */
function buildTableSubGraphWithSortBy(
  page: any,
  columns: any[],
  visibleCols: string[],
  primaryCol: any,
  sortByColIds: string[],
  projectPages: any[],
  newNodes: any[],
  newEdges: any[],
) {
  const createdNodeIds = new Set<string>();

  page.content.forEach((row: any, rIndex: number) => {
    const rowLabel = row[primaryCol.id] || `Row ${rIndex + 1}`;
    if (!rowLabel) return;

    // Collect values at each sort-by level for this row
    const levelsValues: { colId: string; valIds: string[] }[] = [];
    sortByColIds.forEach((colId: string) => {
      const col = columns.find((c: any) => c.id === colId);
      if (!col || col.type !== 'predefined') return;
      const rawValue = row[colId];
      const valIds = rawValue ? String(rawValue).split(',').filter(Boolean) : [];
      levelsValues.push({ colId, valIds });
    });

    if (levelsValues.length === 0) return;

    // Check if ALL levels are empty — fallback to direct table link
    const allEmpty = levelsValues.every(lv => lv.valIds.length === 0);
    if (allEmpty) {
      const rowId = `row-${page.id}-${rIndex}`;
      const colSockets = columns
        .filter((col: any) => visibleCols.includes(col.id))
        .map((col: any) => {
          const rawVal = row[col.id];
          const displayVal = rawVal != null ? String(rawVal).substring(0, 20) : '';
          let color: string | undefined;
          if (col.type === 'predefined' && rawVal) {
            const valIds = String(rawVal).split(',').filter(Boolean);
            const firstOpt = valIds.length > 0 ? col.options?.find((o: any) => o.id === valIds[0]) : null;
            if (firstOpt?.color) color = firstOpt.color;
          }
          return { colId: col.id, colName: col.name || col.id, value: displayVal, type: col.type || 'text', color };
        });
      newNodes.push({
        id: rowId,
        type: 'rowNode',
        data: { label: String(rowLabel).substring(0, 30), icon: 'Database', color: 'bg-surface-variant text-on-surface-variant', columns: colSockets, pageId: page.id, rowIndex: rIndex },
        position: { x: 0, y: 0 },
      });
      newEdges.push({
        id: `edge-row-${page.id}-${rIndex}`,
        source: `page-${page.id}`,
        target: rowId,
        animated: true,
        style: { stroke: 'rgba(152, 203, 255, 0.4)', strokeWidth: 2 },
      });
      const cellVisibleCols = visibleCols.filter((cId: string) => !sortByColIds.includes(cId));
      addRowCellNodes(page, row, rIndex, columns, cellVisibleCols, primaryCol, rowId, projectPages, newNodes, newEdges);
      return;
    }

    // Generate all paths (Cartesian product of non-empty levels)
    // Path segments are arrays of { colId, valId }
    let paths: { colId: string; valId: string }[][] = [];

    // Only include non-empty levels; skip empty ones (row will connect to last non-empty ancestor)
    const nonEmptyLevels = levelsValues.filter(lv => lv.valIds.length > 0);

    // Start with first level's values
    nonEmptyLevels[0].valIds.forEach((valId: string) => {
      paths.push([{ colId: nonEmptyLevels[0].colId, valId }]);
    });

    // Cartesian product with subsequent levels
    for (let li = 1; li < nonEmptyLevels.length; li++) {
      const lv = nonEmptyLevels[li];
      const newPaths: { colId: string; valId: string }[][] = [];
      paths.forEach((path) => {
        lv.valIds.forEach((valId: string) => {
          newPaths.push([...path, { colId: lv.colId, valId }]);
        });
      });
      paths = newPaths;
    }

    if (paths.length === 0) return;

    // Create/link grouping nodes for each path, then the row
    paths.forEach((path) => {
      let prevNodeId = `page-${page.id}`;

      path.forEach((segment, levelIndex) => {
        const { colId, valId } = segment;
        const col = columns.find((c: any) => c.id === colId);
        const opt = col?.options?.find((o: any) => o.id === valId);

        // Build unique path key for this level's node
        const pathSegments = path.slice(0, levelIndex + 1).map(s => `${s.colId}|${s.valId}`);
        const pathKey = pathSegments.join('__');
        const nodeId = `sortval-${page.id}-${pathKey}`;

        if (!createdNodeIds.has(nodeId)) {
          createdNodeIds.add(nodeId);
          const sortValueLabel = opt?.value || valId;
          const sortColor = opt?.color || '#60a5fa';

          const sortCol = columns.find((c: any) => c.id === colId);
          newNodes.push({
            id: nodeId,
            type: 'valueNode',
            data: {
              label: String(sortValueLabel).substring(0, 20),
              icon: sortCol?.icon || 'Label',
              backgroundColor: sortColor,
              textColor: getContrastColor(sortColor),
            },
            position: { x: 0, y: 0 },
          });

          newEdges.push({
            id: `edge-sortval-${page.id}-${pathKey}`,
            source: prevNodeId,
            target: nodeId,
            animated: true,
            style: { stroke: 'rgba(152, 203, 255, 0.5)', strokeWidth: 2.5 },
          });
        }

        prevNodeId = nodeId;
      });

      // Create/link shared row node
      const rowId = `row-${page.id}-${rIndex}`;
      const rowAlreadyExists = newNodes.some(n => n.id === rowId);
      if (!rowAlreadyExists) {
        const colSockets = columns
          .filter((col: any) => visibleCols.includes(col.id))
          .map((col: any) => {
            const rawVal = row[col.id];
            const displayVal = rawVal != null ? String(rawVal).substring(0, 20) : '';
            let color: string | undefined;
            if (col.type === 'predefined' && rawVal) {
              const valIds = String(rawVal).split(',').filter(Boolean);
              const firstOpt = valIds.length > 0 ? col.options?.find((o: any) => o.id === valIds[0]) : null;
              if (firstOpt?.color) color = firstOpt.color;
            }
            return { colId: col.id, colName: col.name || col.id, value: displayVal, type: col.type || 'text', color };
          });
        newNodes.push({
          id: rowId,
          type: 'rowNode',
          data: { label: String(rowLabel).substring(0, 30), icon: 'Database', color: 'bg-surface-variant text-on-surface-variant', columns: colSockets, pageId: page.id, rowIndex: rIndex },
          position: { x: 0, y: 0 },
        });
      }

      const rowPathKey = path.map(s => `${s.colId}|${s.valId}`).join('__');
      newEdges.push({
        id: `edge-sortrow-${page.id}-${rIndex}-${rowPathKey}`,
        source: prevNodeId,
        target: rowId,
        animated: true,
        style: { stroke: 'rgba(152, 203, 255, 0.4)', strokeWidth: 2 },
      });
    });

    // Add cell nodes once per row, excluding all sort-by columns
    const rowId = `row-${page.id}-${rIndex}`;
    if (newNodes.some(n => n.id === rowId)) {
      const cellVisibleCols = visibleCols.filter((cId: string) => !sortByColIds.includes(cId));
      addRowCellNodes(page, row, rIndex, columns, cellVisibleCols, primaryCol, rowId, projectPages, newNodes, newEdges);
    }
  });
}

function buildTextSubGraph(
  page: any,
  projectPages: any[],
  newNodes: any[],
  newEdges: any[],
  projectTags: { name: string; color: string }[],
) {
  const tags = new Set<string>();

  const extractNodes = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'text' && node.text) {
      const matches = node.text.match(/#[a-zA-Z0-9_]+/g);
      if (matches) matches.forEach((t: string) => tags.add(t));
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(extractNodes);
    } else if (node.content && typeof node.content === 'object') {
      extractNodes(node.content);
    }
  };

  if (Array.isArray(page.content)) {
    page.content.forEach(extractNodes);
  } else if (page.content && typeof page.content === 'object') {
    const doc = page.content as any;
    if (Array.isArray(doc.content)) {
      doc.content.forEach(extractNodes);
    } else if (doc.type) {
      extractNodes(doc);
    }
  }

  // Create tag nodes with project tag colors when available
  Array.from(tags).forEach((tag) => {
    // Strip '#' prefix and look up in project tags
    const tagNameNoHash = tag.startsWith('#') ? tag.slice(1) : tag;
    const tagDef = projectTags.find(t => t.name === tagNameNoHash);

    newNodes.push({
      id: `tag-${page.id}-${tag}`,
      type: 'valueNode',
      data: {
        label: tag,
        icon: 'Hash',
        ...(tagDef?.color
          ? { backgroundColor: tagDef.color, textColor: getContrastColor(tagDef.color) }
          : { backgroundColor: '#a855f7', textColor: '#fff' }),
      },
      position: { x: 0, y: 0 }, // dagre will set
    });
    newEdges.push({
      id: `edge-tag-${page.id}-${tag}`,
      source: `page-${page.id}`,
      target: `tag-${page.id}-${tag}`,
      style: { stroke: 'rgba(255, 255, 255, 0.1)', strokeWidth: 1 },
    });
  });

  // Cross-reference edges are now handled by buildPageLinkCrossEdges
  buildPageLinkCrossEdges(page, projectPages, newEdges);
}

/* ── Checklist sub-graph: render each todo as a node ── */
function buildChecklistSubGraph(
  page: any,
  newNodes: any[],
  newEdges: any[],
) {
  const todos: any[] = page.content || [];
  const sortMode = page.metadata?.sortMode || 'default';
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);
  const priorityIcons = ['', 'priority_high', 'warning', 'arrow_upward', 'check', 'more_horiz'];

  function pushTaskNode(todo: any, parentId: string, sourceHandle?: string, hidePriority?: boolean) {
    if (!todo || !todo.id) return;
    const taskSockets = [
      { colId: 'text', colName: 'Task', value: todo.text?.substring(0, 25) || '', type: 'text' },
      ...(hidePriority ? [] : [{ colId: 'priority', colName: 'Priority', value: `P${todo.priority || 3}`, type: 'predefined', color: ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'][todo.priority || 3] }]),
      { colId: 'dueDate', colName: 'Due', value: todo.dueDate ? new Date(todo.dueDate).toLocaleDateString() : '', type: 'date' },
      { colId: 'status', colName: 'Status', value: todo.completed ? 'Done' : 'Open', type: 'text' },
    ];
    newNodes.push({
      id: `task-${page.id}-${todo.id}`,
      type: 'rowNode',
      data: {
        label: todo.text?.substring(0, 22) || 'Untitled',
        icon: todo.completed ? 'check_circle' : 'radio_button_unchecked',
        color: '',
        columns: taskSockets,
        pageType: 'task',
      },
      position: { x: 0, y: 0 },
    });
    newEdges.push({
      id: `edge-task-${page.id}-${todo.id}`,
      source: parentId,
      sourceHandle: sourceHandle || undefined,
      target: `task-${page.id}-${todo.id}`,
      animated: true,
      style: { stroke: 'rgba(168, 85, 247, 0.5)', strokeWidth: 2 },
    });
  }

  // Sort todos for all modes
  const sortedTodos = [...todos].sort((a: any, b: any) => {
    if (sortMode === 'priority') {
      const pa = a.priority || 3;
      const pb = b.priority || 3;
      if (pa !== pb) return pa - pb;
    }
    if (sortMode === 'dueDate' || sortMode === 'priority') {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  // Priority mode: create priority group nodes
  if (sortMode === 'priority') {
    const createdLevels = new Set<number>();
    sortedTodos.forEach((todo: any) => {
      const p = todo.priority || 3;
      if (!createdLevels.has(p)) {
        createdLevels.add(p);
        const levelId = `tasklevel-${page.id}-p${p}`;
        const levelColor = ['#000', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4'][p];
        newNodes.push({
          id: levelId,
          type: 'rowNode',
          data: {
            label: `P${p}`,
            icon: priorityIcons[p],
            color: '',
            columns: [
              { colId: 'tasks', colName: 'Tasks', value: `${sortedTodos.filter((t: any) => (t.priority || 3) === p).length} items`, type: 'text', color: levelColor },
            ],
            backgroundColor: levelColor,
            textColor: '#fff',
            pageType: 'priority',
          },
          position: { x: 0, y: 0 },
        });
        newEdges.push({
          id: `edge-level-${page.id}-p${p}`,
          source: `page-${page.id}`,
          target: levelId,
          animated: true,
          style: { stroke: 'rgba(168, 85, 247, 0.5)', strokeWidth: 2, strokeDasharray: '4,3' },
        });
      }
      pushTaskNode(todo, `tasklevel-${page.id}-p${p}`, 'col-tasks', true);
    });
  } else {
    // Flat mode (default / dueDate)
    sortedTodos.forEach((todo: any) => {
      pushTaskNode(todo, `page-${page.id}`);
    });
  }
}

import { isVideoUrl } from '../../lib/media'

/* ── Gallery sub-graph: render each image/video as a node ── */
function buildGallerySubGraph(
  page: any,
  projectTags: { name: string; color: string }[],
  newNodes: any[],
  newEdges: any[],
) {
  const items: any[] = page.content || [];

  // Tag-sort mode: group images under ALL their tags
  if (page.metadata?.sortMode === 'tags') {
    // Collect all unique tags across all items
    const allUniqueTags = new Set<string>();
    const hasUntagged = items.some((i: any) => !i.tags?.length);
    items.forEach((item: any) => {
      if (item.tags?.length) item.tags.forEach((t: string) => allUniqueTags.add(t));
    });

    const sortedTags = Array.from(allUniqueTags).sort();
    const allTagNames = [...sortedTags, ...(hasUntagged ? ['__untagged__'] : [])];

    allTagNames.forEach((tag) => {
      const groupId = `taggroup-${page.id}-${tag}`;
      const isUntagged = tag === '__untagged__';
      const galleryTags = page.metadata?.galleryTags || [];
      const tagDef = isUntagged ? null : galleryTags.find((t: any) => t.name === tag) || projectTags.find(t => t.name === tag) || GALLERY_DEFAULT_TAGS.find(t => t.name === tag);
      const tagBg = tagDef?.color || '#a855f7';
      newNodes.push({
        id: groupId,
        type: 'valueNode',
        data: {
          label: isUntagged ? 'Untagged' : `#${tag}`,
          icon: 'Hash',
          backgroundColor: tagBg,
          textColor: getContrastColor(tagBg),
        },
        position: { x: 0, y: 0 },
      });
      newEdges.push({
        id: `edge-taggroup-${page.id}-${tag}`,
        source: `page-${page.id}`,
        target: groupId,
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.4)', strokeWidth: 2, strokeDasharray: '4,3' },
      });
    });

    // Create image/video nodes and link them to ALL their tag-group nodes
    const createdNodeIds = new Set<string>();
    items.forEach((item: any) => {
      if (!item.id || !item.title) return;
      const isVideo = isVideoUrl(item.url || '');
      const nodeId = `img-${page.id}-${item.id}`;
      if (createdNodeIds.has(nodeId)) return;
      createdNodeIds.add(nodeId);

      newNodes.push({
        id: nodeId,
        type: 'valueNode',
        data: {
          label: item.title.substring(0, 20),
          icon: isVideo ? 'videocam' : 'image',
          backgroundColor: isVideo ? '#a855f7' : '#06b6d4',
          textColor: '#fff',
          imgUrl: item.url,
        },
        position: { x: 0, y: 0 },
      });

      // Create edges from EACH tag this item belongs to
      if (item.tags?.length) {
        item.tags.forEach((tag: string) => {
          if (allUniqueTags.has(tag)) {
            newEdges.push({
              id: `edge-img-${page.id}-${item.id}-${tag}`,
              source: `taggroup-${page.id}-${tag}`,
              target: nodeId,
              sourceHandle: `img-${item.id}`,
              animated: true,
              style: { stroke: 'rgba(6, 182, 212, 0.5)', strokeWidth: 2 },
            });
          }
        });
      } else if (hasUntagged) {
        newEdges.push({
          id: `edge-img-${page.id}-${item.id}-__untagged__`,
          source: `taggroup-${page.id}-__untagged__`,
          target: nodeId,
          sourceHandle: `img-${item.id}`,
          animated: true,
          style: { stroke: 'rgba(6, 182, 212, 0.5)', strokeWidth: 2 },
        });
      }
    });
    return;
  }

  // ── Default flat mode ──
  items.forEach((item: any) => {
    if (!item.id || !item.title) return;
    const isVideo = isVideoUrl(item.url || '');
    const nodeId = `img-${page.id}-${item.id}`;
    newNodes.push({
      id: nodeId,
      type: 'valueNode',
      data: {
        label: item.title.substring(0, 20),
        icon: isVideo ? 'videocam' : 'image',
        backgroundColor: isVideo ? '#a855f7' : '#06b6d4',
        textColor: '#fff',
        imgUrl: item.url,
      },
      position: { x: 0, y: 0 },
    });
    newEdges.push({
      id: `edge-img-${page.id}-${item.id}`,
      source: `page-${page.id}`,
      target: nodeId,
      animated: true,
      style: { stroke: isVideo ? 'rgba(168, 85, 247, 0.5)' : 'rgba(6, 182, 212, 0.5)', strokeWidth: 2 },
    });
  });
}

/* ── Board sub-graph: render columns and cards ── */
function buildBoardSubGraph(
  page: any,
  projectTags: { name: string; color: string }[],
  newNodes: any[],
  newEdges: any[],
) {
  const cols: any[] = page.metadata?.boardColumns || [];
  const cards: any[] = page.content || [];

  // Tag-sort mode: group cards under ALL their tags (replaces column grouping)
  if (page.metadata?.sortMode === 'tags') {
    // Collect all unique tags across all cards
    const allUniqueTags = new Set<string>();
    const hasUntagged = cards.some((c: any) => !c.tags?.length);
    cards.forEach((card: any) => {
      if (card.tags?.length) card.tags.forEach((t: string) => allUniqueTags.add(t));
    });

    const sortedTags = Array.from(allUniqueTags).sort();
    const allTagNames = [...sortedTags, ...(hasUntagged ? ['__untagged__'] : [])];

    // Create tag-group nodes for each unique tag
    allTagNames.forEach((tag) => {
      const groupId = `boardtag-${page.id}-${tag}`;
      const isUntagged = tag === '__untagged__';
      const boardTags = page.metadata?.boardTags || [];
      const tagDef = isUntagged ? null : boardTags.find((t: any) => t.name === tag) || projectTags.find(t => t.name === tag) || BOARD_DEFAULT_TAGS.find(t => t.name === tag);
      const tagBg = tagDef?.color || '#a855f7';
      newNodes.push({
        id: groupId,
        type: 'valueNode',
        data: {
          label: isUntagged ? 'Untagged' : `#${tag}`,
          icon: 'Hash',
          backgroundColor: tagBg,
          textColor: getContrastColor(tagBg),
        },
        position: { x: 0, y: 0 },
      });
      newEdges.push({
        id: `edge-boardtag-${page.id}-${tag}`,
        source: `page-${page.id}`,
        target: groupId,
        animated: true,
        style: { stroke: 'rgba(168, 85, 247, 0.4)', strokeWidth: 2, strokeDasharray: '4,3' },
      });
    });

    // Create card nodes and link them to ALL their tag-group nodes
    const createdNodeIds = new Set<string>();
    cards.forEach((card: any) => {
      if (!card.id || !card.title) return;
      const cardNodeId = `boardcard-${page.id}-${card.id}`;
      if (createdNodeIds.has(cardNodeId)) return;
      createdNodeIds.add(cardNodeId);

      newNodes.push({
        id: cardNodeId,
        type: 'valueNode',
        data: {
          label: card.title.substring(0, 20),
          icon: 'sticky_note_2',
          backgroundColor: '#a78bfa',
          textColor: '#fff',
        },
        position: { x: 0, y: 0 },
      });

      // Create edges from EACH tag this card belongs to
      if (card.tags?.length) {
        card.tags.forEach((tag: string) => {
          if (allUniqueTags.has(tag)) {
            newEdges.push({
              id: `edge-boardcard-${page.id}-${card.id}-${tag}`,
              source: `boardtag-${page.id}-${tag}`,
              target: cardNodeId,
              sourceHandle: `card-${card.id}`,
              animated: true,
              style: { stroke: 'rgba(139, 92, 246, 0.5)', strokeWidth: 2 },
            });
          }
        });
      } else if (hasUntagged) {
        newEdges.push({
          id: `edge-boardcard-${page.id}-${card.id}-__untagged__`,
          source: `boardtag-${page.id}-__untagged__`,
          target: cardNodeId,
          sourceHandle: `card-${card.id}`,
          animated: true,
          style: { stroke: 'rgba(139, 92, 246, 0.5)', strokeWidth: 2 },
        });
      }
    });
    return;
  }

  // ── Default mode: group by columns ──
  const createdColNodes = new Set<string>();

  cards.forEach((card: any) => {
    if (!card.id || !card.title) return;
    const colId = card.columnId;
    const colDef = cols.find((c: any) => c.id === colId);
    const colNodeId = `boardcol-${page.id}-${colId}`;

    if (colDef && !createdColNodes.has(colId)) {
      createdColNodes.add(colId);
      const colBg = colDef.color || '#f59e0b';
      newNodes.push({
        id: colNodeId,
        type: 'valueNode',
        data: {
          label: colDef.title.substring(0, 20),
          icon: 'view_column',
          backgroundColor: colBg,
          textColor: getContrastColor(colBg),
          showRightHandle: true,
        },
        position: { x: 0, y: 0 },
      });
      newEdges.push({
        id: `edge-boardcol-${page.id}-${colId}`,
        source: `page-${page.id}`,
        target: colNodeId,
        animated: true,
        style: { stroke: 'rgba(251, 191, 36, 0.4)', strokeWidth: 1.5 },
      });
    }

    const cardNodeId = `boardcard-${page.id}-${card.id}`;
    const cardBg = colDef?.color || '#a78bfa';
    newNodes.push({
      id: cardNodeId,
      type: 'valueNode',
      data: {
        label: card.title.substring(0, 20),
        icon: 'sticky_note_2',
        backgroundColor: cardBg,
        textColor: getContrastColor(cardBg),
      },
      position: { x: 0, y: 0 },
    });
    newEdges.push({
      id: `edge-boardcard-${page.id}-${card.id}`,
      source: colDef ? colNodeId : `page-${page.id}`,
      sourceHandle: colDef ? 'right' : undefined,
      target: cardNodeId,
      animated: true,
      style: { stroke: 'rgba(139, 92, 246, 0.5)', strokeWidth: 2 },
    });
  });
}

/* ── File sub-graph: render each attached file as a node ── */
function buildFileSubGraph(
  page: any,
  newNodes: any[],
  newEdges: any[],
) {
  const items: any[] = page.content || [];

  // Simple flat mode — each file is a node
  items.forEach((item: any) => {
    if (!item.id || !item.originalName) return;
    const ext = (item.originalName || '').split('.').pop()?.toLowerCase() || '';
    const iconMap: Record<string, string> = {
      pdf: 'picture_as_pdf', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image',
      txt: 'text_snippet', csv: 'table_rows', json: 'code', xml: 'code',
      js: 'javascript', ts: 'javascript', py: 'code', rs: 'code', go: 'code',
      html: 'html', css: 'css', md: 'article', zip: 'folder_zip', exe: 'terminal',
      mp3: 'audio_file', wav: 'audio_file', mp4: 'video_file', mov: 'video_file',
      doc: 'description', docx: 'description', xls: 'table_chart', xlsx: 'table_chart',
      ppt: 'slideshow', pptx: 'slideshow',
    };
    const icon = iconMap[ext] || 'insert_drive_file';

    const nodeId = `file-${page.id}-${item.id}`;
    newNodes.push({
      id: nodeId,
      type: 'valueNode',
      data: {
        label: item.originalName.substring(0, 18),
        icon,
        backgroundColor: '#f59e0b',
        textColor: '#fff',
      },
      position: { x: 0, y: 0 },
    });
    newEdges.push({
      id: `edge-file-${page.id}-${item.id}`,
      source: `page-${page.id}`,
      target: nodeId,
      animated: true,
      style: { stroke: 'rgba(245, 158, 11, 0.5)', strokeWidth: 2 },
    });
  });
}

/* ── Media sub-graph: render each audio/video recording as a node ── */
function buildMediaSubGraph(
  page: any,
  newNodes: any[],
  newEdges: any[],
  mediaType: 'audio' | 'video',
) {
  const items: any[] = page.content || [];
  const isVideo = mediaType === 'video';
  const bgColor = isVideo ? '#a855f7' : '#06b6d4';
  const edgeColor = isVideo ? 'rgba(168, 85, 247, 0.5)' : 'rgba(6, 182, 212, 0.5)';
  const icon = isVideo ? 'videocam' : 'mic';

  items.forEach((item: any) => {
    if (!item.id) return;
    const label = item.title || item.name || `${mediaType} ${new Date(item.created_at || Date.now()).toLocaleString()}`;
    const nodeId = `${mediaType === 'video' ? 'vid' : 'aud'}-${page.id}-${item.id}`;
    newNodes.push({
      id: nodeId,
      type: 'valueNode',
      data: {
        label: label.substring(0, 22),
        icon,
        backgroundColor: bgColor,
        textColor: '#fff',
      },
      position: { x: 0, y: 0 },
    });
    newEdges.push({
      id: `edge-${mediaType}-${page.id}-${item.id}`,
      source: `page-${page.id}`,
      target: nodeId,
      animated: true,
      style: { stroke: edgeColor, strokeWidth: 2 },
    });
  });
}

// Parse pageLinkBlock references from any page's content and create cross-reference edges
function buildPageLinkCrossEdges(
  page: any,
  projectPages: any[],
  newEdges: any[],
) {
  const pageLinkRefs: { targetId: string; targetTitle: string }[] = [];

  const extractRefs = (node: any) => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'pageLinkBlock' && node.attrs?.pageId) {
      const linkedPage = projectPages.find(p => p.id === node.attrs.pageId);
      pageLinkRefs.push({
        targetId: node.attrs.pageId,
        targetTitle: linkedPage?.title || node.attrs.pageTitle || 'Untitled',
      });
    }
    if (node.type === 'galleryImageBlock' && node.attrs?.pageId && node.attrs?.itemId) {
      const targetId = `img-${node.attrs.pageId}-${node.attrs.itemId}`;
      const edgeId = `edge-gallery-link-${page.id}-${node.attrs.itemId}`;
      if (!newEdges.some(e => e.id === edgeId)) {
        newEdges.push({
          id: edgeId,
          source: `page-${page.id}`,
          target: targetId,
          animated: true,
          style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
        });
      }
    }
    if (node.type === 'boardCardBlock' && node.attrs?.pageId && node.attrs?.cardId) {
      const targetId = `boardcard-${node.attrs.pageId}-${node.attrs.cardId}`;
      const edgeId = `edge-boardcard-link-${page.id}-${node.attrs.cardId}`;
      if (!newEdges.some(e => e.id === edgeId)) {
        newEdges.push({
          id: edgeId,
          source: `page-${page.id}`,
          target: targetId,
          animated: true,
          style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
        });
      }
    }
    if (Array.isArray(node.content)) {
      node.content.forEach(extractRefs);
    } else if (node.content && typeof node.content === 'object') {
      extractRefs(node.content);
    }
  };

  if (Array.isArray(page.content)) {
    page.content.forEach(extractRefs);
  } else if (page.content && typeof page.content === 'object') {
    const doc = page.content as any;
    if (Array.isArray(doc.content)) {
      doc.content.forEach(extractRefs);
    } else if (doc.type) {
      extractRefs(doc);
    }
  }

  // Also read links stored in metadata (used by non-text pages)
  if (page.metadata?.links && Array.isArray(page.metadata.links)) {
    page.metadata.links.forEach((link: any) => {
      if (!link.targetPageId) return;
      const linkedPage = projectPages.find(p => p.id === link.targetPageId);
      pageLinkRefs.push({
        targetId: link.targetPageId,
        targetTitle: linkedPage?.title || link.targetTitle || 'Untitled',
      });
    });
  }

  // Create cross-reference edges (deduplicated)
  const seenTargets = new Set<string>();
  pageLinkRefs.forEach((ref) => {
    if (seenTargets.has(ref.targetId)) return;
    seenTargets.add(ref.targetId);
    const targetPageExists = projectPages.find(p => p.id === ref.targetId);
    if (!targetPageExists) return;
    const isParentChild = projectPages.some(p => p.id === ref.targetId && p.metadata?.parentId === page.id);
    if (isParentChild) return;
    // Skip if this edge already exists (e.g., from table sub-graph)
    const edgeId = `edge-linkblock-${page.id}-${ref.targetId}`;
    if (newEdges.some(e => e.id === edgeId)) return;
    newEdges.push({
      id: edgeId,
      source: `page-${page.id}`,
      target: `page-${ref.targetId}`,
      animated: true,
      style: { stroke: 'rgba(251, 191, 36, 0.5)', strokeWidth: 1.5, strokeDasharray: '5,4' },
    });
  });
}
