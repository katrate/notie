import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuthStore } from '../../stores/authStore'
import { useTemplateStore } from '../../stores/templateStore'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'
import { useShortcutStore, SHORTCUT_DEFS, type ShortcutCombo, isMacPlatform } from '../../stores/shortcutStore'
import { ShortcutCapture } from './ShortcutCapture'
import {
  useThemeStore,
  ACCENT_COLORS,
  DARK_BACKGROUND_OPTIONS,
  LIGHT_BACKGROUND_OPTIONS,
  DARK_BACKGROUND_COLORS,
  LIGHT_BACKGROUND_COLORS,
  type ThemeMode,
  type BackgroundColor,
} from '../../stores/themeStore'

type Tab = 'account' | 'appearance' | 'shortcuts' | 'templates' | 'updates'
type BGOption = { id: string; label: string; isSolid: boolean }

function getGradientCSS(id: string, theme: ThemeMode): string {
  if (theme === 'dark') {
    const map: Record<string, string> = {
      gradient1: 'linear-gradient(135deg, #0f0f1a, #1a0a2e, #0f0f1a)',
      gradient2: 'linear-gradient(135deg, #1a0a0a, #2e1a0a, #1a0a1a)',
      gradient3: 'linear-gradient(135deg, #0a1a0a, #0a2e1a, #0a0f1a)',
      gradient4: 'linear-gradient(135deg, #0a0a1a, #0a1a2e, #0a0f1a)',
    }
    return map[id] || ''
  }
  const map: Record<string, string> = {
    'light-gradient1': 'linear-gradient(135deg, #fef7ff, #f0e6ff, #fef7ff)',
    'light-gradient2': 'linear-gradient(135deg, #fef7f0, #ffe6cc, #fff0f0)',
    'light-gradient3': 'linear-gradient(135deg, #f4fff4, #d4f5d4, #eef7ee)',
    'light-gradient4': 'linear-gradient(135deg, #f0f7ff, #d4e5f5, #eef4fa)',
  }
  return map[id] || ''
}

