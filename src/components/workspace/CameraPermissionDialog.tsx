import { useEffect, useRef } from 'react'

interface CameraPermissionDialogProps {
  audioMuted: boolean
  onToggleAudio: () => void
  onAllow: () => void
  onDismiss: () => void
}

export function CameraPermissionDialog({
  audioMuted,
  onToggleAudio,
  onAllow,
  onDismiss,
}: CameraPermissionDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onDismiss])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(e.target as Node)) {
        onDismiss()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onDismiss])

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center permission-overlay">
      <div
        ref={dialogRef}
        className="permission-card w-full max-w-sm mx-4"
      >
        <div className="flex flex-col items-center pt-8 pb-5 relative overflow-hidden">
          <div className="w-16 h-16 rounded-full flex items-center justify-center relative z-10" style={{ background: 'linear-gradient(135deg, rgba(152,203,255,0.2), rgba(152,203,255,0.05))' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(152,203,255,0.25), rgba(152,203,255,0.08))' }}>
              <span className="material-symbols-outlined text-[28px] text-primary">videocam</span>
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-28 h-28 rounded-full border border-primary/10" style={{ animation: 'permRing 2.5s ease-in-out infinite' }} />
            <div className="w-36 h-36 rounded-full border border-primary/5" style={{ animation: 'permRing 2.5s ease-in-out infinite 0.3s' }} />
          </div>
          <h3 className="text-lg font-bold text-on-surface mt-4 relative z-10">Camera Access</h3>
          <p className="text-xs text-on-surface-variant/70 text-center px-8 mt-1.5 relative z-10 leading-relaxed">
            {audioMuted
              ? 'Notie needs camera access to record video.'
              : 'Notie needs camera and microphone access to record video with audio.'}
          </p>
        </div>

        <div className="px-6 pb-3">
          <button
            onClick={onToggleAudio}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border text-xs font-medium transition-all w-full ${
              audioMuted
                ? 'border-error/25 text-error/70 bg-error/5'
                : 'border-outline/15 text-on-surface-variant hover:border-primary/30 hover:bg-primary/5'
            }`}
          >
            <span className={`material-symbols-outlined text-[16px] ${audioMuted ? '' : 'text-primary'}`}>
              {audioMuted ? 'mic_off' : 'mic'}
            </span>
            <span className="flex-1 text-left text-sm">{audioMuted ? 'Record without audio' : 'Record with audio'}</span>
          </button>
        </div>

        <div className="flex items-center gap-2 px-6 pb-6 pt-1">
          <button
            onClick={onDismiss}
            className="flex-1 px-3 py-2.5 rounded-xl border border-outline/15 text-on-surface-variant text-sm font-medium hover:bg-surface/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onAllow}
            className="permission-allow-btn flex-1 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 80%, white))', color: '#000' }}
          >
            Allow {audioMuted ? 'Camera' : 'Camera & Mic'}
          </button>
        </div>
      </div>
    </div>
  )
}