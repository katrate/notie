import { create } from 'zustand'
import { supabase } from '../lib/supabase'

// Track the latest save request to avoid stale updates overwriting newer ones
let _lastSaveId = 0;

// Save last session to the user's profile settings in Supabase
// Merges with existing settings rather than overwriting
async function saveLastSession(projectId: string | null, pageId: string | null) {
  const saveId = ++_lastSaveId;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    // Only apply this save if no newer save has been requested
    if (saveId !== _lastSaveId) return;
    // Read current settings first to avoid overwriting other keys
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userData.user.id)
      .maybeSingle();
    const currentSettings = (profile?.settings as Record<string, any>) || {};
    if (saveId !== _lastSaveId) return;
    await supabase
      .from('profiles')
      .update({
        settings: { ...currentSettings, lastProjectId: projectId, lastPageId: pageId }
      })
      .eq('id', userData.user.id);
  } catch (err) {
    console.error('Failed to save session:', err);
  }
}

// Separate save-ID counter for expanded projects (avoid conflict with session saves)
let _lastExpandedSaveId = 0;

export async function saveExpandedProjects(projectIds: string[]): Promise<void> {
  const saveId = ++_lastExpandedSaveId;
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userData.user.id)
      .maybeSingle();
    const currentSettings = (profile?.settings as Record<string, any>) || {};
    // Only apply if no newer save was requested
    if (saveId !== _lastExpandedSaveId) return;
    await supabase
      .from('profiles')
      .update({
        settings: { ...currentSettings, expandedProjects: projectIds }
      })
      .eq('id', userData.user.id);
  } catch (err) {
    console.error('Failed to save expanded projects:', err);
  }
}

export async function fetchExpandedProjects(): Promise<string[]> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return [];
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userData.user.id)
      .maybeSingle();
    const settings = (profile?.settings as Record<string, any>) || {};
    return settings.expandedProjects || [];
  } catch (err) {
    console.error('Failed to fetch expanded projects:', err);
    return [];
  }
}

export async function fetchLastSession(): Promise<{ lastProjectId: string | null; lastPageId: string | null }> {
  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return { lastProjectId: null, lastPageId: null };
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userData.user.id)
      .maybeSingle();
    const settings = (profile?.settings as Record<string, any>) || {};
    return {
      lastProjectId: settings.lastProjectId || null,
      lastPageId: settings.lastPageId || null,
    };
  } catch (err) {
    console.error('Failed to fetch session:', err);
    return { lastProjectId: null, lastPageId: null };
  }
}

export async function checkNeedsOnboarding(userId: string): Promise<boolean> {
  try {
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle();
    // First login if no profile exists or settings are completely empty
    if (!profile || !profile.settings) return true;
    const settings = profile.settings as Record<string, any>;
    // Only these keys mean onboarding was never completed
    if (settings.onboardingCompleted) return false;
    // Has existing session data = not a first-time user
    if (settings.lastProjectId || settings.lastPageId || settings.expandedProjects) return false;
    return true;
  } catch {
    return false;
  }
}

export async function saveOnboardingSettings(
  userId: string,
  theme: string,
  accentColor: string,
  backgroundColor: string
): Promise<void> {
  try {
    // Read current settings first
    const { data: profile } = await supabase
      .from('profiles')
      .select('settings')
      .eq('id', userId)
      .maybeSingle();
    const currentSettings = (profile?.settings as Record<string, any>) || {};
    await supabase
      .from('profiles')
      .upsert({
        id: userId,
        settings: {
          ...currentSettings,
          theme,
          accentColor,
          backgroundColor,
          onboardingCompleted: true,
        },
      });
  } catch (err) {
    console.error('Failed to save onboarding settings:', err);
  }
}

export interface Project {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  layout_type: string;
  is_favorite: boolean;
  position: number;
  settings?: any;
}

export interface Page {
  id: string;
  project_id?: string;  // nullable — standalone pages have no project
  title: string;
  icon: string;
  content: any;
  type?: string;
  metadata?: any;
  position?: number;
}

export type ViewMode = 'graph' | 'editor' | 'both';

interface ProjectState {
  projects: Project[];
  pages: Page[];
  activeProjectId: string | null;
  activePageId: string | null;
  loading: boolean;
  error: string | null;
  
