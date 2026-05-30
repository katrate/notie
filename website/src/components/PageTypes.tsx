const PAGE_TYPES = [
  { icon: "📄", name: "Text Document", desc: "Rich text with Tiptap editor" },
  { icon: "📊", name: "Table", desc: "Editable spreadsheet view" },
  { icon: "📋", name: "Board", desc: "Kanban task management" },
  { icon: "📈", name: "Chart", desc: "Data visualization with Recharts" },
  { icon: "🖼️", name: "Gallery", desc: "Image gallery layout" },
  { icon: "✅", name: "Checklist", desc: "Interactive task list" },
  { icon: "🎨", name: "Canvas", desc: "Freeform drawing canvas" },
  { icon: "📁", name: "Folder", desc: "Nested page container" },
  { icon: "📺", name: "Dashboard", desc: "Project overview" },
  { icon: "🎤", name: "Audio", desc: "Voice memo recording" },
  { icon: "🎬", name: "Video", desc: "Video file viewer" },
  { icon: "📎", name: "File", desc: "File attachment viewer" },
];

export function PageTypes() {
  return (
    <section className="section" id="page-types">
      <div className="container">
        <div className="section-header">
          <h2>14 page types, endless possibilities</h2>
          <p>Each page type is optimized for its content — from documents to diagrams.</p>
        </div>
        <div className="page-types-grid">
          {PAGE_TYPES.map((pt) => (
            <div className="page-type-card" key={pt.name}>
              <div className="page-type-icon">{pt.icon}</div>
              <div className="page-type-info">
                <h4>{pt.name}</h4>
                <p>{pt.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}