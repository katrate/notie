import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
}

export const useGraphStore = create<GraphState>((set) => ({
  nodes: [],
  edges: [],
  loading: false,

  fetchGraphData: async (projectId: string) => {
    set({ loading: true })
    
    // Fetch Nodes
    const { data: nodesData } = await supabase
      .from('graph_nodes')
      .select('*')
      .eq('project_id', projectId)

    // Fetch Edges
    const { data: edgesData } = await supabase
      .from('graph_edges')
      .select('*')
      .eq('project_id', projectId)

    set({ 
      nodes: (nodesData as GraphNode[]) || [], 
      edges: (edgesData as GraphEdge[]) || [],
      loading: false 
    })
  },

  addNode: async (node) => {
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) return

    const { data, error } = await supabase
      .from('graph_nodes')
      .insert({ ...node, user_id: userData.user.id })
      .select()
      .single()

    if (!error && data) {
      set((state) => ({ nodes: [...state.nodes, data as GraphNode] }))
    }
  }
}))
