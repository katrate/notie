export function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <p>&copy; {new Date().getFullYear()} Katrate. Open source under MIT License.</p>
        <div className="footer-links">
          <a href="https://github.com/katrate/notie" target="_blank" rel="noopener noreferrer">GitHub</a>
          <a href="https://github.com/katrate/notie/releases" target="_blank" rel="noopener noreferrer">Releases</a>
          <a href="https://github.com/katrate/notie/issues" target="_blank" rel="noopener noreferrer">Issues</a>
        </div>
      </div>
    </footer>
  )
}
