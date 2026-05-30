import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  onAllow: () => void
  onDismiss: () => void
}

export function MicPermissionDialog({ onAllow, onDismiss }: Props) {
  const cardRef = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

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
        className={`permission-card relative w-full max-w-sm p-0 transition-all duration-300 ${
          visible ? 'scale-100 translate-y-0' : 'scale-95 translate-y-4'
        }`}
        onClick={e => e.stopPropagation()}
      >
        <div className="relative z-10 flex flex-col items-center text-center pt-8 pb-5">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(152,203,255,0.2), rgba(152,203,255,0.05))' }}>
              <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(152,203,255,0.25), rgba(152,203,255,0.08))' }}>
                <span className="material-symbols-outlined text-[26px] text-primary">mic</span>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-28 h-28 rounded-full border border-primary/10" style={{ animation: 'permRing 2.5s ease-in-out infinite' }} />
              <div className="w-36 h-36 rounded-full border border-primary/5" style={{ animation: 'permRing 2.5s ease-in-out infinite 0.3s' }} />
            </div>
          </div>

          <h3 className="text-base font-bold text-on-surface mb-1.5">
            Microphone Access
          </h3>
          <p className="text-xs text-on-surface-variant/80 leading-relaxed mb-2 max-w-[260px]">
            Notie needs access to your microphone to record voice memos and audio clips.
          </p>
        </div>

        <div className="flex items-center gap-2 px-6 pb-6">
          <button
            onClick={onDismiss}
            className="flex-1 px-3 py-2.5 rounded-xl border border-outline/15 text-on-surface-variant text-sm font-medium hover:bg-surface/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onAllow}
            className="permission-allow-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm flex items-center justify-center gap-1.5"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, white))', color: '#000' }}
          >
            <span className="material-symbols-outlined text-[14px]">mic</span>
            Allow Microphone
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}