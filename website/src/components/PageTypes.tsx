const PAGE_TYPES = [
  { icon: "📄", name: "Text Document", desc: "Rich text with Tiptap", screenshot: "text-editor-page.png" },
  { icon: "📊", name: "Table", desc: "Editable spreadsheet", screenshot: "table-page.png" },
  { icon: "📋", name: "Board", desc: "Kanban board", screenshot: "board-page.png" },
  { icon: "📈", name: "Chart", desc: "Data visualization", screenshot: "chart-page.png" },
  { icon: "🖼️", name: "Gallery", desc: "Media gallery", screenshot: "gallery-page.png" },
  { icon: "✅", name: "Checklist", desc: "Task list", screenshot: "checklist-page.png" },
  { icon: "🎨", name: "Canvas", desc: "Freeform drawing", screenshot: "canvas-page.png" },
  { icon: "📁", name: "Folder", desc: "Nested pages", screenshot: "folder-page.png" },
  { icon: "📺", name: "Dashboard", desc: "Project overview", screenshot: "dashboard-page.png" },
  { icon: "🎤", name: "Audio", desc: "Voice memos", screenshot: "audio-page.png" },
  { icon: "🎬", name: "Video", desc: "Video viewer", screenshot: "video-page.png" },
  { icon: "📎", name: "File", desc: "File attachment", screenshot: "file-page.png" },
];

export function PageTypes() {
  return (
    <section className="section" id="page-types">
      <div className="container">
        <div className="section-header">
          <h2>14 page types, endless possibilities</h2>
          <p>Each page type is optimized for its content — from documents to diagrams.</p>
        </div>
        <div className="page-types-showcase">
          {PAGE_TYPES.map((pt) => (
            <div className="page-type-showcase-card" key={pt.name}>
              <div className="page-type-thumbnail">
                <img
                  src={`/screenshots/${pt.screenshot}`}
                  alt={pt.name}
                  loading="lazy"
                />
              </div>
              <div className="page-type-thumbnail-overlay">
                <div className="page-type-thumbnail-icon">{pt.icon}</div>
                <div className="page-type-thumbnail-info">
                  <h4>{pt.name}</h4>
                  <p>{pt.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
