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

  // Click outside to dismiss
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
        className="permission-card w-full max-w-sm mx-4 bg-surface border border-outline/10 rounded-2xl shadow-2xl overflow-hidden"
        style={{
          boxShadow: '0 0 0 1px rgba(255,255,255,0.05), 0 25px 60px rgba(0,0,0,0.5)',
        }}
      >
        {/* Icon area with pulse ring */}
        <div className="flex flex-col items-center pt-8 pb-6 bg-gradient-to-b from-primary/5 to-transparent relative overflow-hidden">
          <div className="permission-pulse-ring absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-2 border-primary/20 animate-ping" />
          </div>
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center relative z-10 shadow-lg shadow-primary/10">
            <span className="material-symbols-outlined text-[32px] text-primary">videocam</span>
          </div>
          <h3 className="text-lg font-bold text-on-surface mt-4 relative z-10">Camera Access Required</h3>
          <p className="text-xs text-on-surface-variant/70 text-center px-6 mt-1.5 relative z-10 leading-relaxed">
            {audioMuted
              ? 'Allow camera access to record video without audio.'
              : 'Allow camera and microphone access to record video with audio.'}
          </p>
        </div>

        {/* Browser prompt mockup */}
        <div className="px-6 pb-2">
          <div className="permission-browser-prompt bg-surface-variant/30 border border-outline/10 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px] text-primary">lock</span>
                <span className="text-[10px] text-on-surface-variant/60 font-mono truncate max-w-[150px]">
                  localhost:5173
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-on-surface-variant/40 px-2 py-0.5 rounded border border-outline/10">Block</span>
                <span className="text-[10px] text-white px-2 py-0.5 rounded bg-primary font-medium">Allow</span>
              </div>
            </div>
            <p className="text-[10px] text-on-surface-variant/60 mt-1">
              {audioMuted ? 'localhost:5173 wants to use your camera' : 'localhost:5173 wants to use your camera and microphone'}
            </p>
          </div>
        </div>

        {/* Audio toggle */}
        <div className="px-6 py-2">
          <button
            onClick={onToggleAudio}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all w-full ${
              audioMuted
                ? 'border-error/30 text-error/70 bg-error/5'
                : 'border-outline/20 text-on-surface-variant hover:border-primary/30'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">
              {audioMuted ? 'mic_off' : 'mic'}
            </span>
            <span className="flex-1 text-left">{audioMuted ? 'Record without audio' : 'Record with audio'}</span>
            <span className="text-[10px] opacity-50">{audioMuted ? 'muted' : 'on'}</span>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 px-6 pb-6 pt-2">
          <button
            onClick={onDismiss}
            className="flex-1 px-3 py-2 rounded-xl border border-outline/20 text-on-surface-variant text-xs font-medium hover:bg-surface/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onAllow}
            className="permission-allow-btn flex-1 px-3 py-2 rounded-xl bg-primary text-on-primary text-xs font-semibold hover:opacity-90 transition-all shadow-sm relative overflow-hidden"
          >
            Allow {audioMuted ? 'Camera' : 'Camera & Mic'}
          </button>
        </div>
      </div>
    </div>
  )
}
