const features = [
  { icon: "editor", color: "#8b5cf6", title: "Rich Text Editor", desc: "Full-featured editor powered by Tiptap. Support for headings, code blocks, task lists, callouts, and more." },
  { icon: "kanban", color: "#06b6d4", title: "Kanban Boards", desc: "Organize projects with drag-and-drop boards. Perfect for task management and workflow tracking." },
  { icon: "graph", color: "#f59e0b", title: "Knowledge Graphs", desc: "Visualize connections between notes and pages. Discover insights through interactive graph views." },
  { icon: "checklist", color: "#00d4aa", title: "Interactive Checklists", desc: "Create and track checklists with real-time progress indicators. Great for todos and project planning." },
  { icon: "chart", color: "#4a90d9", title: "Data Visualization", desc: "Turn your data into beautiful charts and graphs. Powered by Recharts for rich interactive visualizations." },
  { icon: "gallery", color: "#ef4444", title: "Beautiful Gallery", desc: "Organize images and media in a stunning gallery view. Perfect for visual reference collections." },
  { icon: "lock", color: "#a78bfa", title: "E2E Encrypted", desc: "Your notes are encrypted end-to-end. Not even we can read them. Powered by Supabase Row Level Security." },
  { icon: "template", color: "#22d3ee", title: "Templates & Projects", desc: "Start faster with customizable templates. Create project workspaces with pre-configured page structures." },
]

const ICONS: Record<string, JSX.Element> = {
  editor: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  kanban: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  graph: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="5" cy="5" r="2"/><circle cx="19" cy="5" r="2"/><circle cx="12" cy="19" r="2"/><line x1="7" y1="6" x2="10" y2="17"/><line x1="17" y1="6" x2="14" y2="17"/></svg>,
  checklist: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  chart: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  gallery: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  lock: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>,
  template: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>,
}

export function Features() {
  return (
    <section className="features" id="features">
      <div className="container">
        <div className="section-header">
          <h2>Everything You Need</h2>
          <p>Powerful tools for knowledge management, project organization, and creative work.</p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card fade-up" key={i}>
              <div className="feature-icon" style={{ background: f.color + "15", color: f.color }}>
                {ICONS[f.icon] || f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
