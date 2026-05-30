const FEATURES = [
  {
    icon: "📝",
    title: "Rich Text Editor",
    desc: "Powered by Tiptap, with support for headings, lists, code blocks with syntax highlighting, callouts, toggles, and more.",
  },
  {
    icon: "📊",
    title: "Multiple Page Types",
    desc: "Text documents, tables, kanban boards, charts, galleries, checklists, canvas drawings, and folder views — all in one app.",
  },
  {
    icon: "🔗",
    title: "Knowledge Graph",
    desc: "Auto-generated interactive graph visualizing connections between pages, tags, and properties. Navigate your knowledge visually.",
  },
  {
    icon: "🏷️",
    title: "Flexible Properties",
    desc: "Add custom properties to any page — text, numbers, dates, select, email, URLs, progress bars, file attachments, and more.",
  },
  {
    icon: "🎨",
    title: "Beautiful Themes",
    desc: "Dark and light modes with 9 accent colors, gradient backgrounds, and per-project theme overrides.",
  },
  {
    icon: "🔍",
    title: "Full-Text Search",
    desc: "Instant search across all your projects and pages with MiniSearch, so you never lose track of your notes.",
  },
  {
    icon: "🔒",
    title: "Secure & Encrypted",
    desc: "Supabase backend with Row Level Security, PKCE authentication, and Google OAuth sign-in.",
  },
  {
    icon: "📦",
    title: "Templates",
    desc: "Save any page as a reusable template. Create structured pages from templates with one click.",
  },
];

export function Features() {
  return (
    <section className="section" id="features">
      <div className="container">
        <div className="section-header">
          <h2>Everything you need to stay organized</h2>
          <p>Notie combines the best of note-taking apps into one seamless experience.</p>
        </div>
        <div className="features-grid">
          {FEATURES.map((f) => (
            <div className="feature-card" key={f.title}>
              <div className="feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}