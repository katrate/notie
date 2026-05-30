-- ============================================
-- USERS (extends Supabase auth.users)
-- ============================================
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  display_name TEXT,
  avatar_url TEXT,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROJECTS (workspaces/notebooks)
-- ============================================
CREATE TABLE public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '📁',
  color TEXT DEFAULT '#8B5CF6',
  layout_type TEXT NOT NULL DEFAULT 'document'
    CHECK (layout_type IN ('document', 'table', 'board', 'checklist', 'gallery', 'chart')),
  settings JSONB DEFAULT '{}',
  is_favorite BOOLEAN DEFAULT FALSE,
  is_archived BOOLEAN DEFAULT FALSE,
  position INTEGER DEFAULT 0,
  parent_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAGES (content within projects)
-- ============================================
CREATE TABLE public.pages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,  -- nullable for standalone pages
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Untitled',
  content JSONB DEFAULT '{}',  -- Tiptap JSON content
  icon TEXT DEFAULT '📄',
  cover_url TEXT,
  position INTEGER DEFAULT 0,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPERTY DEFINITIONS (flexible schema)
-- ============================================
CREATE TABLE public.property_definitions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  property_type TEXT NOT NULL
    CHECK (property_type IN (
      'text', 'number', 'select', 'multi_select', 'date',
      'boolean', 'url', 'email', 'relation', 'formula',
      'progress', 'file', 'person', 'status'
    )),
  config JSONB DEFAULT '{}',  -- Options for select, formula expressions, etc.
  position INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPERTY VALUES (per page)
-- ============================================
CREATE TABLE public.property_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.property_definitions(id) ON DELETE CASCADE NOT NULL,
  value JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(page_id, property_id)
);

-- ============================================
-- GRAPH NODES (for knowledge graph)
-- ============================================
CREATE TABLE public.graph_nodes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('page', 'tag', 'property', 'external')),
  source_id UUID,  -- References page_id, or null for tags
  label TEXT NOT NULL,
  node_type TEXT DEFAULT 'default',
  color TEXT,
  position_x FLOAT,
  position_y FLOAT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- GRAPH EDGES (connections)
-- ============================================
CREATE TABLE public.graph_edges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  source_node_id UUID REFERENCES public.graph_nodes(id) ON DELETE CASCADE NOT NULL,
  target_node_id UUID REFERENCES public.graph_nodes(id) ON DELETE CASCADE NOT NULL,
  edge_type TEXT DEFAULT 'relation'
    CHECK (edge_type IN ('relation', 'mention', 'tag', 'dependency', 'parent')),
  label TEXT,
  weight FLOAT DEFAULT 1.0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source_node_id, target_node_id, edge_type)
);

-- ============================================
-- TEMPLATES
-- ============================================
CREATE TABLE public.templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT 'description',
  structure JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TAGS
-- ============================================
CREATE TABLE public.tags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#8B5CF6',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE TABLE public.page_tags (
  page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES public.tags(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.graph_edges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.page_tags ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users manage own profile"
  ON public.profiles FOR ALL USING (auth.uid() = id);

CREATE POLICY "Users manage own projects"
  ON public.projects FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own pages"
  ON public.pages FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own property definitions"
  ON public.property_definitions FOR ALL
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own property values"
  ON public.property_values FOR ALL
  USING (page_id IN (SELECT id FROM public.pages WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own graph nodes"
  ON public.graph_nodes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own templates"
  ON public.templates FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own graph edges"
  ON public.graph_edges FOR ALL
  USING (project_id IN (SELECT id FROM public.projects WHERE user_id = auth.uid()));

CREATE POLICY "Users manage own tags"
  ON public.tags FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own page tags"
  ON public.page_tags FOR ALL
  USING (page_id IN (SELECT id FROM public.pages WHERE user_id = auth.uid()));

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_user ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_pages_project ON public.pages(project_id);
CREATE INDEX IF NOT EXISTS idx_pages_standalone ON public.pages(user_id) WHERE project_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_property_values_page ON public.property_values(page_id);
CREATE INDEX IF NOT EXISTS idx_graph_nodes_project ON public.graph_nodes(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_project ON public.graph_edges(project_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_source ON public.graph_edges(source_node_id);
CREATE INDEX IF NOT EXISTS idx_templates_user ON public.templates(user_id);
CREATE INDEX IF NOT EXISTS idx_graph_edges_target ON public.graph_edges(target_node_id);

-- ============================================
-- FUNCTIONS
-- ============================================
-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'display_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_projects_timestamp ON public.projects;
CREATE TRIGGER update_projects_timestamp
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_pages_timestamp ON public.pages;
CREATE TRIGGER update_pages_timestamp
  BEFORE UPDATE ON public.pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_property_values_timestamp ON public.property_values;
CREATE TRIGGER update_property_values_timestamp
  BEFORE UPDATE ON public.property_values
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_templates_timestamp ON public.templates;
CREATE TRIGGER update_templates_timestamp
  BEFORE UPDATE ON public.templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
