const PLATFORM_ICONS: Record<string, string> = {
  windows: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 12V6.697l7-1V12zm0 5.303V12h7v6.303zM10 12V5.397l11-1.57V12zm0 0v7.173l11 1.57V12z"/></svg>`,
  apple: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>`,
  linux: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6v2h8V2zm0 4H6v2h6l4 6v6h2V12l-4-6zm-8 0v2H4v2h2v2h2v-2h2V8H8V6H6zm0 10h2v2H6v-2zm6 0h2v2h-2v-2z"/></svg>`,
};

const DOWNLOADS = {
  windows: {
    label: "Windows",
    icon: PLATFORM_ICONS.windows,
    files: [
      { name: "Portable (.zip)", url: "https://github.com/katrate/notie/releases/latest/download/Notie-0.1.1-win.zip" },
    ],
  },
  macos: {
    label: "macOS",
    icon: PLATFORM_ICONS.apple,
    files: [
      { name: "Apple Silicon (M1+)", url: "https://github.com/katrate/notie/releases/latest/download/Notie-0.1.1-arm64.dmg" },
      { name: "Intel", url: "https://github.com/katrate/notie/releases/latest/download/Notie-0.1.1-x64.dmg" },
    ],
  },
  linux: {
    label: "Linux",
    icon: PLATFORM_ICONS.linux,
    files: [
      { name: "AppImage", url: "https://github.com/katrate/notie/releases/latest/download/Notie-0.1.1-x86_64.AppImage" },
    ],
  },
};

export function Downloads() {
  return (
    <section className="downloads-section" id="downloads">
      <div className="container">
        <div className="section-header">
          <h2>Download Notie</h2>
          <p>Available for all major platforms. Download the latest version and get started.</p>
        </div>

        <div className="download-cards">
          {Object.entries(DOWNLOADS).map(([key, platform]) => (
            <div className="download-card" key={key}>
              <div className="platform-icon" dangerouslySetInnerHTML={{ __html: platform.icon }} />
              <h3>{platform.label}</h3>
              <p>Version 0.1.1</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {platform.files.map((file) => (
                  <a key={file.name} href={file.url} className="btn btn-platform">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                    </svg>
                    {file.name}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <p className="release-info">
          All downloads are from{" "}
          <a href="https://github.com/katrate/notie/releases" target="_blank" rel="noopener noreferrer">
            GitHub Releases
          </a>
          . Source code is available on{" "}
          <a href="https://github.com/katrate/notie" target="_blank" rel="noopener noreferrer">GitHub</a>.
        </p>
      </div>
    </section>
  );
}