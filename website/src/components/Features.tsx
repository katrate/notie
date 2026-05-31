const FEATURES = [
  {
    icon: "📝",
    title: "Rich Text Editor",
    desc: "Powered by Tiptap with support for headings, lists, code blocks with syntax highlighting, callouts, toggles, and more. Write beautifully formatted documents with an intuitive interface.",
    screenshot: "text-editor-page.png",
    align: "left",
  },
  {
    icon: "📊",
    title: "Multiple Page Types",
    desc: "Text documents, kanban boards, charts, galleries, checklists, canvas drawings, tables, and folders. Each page type is optimized for its specific content and workflow.",
    screenshot: "board-page.png",
    align: "right",
  },
  {
    icon: "🔗",
    title: "Knowledge Graph",
    desc: "An auto-generated interactive graph visualizes connections between pages, tags, and properties. Navigate your knowledge visually and discover relationships you never knew existed.",
    screenshot: "sidebar-view.png",
    align: "left",
  },
  {
    icon: "✅",
    title: "Interactive Checklists",
    desc: "Create and manage checklists with real-time progress tracking. Perfect for todo lists, project milestones, and recurring tasks. Mark items complete and watch your progress grow.",
    screenshot: "checklist-page.png",
    align: "right",
  },
  {
    icon: "📈",
    title: "Data Visualization",
    desc: "Turn your data into beautiful charts with Recharts. Visualize trends, compare metrics, and create dashboards that make your data come alive.",
    screenshot: "chart-page.png",
    align: "left",
  },
  {
    icon: "🎨",
    title: "Beautiful Gallery",
    desc: "Organize images and media in a stunning gallery layout. Perfect for mood boards, design inspiration collections, and visual asset management.",
    screenshot: "gallery-page.png",
    align: "right",
  },
  {
    icon: "🔒",
    title: "Secure & E2E Encrypted",
    desc: "Supabase backend with Row Level Security, PKCE authentication, and Google OAuth sign-in. Your data stays private and secure.",
    screenshot: "auth-screen.png",
    align: "left",
  },
  {
    icon: "📦",
    title: "Templates & Projects",
    desc: "Save any page as a reusable template. Organize your work into projects with custom themes, tags, and structured layouts. Everything stays organized.",
    screenshot: "sidebar-projects.png",
    align: "right",
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
        <div className="features-showcase">
          {FEATURES.map((f, i) => (
            <div className={`feature-showcase-card ${f.align === "right" ? "reverse" : ""}`} key={f.title}>
              <div className="feature-showcase-content">
                <div className="feature-showcase-number">0{i + 1}</div>
                <div className="feature-showcase-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
              <div className="feature-showcase-visual">
                <div className="showcase-window feature-window">
                  <div className="window-dots">
                    <span className="dot dot-red"></span>
                    <span className="dot dot-yellow"></span>
                    <span className="dot dot-green"></span>
                  </div>
                  <div className="window-content">
                    <img
                      src={`/screenshots/${f.screenshot}`}
                      alt={f.title}
                      className="showcase-img"
                      loading="lazy"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
