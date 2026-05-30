import React, { useState, useEffect, useCallback } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useTemplateStore, type TemplateNode } from '../../stores/templateStore';

// Icon mapping – using Material Symbols (you can replace with any icon library you prefer)
function countNodes(node: TemplateNode): number {
  let count = 1; // this node
  for (const child of node.children) {
    count += countNodes(child);
  }
  return count;
}

const ALL_PAGE_TYPES = [
  { type: 'text', label: 'Text', icon: 'article' },
  { type: 'table', label: 'Table', icon: 'grid_on' },
  { type: 'board', label: 'Board', icon: 'dashboard' },
  { type: 'chart', label: 'Chart', icon: 'bar_chart' },
  { type: 'gallery', label: 'Gallery', icon: 'photo_library' },
  { type: 'dashboard', label: 'Dashboard', icon: 'dashboard_customize' },
  { type: 'folder', label: 'Folder', icon: 'folder' },
  { type: 'checklist', label: 'Checklist', icon: 'checklist' },
  { type: 'audio', label: 'Audio', icon: 'mic' },
  { type: 'video', label: 'Video', icon: 'videocam' },
  { type: 'file', label: 'Files', icon: 'description' },
];

interface CreatePagePanelProps {
  /**
   * Called by the parent to hide the panel.
   */
  onClose: () => void;
  /**
   * Current active project id.
   */
  projectId: string;
}

export function CreatePagePanel({ onClose, projectId }: CreatePagePanelProps) {
  const { createPage, pages, fetchPages, updatePage } = useProjectStore();
  const { templates, fetchTemplates } = useTemplateStore();
  const [selectedType, setSelectedType] = useState<string>('text');
  const [pageTitle, setPageTitle] = useState<string>('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Fetch templates when panel opens
  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // When a template is selected, pre-fill title and type
  const selectedTemplate = selectedTemplateId
    ? templates.find(t => t.id === selectedTemplateId) || null
    : null;

  const handleTemplateSelect = (templateId: string | null) => {
    setSelectedTemplateId(templateId);
    if (templateId) {
      const tmpl = templates.find(t => t.id === templateId);
      if (tmpl) {
        setPageTitle(tmpl.structure.title);
        setSelectedType(tmpl.structure.type || 'text');
      }
    } else {
      setPageTitle('');
      setSelectedType('text');
    }
  };

  const applyTagsToPage = useCallback(async (pageId: string, tags: string[] | undefined) => {
    if (!tags || tags.length === 0) return;
    const { getProjectTags, addProjectTag } = useProjectStore.getState();
    const existingTags = getProjectTags(projectId);
    for (const tagName of tags) {
      if (!existingTags.some((t: { name: string; color: string }) => t.name === tagName)) {
        await addProjectTag(projectId, tagName, '#6b7280');
      }
    }
    const pageData = useProjectStore.getState().pages.find(p => p.id === pageId);
    if (pageData) {
      await updatePage(pageId, {
        metadata: { ...(pageData.metadata || {}), tags }
      });
    }
  }, [projectId, updatePage]);

  /** Recursively create pages from a template node */
  const createFromNode = useCallback(async (
    node: TemplateNode,
    parentId: string | null,
  ): Promise<string | null> => {
    const page = await createPage(
      projectId,
      node.title,
      node.type || 'text',
      parentId ? { parentId } : {},
      node.icon || 'description',
    );
    if (!page) return null;

    // Apply tags from template to the created page
    await applyTagsToPage(page.id, node.tags);

    // Create child pages recursively
    for (const child of node.children) {
      await createFromNode(child, page.id);
    }

    return page.id;
  }, [projectId, createPage, applyTagsToPage]);

  const handleCreate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!projectId) return;
    setCreating(true);

    if (selectedTemplate) {
      // Apply template: create root + all child pages recursively
      await createFromNode(selectedTemplate.structure, null);
    } else {
      const finalTitle = pageTitle.trim() || 'Untitled';
      await createPage(projectId, finalTitle, selectedType, {});
    }

    // Refresh pages so sidebar shows new pages
    await fetchPages(projectId);
    setCreating(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-50 p-4">
      <div className="bg-surface border border-outline/20 rounded-xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-xl font-bold mb-2 text-on-surface">Create New Page</h2>
        <p className="text-sm text-on-surface-variant mb-5">Name your page and choose a template.</p>
        
        <form onSubmit={handleCreate}>
          <div className="mb-5">
            <input
              autoFocus
              type="text"
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              placeholder="e.g. Q3 Roadmap, Server Logs..."
              className="w-full bg-background border border-outline/20 rounded-lg px-3 py-2 text-on-surface focus:outline-none focus:border-primary transition-colors"
            />
          </div>

          {/* Saved Templates */}
          {templates.length > 0 && (
            <div className="mb-5">
              <p className="text-[11px] font-semibold text-on-surface-variant uppercase tracking-wider mb-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px]">bookmark</span>
                Apply a Template
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTemplateSelect(null)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    !selectedTemplateId
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-outline/10 text-on-surface-variant hover:border-primary/30'
                  }`}
                >
                  None
                </button>
                {templates.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => handleTemplateSelect(t.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selectedTemplateId === t.id
                        ? 'border-primary bg-primary/20 text-primary'
                        : 'border-outline/10 text-on-surface-variant hover:border-primary/30'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[14px]">{t.icon}</span>
                    {t.name}
                    {t.structure.children.length > 0 && (
                      <span className="text-[10px] opacity-50">+{t.structure.children.length}</span>
                    )}
                  </button>
                ))}
              </div>
              {selectedTemplate && (
                <p className="text-[10px] text-on-surface-variant/60 mt-1.5">
                  Creates {countNodes(selectedTemplate.structure)} page{countNodes(selectedTemplate.structure) !== 1 ? 's' : ''} with child hierarchy
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-6">
            {ALL_PAGE_TYPES.filter(pt => pt.type !== 'dashboard' || !pages.some(p => p.project_id === projectId && p.type === 'dashboard')).map((pt) => (
              <button
                key={pt.type}
                type="button"
                onClick={() => setSelectedType(pt.type)}
                className={`flex flex-col items-center p-3 rounded-xl transition-all border ${
                  selectedType === pt.type ? 'border-primary bg-primary/10 shadow-[0_0_10px_rgba(152,203,255,0.1)]' : 'border-outline/10 hover:border-primary/30 bg-surface/50'
                }`}
              >
                <span className={`material-symbols-outlined text-2xl mb-1 ${selectedType === pt.type ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {pt.icon}
                </span>
                <span className={`text-sm font-medium ${selectedType === pt.type ? 'text-primary' : 'text-on-surface-variant'}`}>{pt.label}</span>
              </button>
            ))}
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-outline/10">
            <button
              type="button"
              onClick={onClose}
              disabled={creating}
              className="px-4 py-2 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-sm font-medium disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-on-primary hover:bg-primary/90 transition-colors text-sm font-medium disabled:opacity-50"
            >
              {creating ? (
                <>
                  <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                  Creating...
                </>
              ) : (
                selectedTemplate ? 'Create from Template' : 'Create Page'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
