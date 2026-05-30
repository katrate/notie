import { useState, useEffect, useRef } from 'react'
import { type ShortcutCombo, eventToCombo, hasModifier, getCtrlLabel, getMetaLabel } from '../../stores/shortcutStore'

interface ShortcutCaptureProps {
  onCapture: (combo: ShortcutCombo) => void
  onCancel: () => void
}

export function ShortcutCapture({ onCapture, onCancel }: ShortcutCaptureProps) {
  const [pending, setPending] = useState<ShortcutCombo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Focus the capture area
    ref.current?.focus()

    const handler = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Escape cancels
      if (e.key === 'Escape') {
        onCancel()
        return
      }

      // Enter/Tab confirms the pending combo
      if ((e.key === 'Enter' || e.key === 'Tab') && pending) {
        onCapture(pending)
        return
      }

      // Backspace/Delete resets
      if (e.key === 'Backspace' || e.key === 'Delete') {
        setPending(null)
        setError(null)
        return
      }

      // Require at least one modifier (Ctrl, Alt, Cmd) for safety
      const combo = eventToCombo(e)
      if (!hasModifier(combo)) {
        setError('Must include Ctrl, Alt, or Cmd')
        return
      }

      // Disallow plain Escape since it cancels
      setError(null)
      setPending(combo)
    }

    const el = ref.current
    if (el) {
      el.addEventListener('keydown', handler)
      // Cleanup: remove focus trap on unmount
      return () => el.removeEventListener('keydown', handler)
    }
  }, [pending, onCapture, onCancel])

  const formatCombo = (combo: ShortcutCombo): string => {
    const parts: string[] = []
    if (combo.ctrl) parts.push(getCtrlLabel())
    if (combo.alt) parts.push('Alt')
    if (combo.shift) parts.push('Shift')
    if (combo.meta) parts.push(getMetaLabel())
    const keyLabel = combo.key === ' ' ? 'Space' : combo.key === '\\' ? '\\' : combo.key.length === 1 ? combo.key.toUpperCase() : combo.key
    parts.push(keyLabel)
    return parts.join('+')
  }

  return (
    <div
      ref={ref}
      tabIndex={0}
      className="relative inline-flex items-center gap-2 px-3 py-1 rounded-lg border-2 border-primary bg-primary/5 outline-none min-w-[120px] cursor-pointer"
      style={{ animation: 'capturePulse 1.2s ease-in-out infinite' }}
    >
      {pending ? (
        <span className="text-xs font-mono font-medium text-primary">{formatCombo(pending)}</span>
      ) : (
        <span className="text-xs text-on-surface-variant/60">Press shortcut...</span>
      )}
      <span className="text-[9px] text-on-surface-variant/40">⏎ confirm</span>

      {error && (
        <div className="absolute top-full left-0 mt-1 px-2 py-1 rounded bg-error/10 border border-error/20 text-[10px] text-error whitespace-nowrap z-10">
          {error}
        </div>
      )}

      <style>{`
        @keyframes capturePulse {
          0%, 100% { border-color: var(--color-primary, #98cbff); box-shadow: 0 0 0 0 rgba(152, 203, 255, 0.2); }
          50% { border-color: var(--color-primary, #98cbff); box-shadow: 0 0 0 4px rgba(152, 203, 255, 0.08); }
        }
      `}</style>
    </div>
  )
}
