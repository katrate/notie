import { useEffect, useState, useCallback } from 'react'

type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'downloaded'
  | 'not-available'
  | 'error'

interface UpdateInfo {
  version: string
  releaseDate?: string
  releaseName?: string
  releaseNotes?: string
}

export function UpdateBanner() {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [currentVersion, setCurrentVersion] = useState('')

  // Get current app version on mount
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(setCurrentVersion)
    }
  }, [])

  // Listen for update events
  useEffect(() => {
    if (!window.electronAPI) return

    const cleanupFns: (() => void)[] = []

    cleanupFns.push(
      window.electronAPI.onUpdateChecking(() => {
        setStatus('checking')
        setErrorMsg(null)
      })
    )

    cleanupFns.push(
      window.electronAPI.onUpdateAvailable((info) => {
        setStatus('available')
        setUpdateInfo(info)
        setErrorMsg(null)
        setDismissed(false)
      })
    )

    cleanupFns.push(
      window.electronAPI.onUpdateNotAvailable(() => {
        setStatus('not-available')
        // Auto-hide after 5s
        setTimeout(() => setStatus('idle'), 5000)
      })
    )

    cleanupFns.push(
      window.electronAPI.onUpdateDownloadProgress((progress) => {
        setStatus('downloading')
        setDownloadProgress(Math.round(progress.percent))
      })
    )

    cleanupFns.push(
      window.electronAPI.onUpdateDownloaded((info) => {
        setStatus('downloaded')
        setUpdateInfo(info)
        setDownloadProgress(100)
      })
    )

    cleanupFns.push(
      window.electronAPI.onUpdateError((error) => {
        setStatus('error')
        setErrorMsg(error)
      })
    )

    return () => cleanupFns.forEach(fn => fn())
  }, [])

  const handleDownload = useCallback(async () => {
    if (!window.electronAPI) return
    setStatus('downloading')
    setDownloadProgress(0)
    const result = await window.electronAPI.downloadUpdate()
    if (result.error) {
      setStatus('error')
      setErrorMsg(result.error)
    }
  }, [])

  const handleInstall = useCallback(async () => {
    if (!window.electronAPI) return
    await window.electronAPI.installUpdate()
  }, [])

  const handleCheckNow = useCallback(async () => {
    if (!window.electronAPI) return
    setStatus('checking')
    setDismissed(false)
    setErrorMsg(null)
    await window.electronAPI.checkForUpdates()
  }, [])

  // Don't show if dismissed or in electron-less env
  if (!window.electronAPI || dismissed) return null

  // Only show when there's an actionable state
  if (status === 'idle' || status === 'not-available') return null

  return (
    <div className="px-3 pb-3 border-t border-outline/10 pt-3">
      {status === 'checking' && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-variant/30">
          <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[11px] text-on-surface-variant">Checking for updates...</span>
        </div>
      )}

      {status === 'available' && updateInfo && (
        <div className="rounded-lg border border-accent/30 bg-accent/10 p-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-accent flex-shrink-0 mt-0.5">system_update</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">
                Update available
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                v{currentVersion} → {updateInfo.version}
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleDownload}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-accent text-on-accent text-[11px] font-medium hover:bg-accent/90 transition-colors"
                >
                  Download
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-2 py-1.5 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-[11px]"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'downloading' && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="material-symbols-outlined text-[16px] text-primary">download</span>
            <span className="text-[11px] font-medium text-on-surface">Downloading update...</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-surface-variant/40 overflow-hidden">
            <div
              className="h-full rounded-full bg-primary transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
          <span className="text-[10px] text-on-surface-variant mt-1 block">{downloadProgress}%</span>
        </div>
      )}

      {status === 'downloaded' && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-emerald-400 flex-shrink-0 mt-0.5">check_circle</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">
                Update ready to install
              </p>
              <p className="text-[10px] text-on-surface-variant mt-0.5">
                {updateInfo?.version && `v${updateInfo.version} — `}Restart to apply
              </p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={handleInstall}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[11px] font-medium hover:bg-emerald-600 transition-colors"
                >
                  Restart & Install
                </button>
                <button
                  onClick={() => setDismissed(true)}
                  className="px-2 py-1.5 rounded-lg text-on-surface-variant hover:bg-on-surface/10 transition-colors text-[11px]"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
          <div className="flex items-start gap-2">
            <span className="material-symbols-outlined text-[16px] text-red-400 flex-shrink-0 mt-0.5">error</span>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-on-surface">Update check failed</p>
              <p className="text-[10px] text-on-surface-variant mt-0.5 truncate">{errorMsg}</p>
              <button
                onClick={handleCheckNow}
                className="mt-2 px-3 py-1 rounded-lg bg-on-surface/10 text-on-surface-variant hover:bg-on-surface/20 transition-colors text-[10px] font-medium"
              >
                Try again
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
