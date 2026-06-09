import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/authStore'
import { supabase } from '../../lib/supabase'
import { Tooltip } from '../Tooltip'

export function AuthScreen() {
  const { error, setError, loading, setLoading } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Particles animation logic
  useEffect(() => {
    const container = document.getElementById('particle-container')
    if (!container) return
    const particleCount = 40

    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div')
      particle.className = 'particle'
      
      const size = Math.random() * 3 + 1
      const posX = Math.random() * 100
      const posY = Math.random() * 100
      const duration = Math.random() * 20 + 10
      const delay = Math.random() * -20

      particle.style.width = `${size}px`
      particle.style.height = `${size}px`
      particle.style.left = `${posX}%`
      particle.style.top = `${posY}%`
      
      particle.animate([
        { transform: 'translate(0, 0)', opacity: 0.1 },
        { transform: `translate(${Math.random() * 100 - 50}px, ${Math.random() * 100 - 50}px)`, opacity: 0.4 },
        { transform: 'translate(0, 0)', opacity: 0.1 }
      ], {
        duration: duration * 1000,
        iterations: Infinity,
        delay: delay * 1000,
        easing: 'ease-in-out'
      })

      container.appendChild(particle)
    }

    return () => {
      container.innerHTML = ''
    }
  }, [])

  // 3D Hover effect logic
  useEffect(() => {
    const card = document.querySelector('.glass-panel') as HTMLElement
    if (!card) return

    const handleMouseMove = (e: MouseEvent) => {
      const xAxis = (window.innerWidth / 2 - e.pageX) / 50
      const yAxis = (window.innerHeight / 2 - e.pageY) / 50
      card.style.transform = `rotateY(${xAxis}deg) rotateX(${yAxis}deg)`
    }

    const handleMouseLeave = () => {
      card.style.transform = `rotateY(0deg) rotateX(0deg)`
      card.style.transition = 'all 0.5s ease'
    }

    const handleMouseEnter = () => {
      card.style.transition = 'none'
    }

    document.addEventListener('mousemove', handleMouseMove)
    card.addEventListener('mouseleave', handleMouseLeave)
    card.addEventListener('mouseenter', handleMouseEnter)

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      card.removeEventListener('mouseleave', handleMouseLeave)
      card.removeEventListener('mouseenter', handleMouseEnter)
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    if (isSignUp) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (data.session === null) setError("Check your email for the login link!")
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    
    setLoading(false)
  }


  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="aurora"></div>
      <div className="absolute inset-0 overflow-hidden pointer-events-none" id="particle-container"></div>
      
      <main className="relative z-10 w-full max-w-[440px] px-margin-mobile md:px-0">
        <div className="glass-panel rounded-[32px] p-10 flex flex-col items-center">
          <div className="mb-10 text-center">
            <h1 className="font-headline-lg text-headline-lg text-on-surface tracking-tighter mb-1">Notie</h1>
            <p className="font-label-md text-label-md text-on-surface-variant uppercase tracking-widest">Workspace Authentication</p>
          </div>

          <form className="w-full space-y-6" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="font-label-md text-label-md text-on-surface-variant ml-1" htmlFor="email">Email Address</label>
              <div className="relative group input-group-focus">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors z-10">alternate_email</span>
                <input 
                  className="w-full input-etched h-14 pl-12 pr-4 rounded-xl text-on-surface font-body-md placeholder:text-outline/50" 
                  id="email" 
                  name="email"
                  placeholder="name@company.com" 
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="font-label-md text-label-md text-on-surface-variant" htmlFor="password">Password</label>
                {!isSignUp && (
                  <a className="font-label-md text-label-md text-primary hover:underline transition-all" href="#">Forgot Password?</a>
                )}
              </div>
              <div className="relative group input-group-focus">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant group-focus-within:text-primary transition-colors z-10">lock</span>
                <input 
                  className="w-full input-etched h-14 pl-12 pr-12 rounded-xl text-on-surface font-body-md placeholder:text-outline/50" 
                  id="password" 
                  name="password"
                  placeholder="••••••••" 
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <Tooltip label={showPassword ? 'Hide password' : 'Show password'} position="bottom">
                <button 
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface transition-colors" 
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  <span className="material-symbols-outlined">{showPassword ? 'visibility_off' : 'visibility'}</span>
                </button>
                </Tooltip>
              </div>
            </div>

            {error && (
              <div className="text-error text-label-md text-center bg-error/10 py-2 rounded-lg border border-error/20">
                {error}
              </div>
            )}

            <button 
              className="glow-button w-full h-14 bg-primary text-on-primary font-headline-sm text-headline-sm rounded-xl transition-all duration-300 flex items-center justify-center gap-2 mt-4 disabled:opacity-50" 
              type="submit"
              disabled={loading}
            >
              <span>{loading ? 'Authenticating...' : (isSignUp ? 'Create Workspace' : 'Enter Workspace')}</span>
              {!loading && <span className="material-symbols-outlined" style={{ fontVariationSettings: "'wght' 500" }}>arrow_forward</span>}
            </button>
          </form>
          <div className="mt-8 pt-8 border-t border-on-surface/5 w-full text-center">
            <p className="font-body-md text-body-md text-on-surface-variant">
              {isSignUp ? "Already have a workspace?" : "New to the network?"} 
              <button 
                className="text-primary font-bold hover:text-primary-container transition-colors ml-2" 
                onClick={() => { setIsSignUp(!isSignUp); setError(null); }}
              >
                {isSignUp ? "Sign In" : "Create Account"}
              </button>
            </p>
          </div>

        </div>

        <div className="mt-8 flex justify-center items-center gap-6 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
            <span className="font-label-sm text-label-sm text-on-surface-variant">System Operational</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]">shield</span>
            <span className="font-label-sm text-label-sm text-on-surface-variant">E2E Encrypted</span>
          </div>
        </div>
      </main>

      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] opacity-[0.03] pointer-events-none select-none">
        <span className="material-symbols-outlined text-[800px]" style={{ fontVariationSettings: "'FILL' 0, 'wght' 100" }}>hub</span>
      </div>
    </div>
  )
}