function SettingsModalContent({ onClose }: { onClose: () => void }) {
  const [activeTab, setActiveTab] = useState<Tab>('account')
  const { user, signOut } = useAuthStore()
  const { theme, accentColor, setTheme, setAccentColor } = useThemeStore()
  const bgStorageKey = `notie-bg-${theme}`
  const bgSolidKey = `notie-bg-${theme}-solid`

  const BACKGROUND_OPTIONS: BGOption[] = theme === 'dark' ? DARK_BACKGROUND_OPTIONS : LIGHT_BACKGROUND_OPTIONS
  const BACKGROUND_COLORS: BackgroundColor[] = theme === 'dark' ? DARK_BACKGROUND_COLORS : LIGHT_BACKGROUND_COLORS

  const [capturingId, setCapturingId] = useState<string | null>(null)
  const { getDisplayString, setShortcut, resetShortcut, resetAll } = useShortcutStore()

  const [background, setBackground] = useState(() => {
    try { return localStorage.getItem(bgStorageKey) || 'default' } catch { return 'default' }
  })

  useEffect(() => {
    const key = `notie-bg-${theme}`
    setBackground((() => { try { return localStorage.getItem(key) || 'default' } catch { return 'default' } })())
  }, [theme])

  const handleSignOut = async () => {
    await signOut()
    onClose()
  }

  const handleBackgroundChange = (id: string) => {
    setBackground(id)
    try { localStorage.setItem(bgStorageKey, id) } catch {}

    document.body.style.background = ''
    document.body.style.backgroundColor = ''
    document.body.style.backgroundImage = ''
    document.body.style.backgroundAttachment = ''

    if (id === 'default') return

    const gradCSS = getGradientCSS(id, theme)
    if (gradCSS) {
      document.body.style.background = gradCSS
      document.body.style.backgroundAttachment = 'fixed'
      return
    }

    const solid = BACKGROUND_COLORS.find(o => o.id === id)
    if (solid) {
      document.body.style.backgroundColor = solid.hex
      try { localStorage.setItem(bgSolidKey, solid.hex) } catch {}
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[9998] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface border border-outline/20 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col"
        style={{ animation: 'modalPop 0.18s cubic-bezier(0.34,1.56,0.64,1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-bold text-on-surface">Settings</h2>
          <Tooltip label="Close settings" position="bottom">
          <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-on-surface/10 flex items-center justify-center transition-colors text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
          </Tooltip>
        </div>

        {/* Body: sidebar tabs + content */}
        <div className="flex flex-1 min-h-0 border-t border-outline/10">
          {/* Tabs sidebar */}
          <div className="w-44 flex flex-col py-4 px-2 border-r border-outline/10 gap-0.5 flex-shrink-0">
            <Tooltip label="Account settings" position="right"><TabSidebarButton label="Account" icon="person" active={activeTab === 'account'} onClick={() => setActiveTab('account')} /></Tooltip>
            <Tooltip label="Appearance settings" position="right"><TabSidebarButton label="Appearance" icon="palette" active={activeTab === 'appearance'} onClick={() => setActiveTab('appearance')} /></Tooltip>
            <Tooltip label="Keyboard shortcuts" position="right"><TabSidebarButton label="Shortcuts" icon="keyboard" active={activeTab === 'shortcuts'} onClick={() => setActiveTab('shortcuts')} /></Tooltip>
            <Tooltip label="Manage templates" position="right"><TabSidebarButton label="Templates" icon="bookmark" active={activeTab === 'templates'} onClick={() => setActiveTab('templates')} /></Tooltip>
            <Tooltip label="Updates" position="right"><TabSidebarButton label="Updates" icon="system_update" active={activeTab === 'updates'} onClick={() => setActiveTab('updates')} /></Tooltip>
          </div>

          {/* Content */}
          <div className="flex-1 p-6 overflow-y-auto max-h-[60vh]">
          {activeTab === 'account' && (
            <div className="space-y-6">
              {/* User info */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-variant/20 border border-outline/10">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center text-lg text-primary font-bold flex-shrink-0">
                  {(user?.email?.charAt(0) || 'U').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{user?.email || 'User'}</p>
                  <p className="text-xs text-on-surface-variant">Signed in</p>
                </div>
              </div>

              {/* Sign out */}
              <button
                onClick={handleSignOut}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-error/30 text-error hover:bg-error/10 transition-colors text-sm font-medium"
              >
                <span className="material-symbols-outlined text-[18px]">logout</span>
                Sign Out
              </button>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Customizable Shortcuts</p>
                <button
                  onClick={resetAll}
                  className="px-2 py-1 rounded-md text-[10px] font-medium text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                >
                  Reset all
                </button>
              </div>
              <p className="text-[11px] text-on-surface-variant/60 mb-3">Click a shortcut to remap it, then press your desired key combination. Must include Ctrl, Alt{isMacPlatform() ? '' : ', or Cmd'}.</p>

              <p className="text-[10px] font-medium text-on-surface-variant/80 uppercase tracking-wider mb-2">General</p>
              <div className="space-y-0.5">
                {SHORTCUT_DEFS.filter(s => s.category === 'general').map(sc => (
                  <ShortcutRow
                    key={sc.id}
                    def={sc}
                    display={getDisplayString(sc.id)}
                    isCapturing={capturingId === sc.id}
                    onStartCapture={() => setCapturingId(sc.id)}
                    onCapture={(combo) => {
                      setShortcut(sc.id, combo)
                      setCapturingId(null)
                    }}
                    onCancel={() => setCapturingId(null)}
                    onReset={() => resetShortcut(sc.id)}
                  />
                ))}
              </div>

              <p className="text-[10px] font-medium text-on-surface-variant/80 uppercase tracking-wider mb-2 mt-5">Page Creation</p>
              <div className="space-y-0.5">
                {SHORTCUT_DEFS.filter(s => s.category === 'page-creation').map(sc => (
                  <ShortcutRow
                    key={sc.id}
                    def={sc}
                    display={getDisplayString(sc.id)}
                    isCapturing={capturingId === sc.id}
                    onStartCapture={() => setCapturingId(sc.id)}
                    onCapture={(combo) => {
                      setShortcut(sc.id, combo)
                      setCapturingId(null)
                    }}
                    onCancel={() => setCapturingId(null)}
                    onReset={() => resetShortcut(sc.id)}
                  />
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-outline/10">
                <p className="text-[10px] font-medium text-on-surface-variant/60 uppercase tracking-wider mb-3">Built-in (not customizable)</p>
                <div className="space-y-0.5">
                  {buildBuiltinShortcuts().map(sc => (
                    <div key={sc.keys} className="flex items-center justify-between px-3 py-1.5 rounded-lg">
                      <span className="text-sm text-on-surface/70">{sc.label}</span>
                      <kbd className="px-2 py-0.5 bg-on-surface/10 rounded text-xs text-on-surface-variant font-mono min-w-[60px] text-center">{sc.keys}</kbd>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <TemplateManagerTab />
          )}

          {activeTab === 'updates' && (
            <UpdatesTabContent />
          )}

          {activeTab === 'appearance' && (
            <div className="space-y-6">
              {/* Dark / Light toggle */}
              <div>
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Theme</p>
                <div className="flex gap-2">
                  {(['dark', 'light'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setTheme(mode)}
                      className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                        theme === mode
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-outline/20 text-on-surface-variant hover:bg-on-surface/5'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {mode === 'dark' ? 'dark_mode' : 'light_mode'}
                      </span>
                      {mode === 'dark' ? 'Dark' : 'Light'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Accent color */}
              <div>
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Accent Color</p>
                <div className="flex flex-wrap gap-3">
                  {ACCENT_COLORS.map((c) => (
                    <Tooltip key={c.hex} label={c.name} position="bottom">
                    <button
                      onClick={() => setAccentColor(c.hex)}
                    >
                      <div
                        className={`w-8 h-8 rounded-full transition-all ${
                          accentColor === c.hex
                            ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                    </Tooltip>
                  ))}
                </div>
              </div>

              {/* Background */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider">Background</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${theme === 'dark' ? 'bg-primary/15 text-primary' : 'bg-amber-500/15 text-amber-500'}`}>
                    {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                  </span>
                </div>
                {/* Gradients */}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  {BACKGROUND_OPTIONS.map((opt) => {
                    const gradCSS = getGradientCSS(opt.id, theme)
                    return (
                      <Tooltip key={opt.id} label={opt.label} position="bottom">
                      <button
                        onClick={() => handleBackgroundChange(opt.id)}
                        className={`aspect-[3/2] rounded-xl border-2 transition-all ${
                          background === opt.id
                            ? 'border-primary scale-105'
                            : 'border-outline/10 hover:border-outline/30'
                        }`}
                        style={gradCSS ? { background: gradCSS } : undefined}
                      >
                        {opt.id === 'default' && (
                          <div className="w-full h-full rounded-[10px] bg-surface flex items-center justify-center">
                            <span className="material-symbols-outlined text-[16px] text-on-surface-variant">grid_view</span>
                          </div>
                        )}
                      </button>
                      </Tooltip>
                    )
                  })}
                </div>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {BACKGROUND_OPTIONS.map((opt) => (
                    <span
                      key={opt.id}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        background === opt.id ? 'text-primary' : 'text-on-surface-variant'
                      }`}
                    >
                      {opt.label}
                    </span>
                  ))}
                </div>

                {/* Solid Colors */}
                <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Solid Color</p>
                <div className="flex flex-wrap gap-2.5">
                  {BACKGROUND_COLORS.map((c) => (
                    <Tooltip key={c.id} label={c.label} position="bottom">
                    <button
                      onClick={() => handleBackgroundChange(c.id)}
                    >
                      <div
                        className={`w-7 h-7 rounded-full transition-all ${
                          background === c.id
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-outline/10 flex justify-between items-center">
          <span className="text-[11px] text-on-surface-variant">v0.1.0</span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
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

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) return null

  return createPortal(
    <SettingsModalContent onClose={onClose} />,
    document.body
  )
}

function UpdatesTabContent() {
  const [currentVersion, setCurrentVersion] = useState('')
  const [status, setStatus] = useState<'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'not-available' | 'error'>('idle')
  const [updateInfo, setUpdateInfo] = useState<{ version: string } | null>(null)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Check if running in Electron
  const isElectron = !!window.electronAPI

  useEffect(() => {
    if (!isElectron) return
    window.electronAPI!.getAppVersion().then(setCurrentVersion)
  }, [isElectron])

  useEffect(() => {
    if (!isElectron) return
    const api = window.electronAPI!
    const cleanupFns: (() => void)[] = []

    cleanupFns.push(api.onUpdateChecking(() => { setStatus('checking'); setErrorMsg(null) }))
    cleanupFns.push(api.onUpdateAvailable((info) => { setStatus('available'); setUpdateInfo(info); setErrorMsg(null) }))
    cleanupFns.push(api.onUpdateNotAvailable(() => { setStatus('not-available') }))
    cleanupFns.push(api.onUpdateDownloadProgress((p) => { setStatus('downloading'); setDownloadProgress(Math.round(p.percent)) }))
    cleanupFns.push(api.onUpdateDownloaded((info) => { setStatus('downloaded'); setUpdateInfo(info); setDownloadProgress(100) }))
    cleanupFns.push(api.onUpdateError((err) => { setStatus('error'); setErrorMsg(err) }))

    return () => cleanupFns.forEach(fn => fn())
  }, [isElectron])

  const handleCheck = async () => {
    if (!isElectron) return
    setStatus('checking'); setErrorMsg(null)
    const result = await window.electronAPI!.checkForUpdates()
    if (result.error) { setStatus('error'); setErrorMsg(result.error) }
  }

  const handleDownload = async () => {
    if (!isElectron) return
    setStatus('downloading'); setDownloadProgress(0)
    const result = await window.electronAPI!.downloadUpdate()
    if (result.error) { setStatus('error'); setErrorMsg(result.error) }
  }

  const handleInstall = async () => {
    if (!isElectron) return
    await window.electronAPI!.installUpdate()
  }

  if (!isElectron) {
    return (
      <div className="space-y-4">
        <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Updates</p>
        <div className="flex flex-col items-center justify-center py-8 px-4 rounded-xl border border-outline/10 bg-surface-variant/10">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 block mb-2">computer</span>
          <p className="text-sm text-on-surface-variant">Auto-updates are only available in the desktop app.</p>
          <a
            href="https://github.com/katrate/notie/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 px-4 py-2 rounded-lg bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Go to Releases
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Updates</p>

      {/* Current version */}
      <div className="flex items-center justify-between p-4 rounded-xl bg-surface-variant/20 border border-outline/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-[20px] text-primary">info</span>
          <div>
            <p className="text-sm font-medium text-on-surface">Current Version</p>
            <p className="text-xs text-on-surface-variant">Notie v{currentVersion || '...'}</p>
          </div>
        </div>
        <button
          onClick={handleCheck}
          disabled={status === 'checking'}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-outline/20 text-on-surface-variant hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-colors text-xs font-medium disabled:opacity-50"
        >
          {status === 'checking' ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Checking...
            </>
          ) : (
            <>
              <span className="material-symbols-outlined text-[14px]">refresh</span>
              Check for Updates
            </>
          )}
        </button>
      </div>

      {status === 'not-available' && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
          <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
          <p className="text-sm text-on-surface">You're up to date! Notie v{currentVersion} is the latest version.</p>
        </div>
      )}

      {status === 'available' && updateInfo && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-accent/10 border border-accent/30">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-accent">system_update</span>
            <div>
              <p className="text-sm font-medium text-on-surface">Update Available</p>
              <p className="text-xs text-on-surface-variant">Version {updateInfo.version} is ready to download</p>
            </div>
          </div>
          <button
            onClick={handleDownload}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent/90 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Update
          </button>
        </div>
      )}

      {status === 'downloading' && (
        <div className="flex flex-col gap-2 p-4 rounded-xl bg-primary/10 border border-primary/30">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-primary">download</span>
            <span className="text-sm font-medium text-on-surface">Downloading...</span>
          </div>
          <div className="w-full h-2 rounded-full bg-surface-variant/40 overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
          </div>
          <span className="text-xs text-on-surface-variant">{downloadProgress}% complete</span>
        </div>
      )}

      {status === 'downloaded' && (
        <div className="flex flex-col gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[20px] text-emerald-400">check_circle</span>
            <div>
              <p className="text-sm font-medium text-on-surface">Update Downloaded</p>
              <p className="text-xs text-on-surface-variant">Restart the app to install the update</p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-500 text-white text-sm font-medium hover:bg-emerald-600 transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">restart_alt</span>
            Restart & Install
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
          <span className="material-symbols-outlined text-[20px] text-red-400 flex-shrink-0 mt-0.5">error</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-on-surface">Update Check Failed</p>
            <p className="text-xs text-on-surface-variant mt-1">{errorMsg || 'Could not reach the update server.'}</p>
            <button
              onClick={handleCheck}
              className="mt-2 px-3 py-1.5 rounded-lg bg-on-surface/10 text-on-surface-variant hover:bg-on-surface/20 transition-colors text-xs font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TemplateManagerTab() {
  const { templates, loading, fetchTemplates, deleteTemplate, updateTemplateStructure } = useTemplateStore()
  const { activePageId } = useProjectStore()
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [updateMsg, setUpdateMsg] = useState<{ id: string; text: string; err?: boolean } | null>(null)

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleDelete = async (id: string) => {
    await deleteTemplate(id)
    setConfirmDeleteId(null)
  }

  const handleUpdate = async (templateId: string, templateName: string) => {
    if (!activePageId) {
      setUpdateMsg({ id: templateId, text: 'No page is currently open. Open a page first.', err: true })
      setTimeout(() => setUpdateMsg(null), 3000)
      return
    }
    setUpdatingId(templateId)
    setUpdateMsg(null)
    await updateTemplateStructure(templateId, activePageId)
    setUpdatingId(null)
    const err = useTemplateStore.getState().error
    if (err) {
      setUpdateMsg({ id: templateId, text: err, err: true })
    } else {
      setUpdateMsg({ id: templateId, text: `Template "${templateName}" updated!` })
    }
    setTimeout(() => setUpdateMsg(null), 3000)
  }

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-on-surface-variant uppercase tracking-wider mb-3">Manage Templates</p>
      <p className="text-sm text-on-surface-variant mb-4">
        Templates store the structure of a page and its children (titles, icons, types — not content).
        Save a template from any page using the bookmark icon in the page header.
      </p>

      {loading && templates.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-8 px-4 rounded-xl border border-outline/10 bg-surface-variant/10">
          <span className="material-symbols-outlined text-[32px] text-on-surface-variant/40 block mb-2">bookmark</span>
          <p className="text-sm text-on-surface-variant">No templates yet.</p>
          <p className="text-xs text-on-surface-variant/60 mt-1">Open a page and click the bookmark icon to save it as a template.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-outline/10 hover:bg-on-surface/5 transition-colors">
              <span className="material-symbols-outlined text-[20px] text-primary flex-shrink-0">{t.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-on-surface truncate">{t.name}</p>
                {t.description && (
                  <p className="text-xs text-on-surface-variant truncate">{t.description}</p>
                )}
                <p className="text-[10px] text-on-surface-variant/60 mt-0.5">
                  {countNodes(t.structure)} page{countNodes(t.structure) !== 1 ? 's' : ''} in template
                </p>
                {updateMsg && updateMsg.id === t.id && (
                  <p className={`text-[10px] mt-0.5 ${updateMsg.err ? 'text-error' : 'text-emerald-400'}`}>
                    {updateMsg.text}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 ml-2">
                {/* Update from current page */}
                <Tooltip label="Update from current page" position="top">
                <button
                  onClick={() => handleUpdate(t.id, t.name)}
                  disabled={updatingId === t.id}
                  className="p-1.5 rounded-lg text-on-surface-variant hover:text-primary hover:bg-primary/10 transition-colors disabled:opacity-40"
                >
                  {updatingId === t.id ? (
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="material-symbols-outlined text-[16px]">refresh</span>
                  )}
                </button>
                </Tooltip>
                {confirmDeleteId === t.id ? (
                  <>
                    <button
                      onClick={() => handleDelete(t.id)}
                      className="px-2 py-1 rounded-md bg-error/20 text-error text-xs font-medium hover:bg-error/30 transition-colors"
                    >
                      Confirm Delete
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2 py-1 rounded-md text-on-surface-variant text-xs hover:bg-on-surface/10 transition-colors"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <Tooltip label="Delete template" position="top">
                  <button
                    onClick={() => setConfirmDeleteId(t.id)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                  </Tooltip>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function countNodes(node: { children?: any[] }): number {
  let count = 1
  if (node.children) {
    for (const child of node.children) {
      count += countNodes(child)
    }
  }
  return count
}

/** Build platform-aware keyboard shortcut display strings for built-in (non-customizable) shortcuts */
function buildBuiltinShortcuts() {
  const mod = isMacPlatform() ? '⌘' : 'Ctrl'
  return [
    { keys: `${mod}+P`, label: 'Open Command Palette / Search' },
    { keys: 'Esc', label: 'Close modals, cancel editing' },
    { keys: 'Enter', label: 'Confirm input' },
    { keys: 'Shift+Click', label: 'Graph: Add to multi-select' },
    { keys: `${mod}+Z`, label: 'Undo (Table)' },
    { keys: `${mod}+B`, label: 'Bold' },
    { keys: `${mod}+I`, label: 'Italic' },
    { keys: `${mod}+U`, label: 'Underline' },
    { keys: `${mod}+Shift+X`, label: 'Strikethrough' },
    { keys: `${mod}+Shift+U`, label: 'Toggle Case' },
    { keys: `${mod}+K`, label: 'Insert Page Link' },
    { keys: `${mod}+Alt+1`, label: 'Heading 1' },
    { keys: `${mod}+Alt+2`, label: 'Heading 2' },
    { keys: `${mod}+Shift+8`, label: 'Bullet List' },
    { keys: `${mod}+Shift+9`, label: 'Task List' },
    { keys: `${mod}+Shift+B`, label: 'Create Block' },
    { keys: `${mod}+Shift+H`, label: 'Highlight' },
    { keys: '/ (slash)', label: 'Open Commands Menu' },
    { keys: 'Right-click', label: 'Context Menu (Insert pages, images, cards)' },
  ]
}

function ShortcutRow({ def, display, isCapturing, onStartCapture, onCapture, onCancel, onReset }: {
  def: { id: string; label: string; default: ShortcutCombo }
  display: string
  isCapturing: boolean
  onStartCapture: () => void
  onCapture: (combo: ShortcutCombo) => void
  onCancel: () => void
  onReset: () => void
}) {
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${isCapturing ? 'bg-primary/5' : 'hover:bg-on-surface/5'}`}>
      <span className="text-sm text-on-surface">{def.label}</span>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onReset}
          className="p-1 rounded text-[10px] text-on-surface-variant/30 hover:text-on-surface-variant/60 transition-colors"
          title="Reset to default"
        >
          <span className="material-symbols-outlined text-[12px]">refresh</span>
        </button>
        {isCapturing ? (
          <ShortcutCapture
            onCapture={onCapture}
            onCancel={onCancel}
          />
        ) : (
          <button
            onClick={onStartCapture}
            className="px-2 py-0.5 bg-on-surface/10 hover:bg-primary/20 rounded text-xs text-on-surface-variant font-mono min-w-[60px] text-center transition-colors hover:text-primary cursor-pointer"
          >
            {display}
          </button>
        )}
      </div>
    </div>
  )
}

function TabSidebarButton({ label, icon, active, onClick }: { label: string; icon: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${
        active
          ? 'bg-primary/15 text-primary'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
      }`}
    >
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
      {label}
    </button>
  )
}
