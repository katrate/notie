import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { useProjectStore, type Page } from './projectStore'

export interface TemplateNode {
  title: string
  icon: string
  type: string
  tags?: string[]
  children: TemplateNode[]
}

export interface Template {
  id: string
  user_id: string
  name: string
  description: string
  icon: string
  structure: TemplateNode
  created_at: string
  updated_at: string
}

interface TemplateState {
  templates: Template[]
  loading: boolean
  error: string | null
  fetchTemplates: () => Promise<void>
  savePageAsTemplate: (pageId: string, name: string, description?: string) => Promise<Template | null>
  updateTemplateStructure: (templateId: string, pageId: string) => Promise<void>
  deleteTemplate: (templateId: string) => Promise<void>
}

/**
 * Recursively build a template structure tree from a page and its descendants.
 * Strips out content/data – only captures title, icon, type, and child structure.
 */
function buildStructure(pageId: string, allPages: Page[]): TemplateNode {
  const page = allPages.find(p => p.id === pageId)
  if (!page) return { title: 'Untitled', icon: 'description', type: 'text', children: [] }

  const children = allPages
    .filter(p => p.metadata?.parentId === pageId)
    .sort((a, b) => (a.position || 0) - (b.position || 0))

  return {
    title: page.title,
    icon: page.icon || 'description',
    type: page.type || 'text',
    tags: page.metadata?.tags?.length ? [...page.metadata.tags] : undefined,
    children: children.map(child => buildStructure(child.id, allPages)),
  }
}

export const useTemplateStore = create<TemplateState>((set) => ({
  templates: [],
  loading: false,
  error: null,

  fetchTemplates: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set({ templates: data as Template[], loading: false })
    }
  },

  savePageAsTemplate: async (pageId: string, name: string, description = ''): Promise<Template | null> => {
    set({ loading: true, error: null })

    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      set({ error: 'Not authenticated', loading: false })
      return null
    }

    const allPages = useProjectStore.getState().pages
    const page = allPages.find(p => p.id === pageId)
    if (!page) {
      set({ error: 'Page not found', loading: false })
      return null
    }

    const structure = buildStructure(pageId, allPages)

    const { data, error } = await supabase
      .from('templates')
      .insert({
        user_id: userData.user.id,
        name,
        description,
        icon: page.icon || 'description',
        structure,
      })
      .select()
      .single()

    if (error) {
      set({ error: error.message, loading: false })
      return null
    }

    const template = data as Template
    set(state => ({ templates: [template, ...state.templates], loading: false }))
    return template
  },

  updateTemplateStructure: async (templateId: string, pageId: string) => {
    set({ loading: true, error: null })

    const allPages = useProjectStore.getState().pages
    const page = allPages.find(p => p.id === pageId)
    if (!page) {
      set({ error: 'Page not found', loading: false })
      return
    }

    const structure = buildStructure(pageId, allPages)

    const { error } = await supabase
      .from('templates')
      .update({
        structure,
        icon: page.icon || 'description',
        updated_at: new Date().toISOString(),
      })
      .eq('id', templateId)

    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set(state => ({
        templates: state.templates.map(t =>
          t.id === templateId ? { ...t, structure, icon: page.icon || 'description' } : t
        ),
        loading: false,
      }))
    }
  },

  deleteTemplate: async (templateId: string) => {
    set({ loading: true, error: null })
    const { error } = await supabase
      .from('templates')
      .delete()
      .eq('id', templateId)

    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set(state => ({
        templates: state.templates.filter(t => t.id !== templateId),
        loading: false,
      }))
    }
  },
}))
