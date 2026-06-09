import { useState } from 'react'

export function Feedback() {
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setSending(true)
    const form = e.currentTarget
    const data = new FormData(form)
    try {
      await fetch('https://formsubmit.co/ajax/katrate@proton.me', {
        method: 'POST',
        body: data,
      })
      setSent(true)
    } catch {
      const name = data.get('name') || 'User'
      const message = data.get('message') || ''
      window.open(`mailto:katrate@proton.me?subject=Notie%20Website%20Feedback&body=${encodeURIComponent(String(message))}`)
      setSent(true)
    }
    setSending(false)
  }

  if (sent) {
    return (
      <section className="feedback" id="feedback">
        <div className="container">
          <div className="section-header">
            <h2>Thank You!</h2>
            <p>Your feedback helps make Notie better.</p>
          </div>
          <div className="feedback-card feedback-success">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <h3>Message Sent!</h3>
            <p>We'll review your feedback and get back to you if needed.</p>
            <button className="btn btn-primary" onClick={() => setSent(false)}>Send Another</button>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="feedback" id="feedback">
      <div className="container">
        <div className="section-header">
          <h2>Send Feedback</h2>
          <p>Have a suggestion or found a bug? Let us know!</p>
        </div>
        <form className="feedback-card" onSubmit={handleSubmit}>
          <input type="hidden" name="_subject" value="Notie Website Feedback" />
          <input type="hidden" name="_captcha" value="false" />
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="name">Name</label>
            <input id="name" name="name" type="text" placeholder="Your name" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" placeholder="you@example.com" required />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="type">Type</label>
            <select id="type" name="type">
              <option value="suggestion">Suggestion</option>
              <option value="bug">Bug Report</option>
              <option value="feature">Feature Request</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="message">Message</label>
            <textarea id="message" name="message" placeholder="Tell us what's on your mind..." required></textarea>
          </div>
          <button className="btn btn-primary" type="submit" disabled={sending}>
            {sending ? 'Sending...' : 'Send Feedback'}
          </button>
        </form>
      </div>
    </section>
  )
}
