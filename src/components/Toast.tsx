import { useEffect, useState } from 'react'
import { useToastStore, type ToastType } from '../stores/toastStore'

const typeStyles: Record<ToastType, { bg: string; border: string; icon: string; iconBg: string }> = {
  error: {
    bg: 'bg-red-500/10',
    border: 'border-red-500/30',
    icon: 'error',
    iconBg: 'bg-red-500/20 text-red-400',
  },
  success: {
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: 'check_circle',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
  },
  warning: {
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: 'warning',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
  info: {
    bg: 'bg-sky-500/10',
    border: 'border-sky-500/30',
    icon: 'info',
    iconBg: 'bg-sky-500/20 text-sky-400',
  },
}

function ToastItem({ id, message, type }: { id: string; message: string; type: ToastType }) {
  const removeToast = useToastStore((s) => s.removeToast)
  const [exiting, setExiting] = useState(false)
  const style = typeStyles[type]

  const handleClose = () => {
    setExiting(true)
    setTimeout(() => removeToast(id), 200)
  }

  return (
    <div
      className={`
        flex items-start gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm
        ${style.bg} ${style.border}
        transition-all duration-200 ease-out
        ${exiting ? 'opacity-0 translate-x-4 scale-95' : 'opacity-100 translate-x-0 scale-100'}
        shadow-lg
      `}
      role="alert"
    >
      <span
        className={`material-symbols-outlined text-lg shrink-0 mt-0.5 rounded-lg p-1 ${style.iconBg}`}
        style={{ fontVariationSettings: "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24" }}
      >
        {style.icon}
      </span>
      <p className="text-sm text-on-surface flex-1 leading-relaxed">{message}</p>
      <button
        onClick={handleClose}
        className="shrink-0 mt-0.5 w-5 h-5 flex items-center justify-center rounded-md text-on-surface-variant/60 hover:text-on-surface hover:bg-on-surface/10 transition-all"
      >
        <span className="material-symbols-outlined text-[14px]">close</span>
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem id={t.id} message={t.message} type={t.type} />
        </div>
      ))}
    </div>
  )
}