  fetchProjects: () => Promise<void>;
  fetchPages: (projectId: string) => Promise<void>;
  createProject: (name: string, layout_type?: string) => Promise<void>;
  createPage: (projectId: string, title?: string, type?: string, metadata?: any, icon?: string) => Promise<Page | null>;
  createStandalonePage: (title?: string, type?: string, icon?: string) => Promise<Page | null>;
  fetchStandalonePages: () => Promise<void>;
  movePageToProject: (pageId: string, projectId: string) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  deletePage: (pageId: string) => Promise<void>;
  setActiveProject: (id: string | null) => void;
  setActivePage: (id: string | null) => void;
  updatePageContent: (pageId: string, content: any) => Promise<void>;
  updatePage: (pageId: string, updates: Partial<Page>) => Promise<void>;
  updateProject: (projectId: string, updates: Partial<Project>) => Promise<void>;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sidebarVisible: boolean;
  setSidebarVisible: (visible: boolean) => void;
  pendingGraphLink: { sourcePageId: string; targetPageId: string } | null;
  setPendingGraphLink: (link: { sourcePageId: string; targetPageId: string } | null) => void;
  graphEditorInsert: null | ((pageId: string, targetPageId: string, targetTitle: string, targetIcon: string) => void);
  setGraphEditorInsert: (fn: ((pageId: string, targetPageId: string, targetTitle: string, targetIcon: string) => void) | null) => void;
  navigateToPage: (projectId: string, pageId: string) => void;
  sessionRestored: boolean;
  setSessionRestored: (val: boolean) => void;
  getProjectTags: (projectId: string) => { name: string; color: string }[];
  addProjectTag: (projectId: string, name: string, color: string) => Promise<void>;
  removeProjectTag: (projectId: string, name: string) => Promise<void>;
  updateProjectTag: (projectId: string, oldName: string, newName: string, color: string) => Promise<void>;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  pages: [],
  activeProjectId: null,
  activePageId: null,
  viewMode: 'both' as ViewMode,
  sidebarVisible: true,
  pendingGraphLink: null,
  graphEditorInsert: null,
  sessionRestored: false,
  loading: false,
  error: null,

