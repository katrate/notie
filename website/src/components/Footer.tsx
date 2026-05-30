export function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-inner">
          <p>&copy; {new Date().getFullYear()} Notie. Open source under MIT license.</p>
          <div className="footer-links">
            <a href="https://github.com/katrate/notie" target="_blank" rel="noopener noreferrer">GitHub</a>
            <a href="https://github.com/katrate/notie/releases" target="_blank" rel="noopener noreferrer">Releases</a>
            <a href="https://github.com/katrate/notie/issues" target="_blank" rel="noopener noreferrer">Issues</a>
          </div>
        </div>
      </div>
    </footer>
  );
}