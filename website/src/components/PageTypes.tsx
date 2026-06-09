const PAGE_TYPES = [
  { icon: "description", name: "Text Document", desc: "Rich text with headings, lists, and formatting.", screenshot: "text-document.png" },
  { icon: "table", name: "Table", desc: "Spreadsheet-style tables for data organization.", screenshot: "table.png" },
  { icon: "board", name: "Board", desc: "Kanban boards for visual project management.", screenshot: "board.png" },
  { icon: "chart", name: "Chart", desc: "Data visualization with interactive charts.", screenshot: "chart.png" },
  { icon: "gallery", name: "Gallery", desc: "Image galleries and media collections.", screenshot: "gallery.png" },
  { icon: "checklist", name: "Checklist", desc: "Track progress with interactive checklists.", screenshot: "checklist.png" },
  { icon: "canvas", name: "Canvas", desc: "Free-form canvas for brainstorming.", screenshot: "canvas.png" },
  { icon: "folder", name: "Folder", desc: "Organize pages into nested hierarchies.", screenshot: "folder.png" },
  { icon: "dashboard", name: "Dashboard", desc: "Custom dashboards with widgets.", screenshot: "dashboard.png" },
  { icon: "audio", name: "Audio", desc: "Voice notes and audio recordings.", screenshot: "audio.png" },
  { icon: "file", name: "File", desc: "File attachments and document storage.", screenshot: "file.png" },
  { icon: "video", name: "Video", desc: "Embed and organize video content.", screenshot: "video.png" },
]

const ICONS: Record<string, string> = {
  description: "description",
  table: "table",
  board: "board",
  chart: "chart",
  gallery: "gallery",
  checklist: "checklist",
  canvas: "canvas",
  folder: "folder",
  dashboard: "dashboard",
  audio: "audio",
  file: "file",
  video: "video",
}

export function PageTypes() {
  return (
    <section className="page-types" id="page-types">
      <div className="container">
        <div className="section-header">
          <h2>14 Page Types, Endless Possibilities</h2>
          <p>From documents to dashboards, Notie has a page type for every need.</p>
        </div>
        <div className="page-types-grid">
          {PAGE_TYPES.map((pt, i) => (
            <div className="page-type-card fade-up" key={i}>
              <div className="feature-icon" style={{ background: "rgba(139,92,246,0.08)", color: "#8b5cf6", margin: "0 auto 12px" }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{ICONS[pt.icon] || "description"}</span>
              </div>
              <h3>{pt.name}</h3>
              <p>{pt.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
