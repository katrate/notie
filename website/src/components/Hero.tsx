import { Downloads } from "./Downloads";

export function Hero() {
  return (
    <>
      <nav>
        <div className="container">
          <div className="nav-inner">
            <a href="#" className="nav-logo">
              <div className="nav-logo-icon">N</div>
              Notie
            </a>
            <ul className="nav-links">
              <li><a href="#features">Features</a></li>
              <li><a href="#page-types">Page Types</a></li>
              <li><a href="#downloads">Download</a></li>
              <li><a href="https://github.com/katrate/notie" target="_blank" rel="noopener noreferrer">GitHub</a></li>
              <li><a href="#downloads" className="nav-cta">Get Notie</a></li>
            </ul>
          </div>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-bg" />
        <div className="container" style={{ position: "relative", zIndex: 1 }}>
          <div className="hero-badge">
            <span>✦</span> v0.1.1 — Now Available
          </div>
          <h1>
            Your knowledge,<br />
            <span>visually connected</span>
          </h1>
          <p>
            Notie is a modern, cross-platform knowledge management app that combines
            rich notes, kanban boards, knowledge graphs, and flexible databases
            into one beautiful workspace.
          </p>
          <div className="hero-buttons">
            <a href="#downloads" className="btn btn-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
              </svg>
              Download for free
            </a>
            <a href="https://github.com/katrate/notie" target="_blank" className="btn btn-secondary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
              </svg>
              View on GitHub
            </a>
          </div>
        </div>
      </section>
    </>
  );
}