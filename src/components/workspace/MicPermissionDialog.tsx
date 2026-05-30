import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onAllow: () => void
  onDismiss: () => void
}

export function MicPermissionDialog({ onAllow, onDismiss }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  // Animate in after mount
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  // Trap focus and handle Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onDismiss])

  return createPortal(
    <div
      className={`fixed inset-0 z-[9999] flex items-center justify-center p-4 permission-overlay transition-all duration-300 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      style={{ backgroundColor: visible ? 'rgba(0,0,0,0.65)' : 'rgba(0,0,0,0)' }}
      onClick={onDismiss}
    >
      <div
        ref={cardRef}
        className={`permission-card relative w-full max-w-sm bg-surface border border-outline/20 rounded-2xl shadow-2xl p-6 transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={e => e.stopPropagation()}
      >
        {/* Background gradient blobs */}
        <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-12 w-32 h-32 bg-secondary/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Mic icon with animated rings */}
          <div className="relative mb-5">
            <div className="permission-pulse-ring w-16 h-16 rounded-full bg-primary/10 absolute -inset-1" />
            <div className="w-14 h-14 rounded-full bg-primary/20 flex items-center justify-center">
              <span className="material-symbols-outlined text-[26px] text-primary">mic</span>
            </div>
          </div>

          <h3 className="text-base font-bold text-on-surface mb-1.5">
            Microphone Access
          </h3>
          <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-5 max-w-[260px]">
            Audio Notes needs access to your microphone to record voice memos and audio clips.
          </p>

          {/* Browser prompt illustration */}
          <div className="permission-browser-prompt w-full mb-5">
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[rgba(0,0,0,0.25)] border border-outline/10">
              <div className="w-5 h-5 rounded bg-primary/20 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-[12px] text-primary">mic</span>
              </div>
              <span className="text-[11px] text-on-surface-variant flex-1 text-left">
                Allow <span className="font-semibold text-on-surface/80">notie</span> to use your microphone?
              </span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">Allow</span>
                <span className="text-[10px] text-on-surface-variant/40">|</span>
                <span className="text-[10px] text-on-surface-variant/40">Block</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full">
            <button
              onClick={onDismiss}
              className="flex-1 px-3 py-2 rounded-xl border border-outline/15 text-on-surface-variant text-xs font-medium hover:bg-surface/50 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onAllow}
              className="permission-allow-btn flex-1 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:bg-primary/90 transition-all shadow-sm flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[14px]">mic</span>
              Allow Microphone
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
