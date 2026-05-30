import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
import { saveOnboardingSettings } from '../../stores/projectStore'

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

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const { setTheme, setAccentColor } = useThemeStore()

  // Default selections: Dark + Purple + Charcoal
  const [theme, setLocalTheme] = useState<ThemeMode>('dark')
  const [accentColor, setLocalAccent] = useState('#a78bfa')
  const [backgroundColor, setLocalBackground] = useState('bg-charcoal')
  const [saving, setSaving] = useState(false)
  const [step, setStep] = useState(0)

  const BACKGROUND_OPTIONS: BGOption[] = theme === 'dark' ? DARK_BACKGROUND_OPTIONS : LIGHT_BACKGROUND_OPTIONS
  const BACKGROUND_COLORS: BackgroundColor[] = theme === 'dark' ? DARK_BACKGROUND_COLORS : LIGHT_BACKGROUND_COLORS

  // Particles effect (same as auth screen)
  useEffect(() => {
    const container = document.getElementById('onboarding-particles')
    if (!container) return
    const particleCount = 30
    for (let i = 0; i < particleCount; i++) {
      const p = document.createElement('div')
      p.className = 'particle'
      const size = Math.random() * 3 + 1
      p.style.width = `${size}px`
      p.style.height = `${size}px`
      p.style.left = `${Math.random() * 100}%`
      p.style.top = `${Math.random() * 100}%`
      p.animate([
        { transform: 'translate(0, 0)', opacity: 0.1 },
        { transform: `translate(${Math.random() * 80 - 40}px, ${Math.random() * 80 - 40}px)`, opacity: 0.3 },
        { transform: 'translate(0, 0)', opacity: 0.1 },
      ], {
        duration: (Math.random() * 20 + 10) * 1000,
        iterations: Infinity,
        delay: Math.random() * -20 * 1000,
        easing: 'ease-in-out',
      })
      container.appendChild(p)
    }
    return () => { container.innerHTML = '' }
  }, [])

  // Handle theme change — apply immediately for preview
  const handleThemeChange = (mode: ThemeMode) => {
    setLocalTheme(mode)
    setTheme(mode)
  }

  const handleAccentChange = (hex: string) => {
    setLocalAccent(hex)
    setAccentColor(hex)
  }

  const handleBackgroundChange = (id: string) => {
    setLocalBackground(id)
    const storageKey = `notie-bg-${theme}`
    const solidKey = `notie-bg-${theme}-solid`
    try { localStorage.setItem(storageKey, id) } catch {}

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

    const solid = (theme === 'dark' ? DARK_BACKGROUND_COLORS : LIGHT_BACKGROUND_COLORS).find(c => c.id === id)
    if (solid) {
      document.body.style.backgroundColor = solid.hex
      try { localStorage.setItem(solidKey, solid.hex) } catch {}
    }
  }

  const handleGetStarted = async () => {
    setSaving(true)
    try {
      // Save to localStorage (immediate)
      setTheme(theme)
      setAccentColor(accentColor)
      handleBackgroundChange(backgroundColor)

      // Save to profile in Supabase
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await saveOnboardingSettings(user.id, theme, accentColor, backgroundColor)
      }
    } catch (err) {
      console.error('Onboarding save error:', err)
    }
    setSaving(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="aurora" />
      <div className="absolute inset-0 overflow-hidden pointer-events-none" id="onboarding-particles" />

      {/* Backdrop — subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/20 to-background/60 pointer-events-none" />

      {/* Main content */}
      <div className="relative z-10 w-full max-w-2xl px-4 animate-fade-in">
        <div
          className="glass-panel rounded-[32px] p-8 md:p-10 flex flex-col items-center"
          style={{ animation: 'onboardingPop 0.5s cubic-bezier(0.34,1.56,0.64,1)' }}
        >
          {/* Icon + Title */}
          <div className="mb-6 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
              <span className="material-symbols-outlined text-[32px] text-primary" style={{ fontVariationSettings: "'FILL' 1, 'wght' 300" }}>
                  palette
                </span>
              </div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">Welcome to Notie</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
              Personalize your workspace to match your style. You can always change these later in Settings.
            </p>
          </div>

          {/* Steps progress */}
          <div className="flex items-center gap-2 mb-6">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-2">
                <div
                  className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                    i === step ? 'bg-primary scale-125' : i < step ? 'bg-primary/50' : 'bg-on-surface/20'
                  }`}
                />
                {i < 2 && <div className={`w-6 h-px transition-colors duration-300 ${i < step ? 'bg-primary/40' : 'bg-on-surface/10'}`} />}
              </div>
            ))}
          </div>

          {/* Step labels */}
          <div className="flex items-center gap-2 mb-8">
            {['Theme', 'Accent', 'Background'].map((label, i) => (
              <span
                key={label}
                className={`text-[10px] uppercase tracking-wider font-medium transition-colors ${
                  i === step ? 'text-primary' : i < step ? 'text-primary/50' : 'text-on-surface-variant/40'
                }`}
                style={{ minWidth: 80, textAlign: 'center' }}
              >
                {label}
              </span>
            ))}
          </div>

          {/* ── CARD CONTENT ── */}
          <div className="w-full min-h-[220px]">
            {/* STEP 0: Theme */}
            {step === 0 && (
              <div className="flex flex-col items-center gap-6 animate-fadeScaleIn">
                <p className="text-sm text-on-surface-variant text-center">Choose between Dark and Light mode</p>
                <div className="flex gap-4 w-full max-w-sm">
                  {(['dark', 'light'] as ThemeMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => handleThemeChange(mode)}
                      className={`flex-1 flex flex-col items-center gap-3 px-6 py-5 rounded-2xl border-2 transition-all duration-200 ${
                        theme === mode
                          ? 'border-primary bg-primary/10 scale-105'
                          : 'border-on-surface/10 hover:border-on-surface/30 bg-on-surface/[0.02]'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[36px]" style={{ color: theme === mode ? 'var(--color-primary)' : undefined }}>
                        {mode === 'dark' ? 'dark_mode' : 'light_mode'}
                      </span>
                      <span className={`font-medium text-sm ${theme === mode ? 'text-primary' : 'text-on-surface-variant'}`}>
                        {mode === 'dark' ? 'Dark' : 'Light'}
                      </span>
                      {theme === mode && (
                        <span className="material-symbols-outlined text-[16px] text-primary">check_circle</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 1: Accent Color */}
            {step === 1 && (
              <div className="flex flex-col items-center gap-6 animate-fadeScaleIn">
                <p className="text-sm text-on-surface-variant text-center">Pick a color accent for buttons, links, and highlights</p>
                <div className="flex flex-wrap gap-4 justify-center">
                  {ACCENT_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      onClick={() => handleAccentChange(c.hex)}
                      className={`flex flex-col items-center gap-2 transition-all duration-200 ${
                        accentColor === c.hex ? 'scale-110' : 'hover:scale-105'
                      }`}
                    >
                      <div
                        className={`w-10 h-10 rounded-full transition-all ${
                          accentColor === c.hex
                            ? 'ring-2 ring-on-surface ring-offset-2 ring-offset-surface scale-110'
                            : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                      <span className={`text-[10px] font-medium ${accentColor === c.hex ? 'text-primary' : 'text-on-surface-variant/60'}`}>
                        {c.name}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Background */}
            {step === 2 && (
              <div className="flex flex-col items-center gap-6 animate-fadeScaleIn">
                <p className="text-sm text-on-surface-variant text-center">Choose a background to complete your look</p>

                {/* Gradients */}
                <div className="grid grid-cols-5 gap-2 w-full max-w-sm">
                  {BACKGROUND_OPTIONS.map((opt) => {
                    const gradCSS = getGradientCSS(opt.id, theme)
                    return (
                      <button
                        key={opt.id}
                        onClick={() => handleBackgroundChange(opt.id)}
                        className={`aspect-[3/2] rounded-xl border-2 transition-all ${
                          backgroundColor === opt.id
                            ? 'border-primary scale-105'
                            : 'border-on-surface/10 hover:border-on-surface/30'
                        }`}
                        style={gradCSS ? { background: gradCSS } : undefined}
                      >
                        {opt.id === 'default' && (
                          <div className="w-full h-full rounded-[10px] bg-surface flex items-center justify-center">
                            <span className="material-symbols-outlined text-[14px] text-on-surface-variant">grid_view</span>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Solid Colors */}
                <div className="flex flex-wrap gap-2.5 justify-center">
                  {BACKGROUND_COLORS.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => handleBackgroundChange(c.id)}
                    >
                      <div
                        className={`w-7 h-7 rounded-full transition-all ${
                          backgroundColor === c.id
                            ? 'ring-2 ring-primary ring-offset-2 ring-offset-surface scale-110'
                            : 'hover:scale-110'
                        }`}
                        style={{ backgroundColor: c.hex }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── NAVIGATION BUTTONS ── */}
          <div className="flex items-center justify-between w-full mt-8 pt-6 border-t border-on-surface/10">
            <button
              onClick={() => setStep(Math.max(0, step - 1))}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                step === 0
                  ? 'opacity-0 pointer-events-none'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={onComplete}
                className="px-4 py-2 rounded-xl text-xs font-medium text-on-surface-variant hover:text-on-surface hover:bg-on-surface/5 transition-all"
              >
                Skip
              </button>

              {step < 2 ? (
                <button
                  onClick={() => setStep(step + 1)}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-primary text-on-primary text-sm font-medium hover:bg-primary/90 transition-all btn-glow-primary"
                >
                  Next
                  <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </button>
              ) : (
                <button
                  onClick={handleGetStarted}
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-all btn-glow-primary disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-[16px]">check</span>
                      Get Started
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer branding */}
        <div className="mt-6 flex justify-center items-center gap-4 opacity-30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Welcome</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Personalize</span>
          </div>
        </div>
      </div>

      {/* Logo watermark */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] opacity-[0.02] pointer-events-none select-none">
        <span className="material-symbols-outlined text-[600px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 100" }}>hub</span>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes onboardingPop {
          from { opacity: 0; transform: scale(0.85) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.92) translateY(-4px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .animate-fadeScaleIn {
          animation: fadeScaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1);
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
