import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { saveOnboardingSettings } from '../../stores/projectStore'

export function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [saving, setSaving] = useState(false)

  // Particles effect (same as auth screen)
  // (Simplified: no theme wizard — custom themes are configured in Settings)

  const handleGetStarted = async () => {
    setSaving(true)
    try {
      // Save default onboarding settings to profile
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        await saveOnboardingSettings(user.id, 'dark', '#98cbff', 'default')
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

      {/* Backdrop */}
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
                hub
              </span>
            </div>
            <h1 className="text-3xl font-bold text-on-surface tracking-tight">Welcome to Notie</h1>
            <p className="text-sm text-on-surface-variant mt-2 max-w-md mx-auto">
              Your all-in-one workspace for notes, boards, charts, galleries, and more.
            </p>
          </div>

          {/* Feature highlights */}
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm mb-8">
            {[
              { icon: 'edit_note', label: 'Rich Text' },
              { icon: 'grid_on', label: 'Tables' },
              { icon: 'dashboard', label: 'Boards' },
              { icon: 'bar_chart', label: 'Charts' },
              { icon: 'photo_library', label: 'Galleries' },
              { icon: 'checklist', label: 'Checklists' },
            ].map(f => (
              <div key={f.label} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-on-surface/5">
                <span className="material-symbols-outlined text-[16px] text-primary">{f.icon}</span>
                <span className="text-xs text-on-surface-variant">{f.label}</span>
              </div>
            ))}
          </div>

          {/* Get Started button */}
          <button
            onClick={handleGetStarted}
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-primary text-on-primary text-sm font-bold hover:bg-primary/90 transition-all btn-glow-primary disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                Getting ready...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                Get Started
              </>
            )}
          </button>

          <p className="text-xs text-on-surface-variant/50 mt-4">
            You can customize themes in Settings anytime.
          </p>
        </div>

        {/* Footer branding */}
        <div className="mt-6 flex justify-center items-center gap-4 opacity-30">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Welcome</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[12px]">auto_awesome</span>
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wider">Simple · Powerful</span>
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
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
      `}</style>
    </div>
  )
}