  fetchProjects: async () => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false })

    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set({ projects: data as Project[], loading: false })
    }
  },

  fetchPages: async (projectId: string) => {
    set({ loading: true, error: null })
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      set({ error: error.message, loading: false })
    } else if (data) {
      // Merge new pages with existing ones, removing any old pages for this project
      set(state => {
        const withoutOld = state.pages.filter(p => p.project_id !== projectId)
        return { pages: [...withoutOld, ...(data as Page[])], loading: false }
      })
    }
  },

  createProject: async (name: string, layout_type = 'document') => {
    set({ loading: true, error: null })
    const { data: userData } = await supabase.auth.getUser()
    if (!userData.user) {
      set({ error: 'Not authenticated', loading: false })
      return
    }

    const newProject = {
      name,
      layout_type,
      icon: 'folder',
      user_id: userData.user.id
    }

    const { data, error } = await supabase
      .from('projects')
      .insert(newProject)
      .select()
      .single()

    if (error) {
      set({ error: error.message, loading: false })
    } else if (data) {
      set((state) => ({
        projects: [data as Project, ...state.projects],
        activeProjectId: data.id,
        loading: false,
      }))

      // Auto-create a protected dashboard page for the new project
      await get().createPage(data.id, 'Dashboard', 'dashboard', { isProtected: true }, 'dashboard')
    }
  },

  createStandalonePage: async (_title = 'Untitled', type = 'text', icon?: string) => {
    set({ loading: true, error: null });
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      set({ error: 'Not authenticated', loading: false });
      return null;
    }
    const newPage = {
      project_id: null,
      title: _title,
      type,
      metadata: { isStandalone: true },
      icon: icon || null,
      user_id: userData.user.id,
    };
    const { data, error } = await supabase
      .from('pages')
      .insert(newPage)
      .select()
      .single();
    if (error) {
      set({ error: error.message, loading: false });
      return null;
    } else if (data) {
      set(state => ({
        pages: [...state.pages, data as Page],
        activePageId: data.id,
        loading: false,
      }));
      saveLastSession(null, data.id);
      return data as Page;
    }
    return null;
  },

  fetchStandalonePages: async () => {
    set({ loading: true, error: null });
    const { data, error } = await supabase
      .from('pages')
      .select('*')
      .is('project_id', null)
      .order('created_at', { ascending: false });
    if (error) {
      set({ error: error.message, loading: false });
    } else if (data) {
      set(state => {
        // Remove old standalone pages, add fresh ones
        const withoutOld = state.pages.filter(p => p.project_id !== undefined && p.project_id !== null);
        return { pages: [...withoutOld, ...(data as Page[])], loading: false };
      });
    }
  },

  movePageToProject: async (pageId: string, projectId: string) => {
    const state = get();
    const page = state.pages.find(p => p.id === pageId);
    if (!page) return;
    const wasActive = state.activePageId === pageId;
    // Update locally
    set(s => ({
      activeProjectId: wasActive ? projectId : s.activeProjectId,
      pages: s.pages.map(p => p.id === pageId ? { ...p, project_id: projectId, metadata: { ...(p.metadata || {}), isStandalone: undefined, addedToProjectAt: new Date().toISOString() } } : p),
    }));
    if (wasActive) saveLastSession(projectId, pageId);
    // Update in DB
    const { error } = await supabase
      .from('pages')
      .update({ project_id: projectId, metadata: { ...(page.metadata || {}), isStandalone: undefined, addedToProjectAt: new Date().toISOString() }, updated_at: new Date().toISOString() })
      .eq('id', pageId);
    if (error) console.error('Failed to move page to project:', error);
  },

  createPage: async (projectId: string, _title = 'Untitled', type = 'text', metadata: any = {}, icon?: string) => {
    set({ loading: true, error: null });
    if (!projectId) {
      console.warn('createPage called without a valid projectId, aborting');
      set({ error: 'Cannot create page: no project selected', loading: false });
      return null;
    }
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      set({ error: 'Not authenticated', loading: false });
      return null;
    }
    const title = type === 'dashboard' ? 'Dashboard' : _title;
    const forceIcon = type === 'dashboard' ? 'dashboard_customize' : icon;
    const newPage = {
      project_id: projectId,
      title,
      type,
      metadata: { ...metadata, isProtected: type === 'dashboard' ? true : (metadata?.isProtected || false) },
      icon: forceIcon || null,
      user_id: userData.user.id,
    };
    const { data, error } = await supabase
      .from('pages')
      .insert(newPage)
      .select()
      .single();
    if (error) {
      set({ error: error.message, loading: false });
      return null;
    } else if (data) {
      set(state => ({
        pages: [...state.pages, data as Page],
        activePageId: data.id,
        loading: false,
      }));
      saveLastSession(projectId, data.id);
      return data as Page;
    }
    return null;
  },

  deleteProject: async (projectId: string) => {
    set({ loading: true, error: null })
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
    if (error) {
      set({ error: error.message, loading: false })
    } else {
      set(state => ({
        projects: state.projects.filter(p => p.id !== projectId),
        pages: state.pages.filter(p => p.project_id !== projectId),
        activeProjectId: state.activeProjectId === projectId ? null : state.activeProjectId,
        activePageId: state.activeProjectId === projectId ? null : state.activePageId,
        loading: false,
      }))
    }
  },

  deletePage: async (pageId: string) => {
    const { pages } = get()
    const target = pages.find(p => p.id === pageId)
    if (target?.metadata?.isProtected) return

    set({ loading: true, error: null });
    
    // First, determine all descendant IDs locally
    const state = get();
    const idsToRemove = new Set<string>([pageId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const p of state.pages) {
        if (!idsToRemove.has(p.id) && p.metadata?.parentId && idsToRemove.has(p.metadata.parentId)) {
          idsToRemove.add(p.id);
          changed = true;
        }
      }
    }

    const idsArray = Array.from(idsToRemove);

    // Delete all collected IDs from the database
    const { error } = await supabase
      .from('pages')
      .delete()
      .in('id', idsArray);
      
    if (error) {
      set({ error: error.message, loading: false });
    } else {
      set(state => ({
        pages: state.pages.filter(p => !idsToRemove.has(p.id)),
        activePageId: idsToRemove.has(state.activePageId || '') ? null : state.activePageId,
        loading: false,
      }));
    }
  },

  setActiveProject: async (id) => {
    // Keep standalone pages (no project_id) when switching projects
    set(state => ({
      activeProjectId: id,
      activePageId: null,
      pages: state.pages.filter(p => !p.project_id),
    }))
    if (id) {
      saveLastSession(id, null);
      await get().fetchPages(id)
      const { pages } = get()
      const projectPages = pages.filter(p => p.project_id === id)
      if (projectPages.length === 0) {
        const dashboard = await get().createPage(id, 'Dashboard', 'dashboard', { isProtected: true }, 'dashboard')
        if (dashboard) {
          set({ activePageId: dashboard.id })
          saveLastSession(id, dashboard.id)
        }
      } else {
        const firstProtected = projectPages.find(p => p.metadata?.isProtected)
        const firstPage = firstProtected || projectPages[0]
        set({ activePageId: firstPage.id })
        saveLastSession(id, firstPage.id)
      }
    } else {
      saveLastSession(null, null);
      // Re-fetch standalone pages to get latest
      await get().fetchStandalonePages();
      // If there's a standalone page, navigate to it; otherwise leave activePageId null
    }
  },

  setActivePage: (id) => {
    const { pages, activeProjectId } = get();
    if (id) {
      const page = pages.find(p => p.id === id);
      if (page) {
        // If page has a project_id, ensure activeProjectId matches it
        if (page.project_id) {
          if (activeProjectId !== page.project_id) {
            set({ activePageId: id, activeProjectId: page.project_id });
            saveLastSession(page.project_id, id);
            return;
          }
          set({ activePageId: id });
          saveLastSession(page.project_id, id);
          return;
        }
        // Standalone page (no project_id) — clear activeProjectId
        set({ activePageId: id, activeProjectId: null });
        saveLastSession(null, id);
        return;
      }
    }
    set({ activePageId: id });
    saveLastSession(activeProjectId, id);
  },
  setViewMode: (mode) => set({ viewMode: mode }),
  setSidebarVisible: (visible) => set({ sidebarVisible: visible }),

  updatePageContent: async (pageId, content) => {
    set(state => ({
      pages: state.pages.map(p => p.id === pageId ? { ...p, content } : p)
    }))
    const { error } = await supabase.from('pages').update({ content, updated_at: new Date().toISOString() }).eq('id', pageId)
    if (error) console.error('Failed to save page content:', error)
  },

  updatePage: async (pageId, updates) => {
    const page = get().pages.find(p => p.id === pageId);
    if (page?.type === 'dashboard') {
      const safe = { ...updates };
      delete safe.title;
      delete safe.icon;
      delete safe.type;
      if (Object.keys(safe).length === 0) return;
      updates = safe;
    }
    set(state => ({
      pages: state.pages.map(p => p.id === pageId ? { ...p, ...updates } : p)
    }))
    const { error } = await supabase.from('pages').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', pageId)
    if (error) console.error('Failed to update page:', error)
  },

  updateProject: async (projectId, updates) => {
    set(state => ({
      projects: state.projects.map(p => p.id === projectId ? { ...p, ...updates } : p)
    }))
    const { error } = await supabase.from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', projectId)
    if (error) console.error('Failed to update project:', error)
  },

  setPendingGraphLink: (link) => set({ pendingGraphLink: link }),

  setGraphEditorInsert: (fn) => set({ graphEditorInsert: fn }),

  navigateToPage: (projectId: string, pageId: string) => {
    const state = get();
    // If switching projects, load pages first
    if (state.activeProjectId !== projectId) {
      // Keep standalone pages when switching projects
      set(state => ({ activeProjectId: projectId, activePageId: null, pages: state.pages.filter(p => !p.project_id) }));
      saveLastSession(projectId, null);
      get().fetchPages(projectId).then(() => {
        set({ activePageId: pageId });
        saveLastSession(projectId, pageId);
      });
    } else {
      set({ activePageId: pageId });
      saveLastSession(projectId, pageId);
    }
  },

  setSessionRestored: (val) => set({ sessionRestored: val }),

  // ── Tag management ──

  getProjectTags: (projectId: string): { name: string; color: string }[] => {
    const project = get().projects.find(p => p.id === projectId);
    return project?.settings?.projectTags || [];
  },

  addProjectTag: async (projectId: string, name: string, color: string) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    const tags: { name: string; color: string }[] = project.settings?.projectTags || [];
    if (tags.some((t: { name: string; color: string }) => t.name === name)) return;
    const updatedTags = [...tags, { name, color }];
    await get().updateProject(projectId, {
      settings: { ...(project.settings || {}), projectTags: updatedTags },
    });
  },

  removeProjectTag: async (projectId: string, name: string) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    const tags: { name: string; color: string }[] = project.settings?.projectTags || [];
    const updatedTags = tags.filter((t: { name: string; color: string }) => t.name !== name);
    await get().updateProject(projectId, {
      settings: { ...(project.settings || {}), projectTags: updatedTags },
    });
    // Also remove the tag from all pages in this project
    const projectPages = get().pages.filter(p => p.project_id === projectId);
    for (const page of projectPages) {
      const pageTags: string[] = page.metadata?.tags || [];
      if (pageTags.includes(name)) {
        await get().updatePage(page.id, {
          metadata: { ...(page.metadata || {}), tags: pageTags.filter((t: string) => t !== name) },
        });
      }
    }
  },

  updateProjectTag: async (projectId: string, oldName: string, newName: string, color: string) => {
    const project = get().projects.find(p => p.id === projectId);
    if (!project) return;
    const tags: { name: string; color: string }[] = project.settings?.projectTags || [];
    if (newName !== oldName && tags.some((t: { name: string; color: string }) => t.name === newName)) return;
    const updatedTags = tags.map((t: { name: string; color: string }) => t.name === oldName ? { name: newName, color } : t);
    await get().updateProject(projectId, {
      settings: { ...(project.settings || {}), projectTags: updatedTags },
    });
    // If tag was renamed, update all pages that had the old tag name
    if (newName !== oldName) {
      const projectPages = get().pages.filter(p => p.project_id === projectId);
      for (const page of projectPages) {
        const pageTags: string[] = page.metadata?.tags || [];
        if (pageTags.includes(oldName)) {
          await get().updatePage(page.id, {
            metadata: {
              ...(page.metadata || {}),
              tags: pageTags.map(t => t === oldName ? newName : t),
            },
          });
        }
      }
    }
  },
}))
