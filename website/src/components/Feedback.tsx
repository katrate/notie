import { useState, FormEvent } from "react";

export function Feedback() {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    const form = e.currentTarget;
    const data = new FormData(form);
    try {
      await fetch("https://formsubmit.co/ajax/my494stry@gmail.com", {
        method: "POST",
        body: data,
      });
      setSent(true);
      form.reset();
    } catch {
      // fallback: mailto
      const name = data.get("name");
      const email = data.get("email");
      const type = data.get("type");
      const message = data.get("message");
      window.location.href = `mailto:my494stry@gmail.com?subject=${encodeURIComponent(`[Notie Feedback] ${type} from ${name}`)}&body=${encodeURIComponent(`From: ${name} (${email})\n\n${message}`)}`;
    }
    setSending(false);
  };

  return (
    <section className="section" id="feedback" style={{ padding: "60px 0 80px" }}>
      <div className="container">
        <div className="section-header">
          <h2>Send Feedback</h2>
          <p>Suggestions, bug reports, or just say hello — we read everything.</p>
        </div>
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          {sent ? (
            <div style={{
              textAlign: "center",
              padding: "40px",
              background: "var(--bg-card)",
              borderRadius: "var(--radius-lg)",
              border: "1px solid var(--border)",
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>✉️</div>
              <h3 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>Thanks!</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>Your message has been sent. We'll review it shortly.</p>
              <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => setSent(false)}>Send another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <input type="hidden" name="_subject" value="Notie Website Feedback" />
              <input type="hidden" name="_captcha" value="false" />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={labelStyle}>Your Name</label>
                  <input name="name" required style={inputStyle} placeholder="John Doe" />
                </div>
                <div>
                  <label style={labelStyle}>Your Email</label>
                  <input name="email" type="email" required style={inputStyle} placeholder="john@example.com" />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Type</label>
                <select name="type" required style={inputStyle}>
                  <option value="">Select a category</option>
                  <option value="Suggestion">💡 Suggestion</option>
                  <option value="Bug Report">🐛 Bug Report</option>
                  <option value="Feature Request">✨ Feature Request</option>
                  <option value="Other">📝 Other</option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Message</label>
                <textarea name="message" required rows={5} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} placeholder="Tell us what's on your mind..." />
              </div>

              <button type="submit" disabled={sending} className="btn btn-primary" style={{ justifyContent: "center", marginTop: 4 }}>
                {sending ? "Sending..." : "Send Feedback"}
              </button>

              <p style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center", marginTop: 4 }}>
                Your email will only be used to respond to your feedback.
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 12,
  fontWeight: 500,
  color: "var(--text-secondary)",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--bg-card)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
  transition: "border-color 0.2s",
  boxSizing: "border-box",
};