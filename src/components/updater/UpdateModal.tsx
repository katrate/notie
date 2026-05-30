import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { check } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { useToastStore } from '../../stores/toastStore'

interface UpdateInfo {
  version: string
  notes?: string
  date?: string
}

type CheckState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'up-to-date' | 'error'

export function UpdateModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <UpdateModalContent onClose={onClose} />,
    document.body
  )
}

function UpdateModalContent({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<CheckState>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState('')
  const toast = useToastStore(s => s.toast)

  const handleCheck = useCallback(async () => {
    setState('checking')
    setErrorMsg('')

    try {
      const update = await check()

      if (update) {
        setUpdateInfo({
          version: update.version,
          notes: update.body || undefined,
          date: update.date || undefined,
        })
        setState('available')
        toast(`Update v${update.version} available!`, 'info', 5000)
      } else {
        setState('up-to-date')
        toast('You are on the latest version!', 'success', 2000)
      }
    } catch (err: any) {
      setState('error')
      setErrorMsg(err?.message || err?.toString() || 'Failed to check for updates')
      toast('Could not check for updates. Check your internet connection.', 'warning')
    }
  }, [toast])

  const handleDownloadAndInstall = useCallback(async () => {
    setState('downloading')
    setProgress(0)

    try {
      const update = await check()
      if (!update) {
        setState('up-to-date')
        return
      }

      // Track progress: accumulate chunk bytes vs total content length
      let totalBytes = 0
      let downloadedBytes = 0

      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          totalBytes = event.data.contentLength ?? 0
          setProgress(0)
        } else if (event.event === 'Progress') {
          downloadedBytes += event.data.chunkLength ?? 0
          const pct = totalBytes > 0 ? (downloadedBytes / totalBytes) * 100 : 0
          setProgress(Math.min(pct, 100))
        } else if (event.event === 'Finished') {
          setProgress(100)
        }
      })

      // After download+install, the app will restart automatically
      try {
        await relaunch()
      } catch {
        toast('Update installed. Please restart the app manually.', 'warning', 5000)
      }
    } catch (err: any) {
      setState('error')
      setErrorMsg(err?.message || err?.toString() || 'Installation failed')
      toast('Update installation failed', 'error')
    }
  }, [toast])

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-outline/20 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        style={{ animation: 'modalPop 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-on-surface">Update</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-on-surface/10 flex items-center justify-center transition-colors text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="px-6 pb-6 space-y-5">
          {/* Current version */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-variant/20 border border-outline/10">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-[20px] text-primary">info</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-on-surface">Current version</p>
              <p className="text-xs text-on-surface-variant">v0.1.0</p>
            </div>
          </div>

          {/* State-dependent content */}
          {state === 'idle' && (
            <div className="text-center py-4">
              <p className="text-sm text-on-surface-variant mb-4">
                Check if a newer version of Notie is available.
              </p>
              <button
                onClick={handleCheck}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">system_update</span>
                Check for Updates
              </button>
            </div>
          )}

          {state === 'checking' && (
            <div className="text-center py-6">
              <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-on-surface-variant">Checking for updates…</p>
            </div>
          )}

          {state === 'up-to-date' && (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px] text-emerald-400">check_circle</span>
              </div>
              <p className="text-sm font-medium text-on-surface">You're up to date!</p>
              <p className="text-xs text-on-surface-variant mt-1">Notie v0.1.0 is the latest version.</p>
              <button
                onClick={handleCheck}
                className="mt-4 px-4 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Check again
              </button>
            </div>
          )}

          {state === 'available' && updateInfo && (
            <div className="space-y-4">
              {/* Update info card */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px] text-primary">system_update</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">v{updateInfo.version} available</p>
                    <p className="text-[10px] text-on-surface-variant/60">
                      {updateInfo.date ? new Date(updateInfo.date).toLocaleDateString() : ''}
                    </p>
                  </div>
                </div>
                {updateInfo.notes && (
                  <div className="text-xs text-on-surface-variant/80 leading-relaxed max-h-32 overflow-y-auto bg-surface/50 rounded-lg p-3 border border-outline/5">
                    {updateInfo.notes.split('\n').map((line, i) => (
                      <p key={i} className="mb-1">{line}</p>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleDownloadAndInstall}
                className="w-full px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors inline-flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
                Download & Install
              </button>
            </div>
          )}

          {state === 'downloading' && (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-on-surface">Downloading update…</p>
                  <p className="text-xs text-on-surface-variant">{progress > 0 ? `${Math.round(progress)}%` : 'Starting…'}</p>
                </div>
              </div>
              {progress > 0 && (
                <div className="w-full h-2 bg-surface-variant/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(progress, 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}

          {state === 'downloaded' && (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-primary/15 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px] text-primary">system_update</span>
              </div>
              <p className="text-sm font-medium text-on-surface">Update ready!</p>
              <p className="text-xs text-on-surface-variant mt-1">Restarting to apply the update…</p>
            </div>
          )}

          {state === 'error' && (
            <div className="text-center py-4">
              <div className="h-14 w-14 rounded-full bg-error/15 flex items-center justify-center mx-auto mb-3">
                <span className="material-symbols-outlined text-[28px] text-error">error</span>
              </div>
              <p className="text-sm font-medium text-on-surface">Update check failed</p>
              {errorMsg && (
                <p className="text-xs text-on-surface-variant/80 mt-1 max-w-xs mx-auto">{errorMsg}</p>
              )}
              <button
                onClick={handleCheck}
                className="mt-4 px-4 py-1.5 rounded-lg text-xs text-primary hover:bg-primary/10 transition-colors inline-flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-[14px]">refresh</span>
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: scale(0.88); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
