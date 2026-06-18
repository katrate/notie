import { create } from 'zustand'

function requireApi() {
  if (!window.electronAPI) throw new Error('Electron API is unavailable')
  return window.electronAPI
}

export interface GraphNode {
  id: string;
  project_id: string;
  source_type: string;
  source_id: string | null;
  label: string;
  node_type: string;
  color: string | null;
  position_x: number;
  position_y: number;
}

export interface GraphEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  edge_type: string;
  label: string | null;
}

interface GraphState {
  nodes: GraphNode[];
  edges: GraphEdge[];
  loading: boolean;
  
  fetchGraphData: (projectId: string) => Promise<void>;
  addNode: (node: Partial<GraphNode>) => Promise<void>;
  reset: () => void;
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  loading: false,

  fetchGraphData: async (projectId: string) => {
    set({ loading: true })
    const result = await requireApi().fetchGraphData(projectId)

    set({ 
      nodes: (result.data?.nodes as GraphNode[]) || [], 
      edges: (result.data?.edges as GraphEdge[]) || [],
      loading: false 
    })
  },

  reset: () => set({ nodes: [], edges: [], loading: false }),
  addNode: async (node) => {
    const { data, error } = await requireApi().addGraphNode(node)

    if (!error && data) {
      set((state) => ({ nodes: [...state.nodes, data as GraphNode] }))
    }
  }
}))
