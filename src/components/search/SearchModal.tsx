import { useState, useEffect, useRef, useMemo } from 'react'
import MiniSearch from 'minisearch'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Recursively extract plain text from a TipTap JSON node */
function extractText(node: any): string {
  if (!node) return ''
  let text = ''
  if (node.text) text += node.text + ' '
  if (Array.isArray(node.content)) {
    for (const child of node.content) text += extractText(child)
  }
  return text
}

const TYPE_ICON: Record<string, string> = {
  text:      'article',
  table:     'grid_on',
  board:     'dashboard',
  chart:     'bar_chart',
  gallery:   'photo_library',
  dashboard: 'dashboard_customize',
  folder:    'folder',
  checklist: 'checklist',
  audio:     'mic',
  video:     'videocam',
  file:      'description',
  project:   'folder',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Result {
  id: string
  title: string
  projectId: string
  projectName: string
  type: string
  excerpt: string
}

interface SearchModalProps {
  onClose: () => void
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SearchModal({ onClose }: SearchModalProps) {
  const { projects, pages, navigateToPage } = useProjectStore()
  const [query, setQuery]         = useState('')
  const [results, setResults]     = useState<Result[]>([])
  const [selected, setSelected]   = useState(0)
  const inputRef                  = useRef<HTMLInputElement>(null)

  // Focus input on mount
  useEffect(() => { inputRef.current?.focus() }, [])

   // Build MiniSearch index whenever pages/projects change
   const miniSearch = useMemo(() => {
     const ms = new MiniSearch<{
       id: string; title: string; content: string; projectId: string; projectName: string; type: string
     }>({
       fields: ['title', 'content', 'projectName'],
       storeFields: ['title', 'projectId', 'projectName', 'type', 'content'],
       searchOptions: { boost: { title: 3 }, prefix: true, fuzzy: 0.2 },
     })

     // Add pages to index
     const pageDocs = pages.map(page => {
       const project = projects.find(p => p.id === page.project_id)
       return {
         id:          page.id,
         title:       page.title || 'Untitled',
         content:     extractText(page.content).slice(0, 2000),
          projectId:   page.project_id || '',
         projectName: project?.name ?? '',
         type:        page.type ?? 'text',
       }
     })

     // Add projects to index
     const projectDocs = projects.map(project => ({
       id:          project.id,
       title:       project.name,
       content:     project.description || '',
       projectId:   project.id,
       projectName: project.name,
       type:        'project',
     }))

     // Combine pages and projects
     const allDocs = [...pageDocs, ...projectDocs]

     if (allDocs.length > 0) ms.addAll(allDocs)
     return ms
   }, [pages, projects])

   // Update results on query change
   useEffect(() => {
     if (!query.trim()) {
       // Show empty state when no query
       setResults([])
       setSelected(0)
       return
     }

      const hits = miniSearch.search(query, { boost: { title: 3 }, prefix: true, fuzzy: 0.2 })
      setResults(
        hits.slice(0, 10).map(r => ({
         id:          r.id,
         title:       r.title,
         projectId:   r.projectId,
         projectName: r.projectName,
         type:        r.type,
         excerpt:     r.content
           ? (r.content as string).substring(0, 100).trimEnd() +
             ((r.content as string).length > 100 ? '…' : '')
           : '',
       }))
     )
     setSelected(0)
   }, [query, miniSearch, pages, projects])

  const open = (result: Result) => {
    navigateToPage(result.projectId, result.id)
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter')     { if (results[selected]) open(results[selected]) }
    if (e.key === 'Escape')    { onClose() }
  }

   return (
     <div
       className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[200] flex items-center justify-center px-4 pt-4 pb-4"
       onClick={onClose}
     >
        <div
          className="w-full max-w-[420px] bg-surface border border-outline/20 rounded-2xl shadow-2xl"
          style={{ animation: 'searchPop 0.15s cubic-bezier(0.34,1.56,0.64,1)' }}
          onClick={e => e.stopPropagation()}
        >
        {/* ── Input row ── */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-outline/10">
          <span className="material-symbols-outlined text-[20px] text-on-surface-variant flex-shrink-0">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search pages and content…"
            className="flex-1 bg-transparent text-on-surface placeholder:text-on-surface-variant/60 outline-none text-[15px]"
          />
           {query ? (
             <Tooltip label="Clear search" position="bottom">
             <button onClick={() => setQuery('')} className="text-on-surface-variant hover:text-on-surface transition-colors">
               <span className="material-symbols-outlined text-[18px]">close</span>
             </button>
             </Tooltip>
           ) : null}
        </div>

        {/* ── Results list ── */}
        <div className="max-h-[420px] overflow-y-auto">
          {results.length === 0 && query ? (
            <div className="px-4 py-10 text-center text-on-surface-variant text-sm">
              No results for &ldquo;<span className="text-on-surface font-medium">{query}</span>&rdquo;
            </div>
          ) : (
            <>
               <div className="px-4 pt-2 pb-1 text-[10px] font-label-sm uppercase tracking-wider text-on-surface-variant">
                 {query ? `${results.length} result${results.length !== 1 ? 's' : ''}` : ''}
               </div>

              {results.map((r, i) => (
                <button
                  key={r.id}
                  onClick={() => open(r)}
                  onMouseEnter={() => setSelected(i)}
                  className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selected ? 'bg-primary/10' : 'hover:bg-on-surface/5'
                  }`}
                >
                  <span
                    className={`material-symbols-outlined text-[18px] mt-0.5 flex-shrink-0 transition-colors ${
                      i === selected ? 'text-primary' : 'text-on-surface-variant'
                    }`}
                  >
                    {TYPE_ICON[r.type] ?? 'article'}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
           <span
             className={`text-[13px] font-body-md truncate transition-colors ${
               i === selected ? 'text-primary' : 'text-on-surface'
             }`}
           >
             {r.title}
           </span>
                       {r.projectName && (
                         <span className="flex-shrink-0 text-[11px] text-on-surface-variant bg-surface-variant/80 px-1.5 py-0.5 rounded font-body-md">
                           {r.projectName}
                         </span>
                       )}
                    </div>
                    {r.excerpt && (
                      <p className="text-[12px] text-on-surface-variant/70 truncate mt-0.5">{r.excerpt}</p>
                    )}
                  </div>

                  {i === selected && (
                    <span className="material-symbols-outlined text-[14px] text-primary/70 flex-shrink-0 mt-0.5">
                      arrow_forward
                    </span>
                  )}
                </button>
              ))}
            </>
          )}
        </div>

        {/* ── Footer hints ── */}
        <div className="px-4 py-2.5 border-t border-outline/10 flex items-center gap-4 text-[11px] text-on-surface-variant/60">
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-variant/60 px-1.5 py-0.5 rounded font-mono border border-outline/10">↑↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-variant/60 px-1.5 py-0.5 rounded font-mono border border-outline/10">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="bg-surface-variant/60 px-1.5 py-0.5 rounded font-mono border border-outline/10">Esc</kbd>
            close
          </span>
        </div>
      </div>

      <style>{`
        @keyframes searchPop {
          from { opacity: 0; transform: scale(0.95) translateY(-8px); }
          to   { opacity: 1; transform: scale(1)    translateY(0);     }
        }
      `}</style>
    </div>
  )
}
