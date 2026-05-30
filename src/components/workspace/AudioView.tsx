import { useState, useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'
import { MicPermissionDialog } from './MicPermissionDialog'

/* ── Types ── */

interface AudioClip {
  id: string
  title: string
  audioData: string   // base64 data URL
  duration: number    // seconds
  createdAt: string   // ISO string
}

/* ── Helpers ── */

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

function getAudioDuration(audio: HTMLAudioElement): Promise<number> {
  return new Promise((resolve) => {
    audio.onloadedmetadata = () => resolve(audio.duration)
    audio.onerror = () => resolve(0)
  })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getClipId(): string {
  return `clip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/* ═══════════════════════════════════════════════
   PLAYBACK VISUALIZER — real-time frequency bars via Web Audio API
   ═══════════════════════════════════════════════ */
function PlaybackVisualizer({ analyserRef, isPlaying }: { analyserRef: React.MutableRefObject<AnalyserNode | null>; isPlaying: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set up canvas sizing with device pixel ratio
    const parent = canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const w = rect.width
    const h = rect.height
    canvas.width = w * dpr
    canvas.height = h * dpr
    ctx.scale(dpr, dpr)

    const bufferLength = 128
    const dataArray = new Uint8Array(bufferLength)
    const barCount = 28
    const step = Math.floor(bufferLength / barCount)

    const draw = () => {
      const analyser = analyserRef.current
      if (analyser && isPlaying) {
        analyser.getByteFrequencyData(dataArray)
      }

      ctx.clearRect(0, 0, w, h)

      const barWidth = w / barCount
      const gap = 2
      const effectiveWidth = Math.max(barWidth - gap, 1)

      for (let i = 0; i < barCount; i++) {
        // Average frequency values in this bucket for smoother bars
        let sum = 0
        for (let j = 0; j < step; j++) {
          sum += dataArray[i * step + j] || 0
        }
        const avg = sum / step / 255
        // Boost low values for better visibility
        const boosted = Math.pow(avg, 0.6)
        const barHeight = Math.max(boosted * h * 0.95, 1)

        // Gradient from bright primary at top to muted at bottom
        const gradient = ctx.createLinearGradient(0, h - barHeight, 0, h)
        gradient.addColorStop(0, 'rgba(152, 203, 255, 0.95)')
        gradient.addColorStop(0.4, 'rgba(152, 203, 255, 0.6)')
        gradient.addColorStop(1, 'rgba(152, 203, 255, 0.08)')
        ctx.fillStyle = gradient

        const x = i * barWidth + gap / 2
        const radius = 2
        // Draw rounded-top bar
        ctx.beginPath()
        ctx.moveTo(x + radius, h - barHeight)
        ctx.lineTo(x + effectiveWidth - radius, h - barHeight)
        ctx.quadraticCurveTo(x + effectiveWidth, h - barHeight, x + effectiveWidth, h - barHeight + radius)
        ctx.lineTo(x + effectiveWidth, h)
        ctx.lineTo(x, h)
        ctx.lineTo(x, h - barHeight + radius)
        ctx.quadraticCurveTo(x, h - barHeight, x + radius, h - barHeight)
        ctx.closePath()
        ctx.fill()
      }

      animRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [analyserRef, isPlaying])

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full rounded"
    />
  )
}

/* ── Component ── */

export function AudioView() {
  const { pages, activePageId, updatePageContent } = useProjectStore()
  const activePage = pages.find(p => p.id === activePageId)

  const [clips, setClips] = useState<AudioClip[]>([])
  const [recording, setRecording] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playProgress, setPlayProgress] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Web Audio API refs for playback visualizer
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)

  // Load clips from page content
  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setClips(activePage.content as AudioClip[])
    } else {
      setClips([])
    }
  }, [activePage?.content, activePageId])

  // Save clips to page content
  const saveClips = useCallback((newClips: AudioClip[]) => {
    setClips(newClips)
    if (activePageId) updatePageContent(activePageId, newClips)
  }, [activePageId, updatePageContent])    // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
        analyserRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  /* ── Recording ── */

  const requestMicAndStart = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType || 'audio/webm' })
        const base64 = await blobToBase64(blob)
        const audio = new Audio(base64)
        const duration = await getAudioDuration(audio)

        const newClip: AudioClip = {
          id: getClipId(),
          title: `Recording ${formatDate(new Date().toISOString())}`,
          audioData: base64,
          duration,
          createdAt: new Date().toISOString(),
        }

        saveClips([newClip, ...clips])
        setRecording(false)
        setRecordingDuration(0)
      }

      setRecording(true)
      setError(null)
      setRecordingDuration(0)

      // Track recording duration
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1)
      }, 1000)

      mediaRecorder.start()
    } catch (err) {
      const deniedMsg = 'Microphone access denied. Please allow microphone permissions in your browser settings, then try again.'
      setError(deniedMsg)
      console.error('Audio recording error:', err)
    }
  }, [clips, saveClips])

  const startRecording = useCallback(() => {
    setError(null)
    setShowPermissionDialog(true)
  }, [])

  const stopRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    mr.stream.getTracks().forEach(t => t.stop())
    mr.stop()
  }, [])

  const cancelRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    // Null out onstop to prevent the original handler from saving an empty clip
    mr.onstop = null
    mr.stream.getTracks().forEach(t => t.stop())
    mr.stop()
    // Don't save the clip — just reset
    setRecording(false)
    setRecordingDuration(0)
    audioChunksRef.current = []
  }, [])

  /* ── Playback ── */

  const playClip = useCallback((clip: AudioClip) => {
    // Stop any current playback
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    // Clean up previous AudioContext
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
      analyserRef.current = null
    }

    const audio = new Audio(clip.audioData)
    audioRef.current = audio
    setPlayingId(clip.id)
    setPlayProgress(0)

    audio.onloadedmetadata = () => {
      // Set up Web Audio API analyser for real-time visualization
      try {
        const audioCtx = new AudioContext()
        audioContextRef.current = audioCtx
        const source = audioCtx.createMediaElementSource(audio)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        analyser.smoothingTimeConstant = 0.85
        analyserRef.current = analyser
        source.connect(analyser)
        analyser.connect(audioCtx.destination)
      } catch (err) {
        console.error('Audio visualizer setup failed:', err)
      }

      audio.play()
    }

    audio.ontimeupdate = () => {
      if (audio.duration) {
        setPlayProgress(audio.currentTime)
      }
    }

    audio.onended = () => {
      setPlayingId(null)
      setPlayProgress(0)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
      if (audioContextRef.current) {
        audioContextRef.current.close()
        audioContextRef.current = null
        analyserRef.current = null
      }
    }

    // Poll progress for real-time updates
    progressTimerRef.current = setInterval(() => {
      if (audioRef.current && !audioRef.current.paused) {
        setPlayProgress(audioRef.current.currentTime)
      }
    }, 100)
  }, [])

  const pausePlayback = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
      analyserRef.current = null
    }
    setPlayingId(null)
  }, [])

  const deleteClip = useCallback((clipId: string) => {
    // Stop if this clip is currently playing
    if (playingId === clipId) {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
      setPlayingId(null)
      setPlayProgress(0)
    }
    saveClips(clips.filter(c => c.id !== clipId))
  }, [clips, playingId, saveClips])

  /* ── Render ── */

  return (
    <div className="flex-1 flex flex-col bg-surface/30 rounded-xl border border-outline/10 p-4 md:p-6 mx-auto max-w-3xl w-full">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-[22px] text-primary">mic</span>
        <h2 className="text-lg font-bold text-on-surface">Audio Notes</h2>
        {clips.length > 0 && (
          <span className="text-[11px] text-on-surface-variant">{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-xs flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
          <div className="flex-1 min-w-0">
            <p className="text-error font-medium mb-1">Microphone Required</p>
            <p className="text-error/80 leading-relaxed">{error}</p>
            <div className="flex items-center gap-2 mt-2.5">
              <button
                onClick={() => { setError(null); setShowPermissionDialog(true) }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-error/20 hover:bg-error/30 text-error text-[11px] font-semibold transition-all"
              >
                <span className="material-symbols-outlined text-[12px]">refresh</span>
                Try Again
              </button>
              <button
                onClick={() => setError(null)}
                className="px-2.5 py-1 rounded-lg text-error/60 hover:text-error/80 text-[11px] font-medium transition-all"
              >
                Dismiss
              </button>
            </div>
          </div>
          <button onClick={() => setError(null)} className="hover:bg-error/10 p-0.5 rounded shrink-0">
            <span className="material-symbols-outlined text-[14px]">close</span>
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {recording && (
        <div className="mb-4 p-4 rounded-xl bg-error/10 border border-error/20">
          <div className="flex items-center gap-3 mb-3">
            {/* Animated waveform bars */}
            <div className="flex items-end gap-[3px] h-8 flex-shrink-0">
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => (
                <div
                  key={i}
                  className="w-[3px] rounded-full bg-error"
                  style={{
                    animation: `waveform-bar 0.8s ease-in-out infinite alternate`,
                    animationDelay: `${i * 0.07}s`,
                    height: `${40 + Math.sin(i * 1.5) * 30 + 20}%`,
                    opacity: 0.9,
                    transformOrigin: 'bottom',
                  }}
                />
              ))}
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-error">Recording...</p>
              <p className="text-xs text-error/70">Recording audio — speak now</p>
            </div>
            <div className="text-lg font-bold text-error font-mono tabular-nums">
              {formatDuration(recordingDuration)}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={stopRecording}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-error text-white text-xs font-semibold hover:bg-error/90 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[14px]">stop</span>
              Stop & Save
            </button>
            <button
              onClick={cancelRecording}
              className="px-4 py-2 rounded-lg border border-outline/20 text-on-surface-variant text-xs font-medium hover:bg-surface/50 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Permission dialog */}
      {showPermissionDialog && (
        <MicPermissionDialog
          onAllow={() => {
            setShowPermissionDialog(false)
            requestMicAndStart()
          }}
          onDismiss={() => setShowPermissionDialog(false)}
        />
      )}

      {/* Record button (when not recording) */}
      {!recording && (
        <button
          onClick={startRecording}
          className="mb-5 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm w-fit"
        >
          <span className="material-symbols-outlined text-[18px]">mic</span>
          Start Recording
        </button>
      )}

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {clips.length === 0 && !recording ? (
          <div className="text-center text-on-surface-variant py-10 opacity-40">
            <span className="material-symbols-outlined text-[48px] block mb-3">mic_off</span>
            <p className="text-sm">No audio recordings yet</p>
            <p className="text-xs mt-1">Click "Start Recording" to create your first audio note</p>
          </div>
        ) : (
          clips.map(clip => {
            const isPlaying = playingId === clip.id
            const progress = isPlaying && clip.duration > 0 ? (playProgress / clip.duration) * 100 : 0

            return (
              <div
                key={clip.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-all group ${
                  isPlaying
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'bg-surface/50 border-outline/10 hover:border-primary/30 shadow-sm'
                }`}
              >
                {/* Play/Pause button */}
                <Tooltip label={isPlaying ? 'Pause' : 'Play'}>
                  <button
                    onClick={() => isPlaying ? pausePlayback() : playClip(clip)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 ${
                      isPlaying
                        ? 'bg-primary text-on-primary shadow-sm'
                        : 'bg-surface border border-outline/20 text-on-surface hover:bg-primary hover:text-on-primary hover:border-primary'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                </Tooltip>

                {/* Info + waveform */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface truncate">{clip.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    {isPlaying ? (
                      /* Real-time frequency visualizer during playback */
                      <div className="flex-1 h-8">
                        <PlaybackVisualizer analyserRef={analyserRef} isPlaying={isPlaying} />
                      </div>
                    ) : (
                      /* Simple progress bar when not playing */
                      <div className="flex-1 h-2 bg-on-surface/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isPlaying ? 'bg-primary' : 'bg-primary/40'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}
                    <span className="text-[10px] font-mono text-on-surface-variant tabular-nums flex-shrink-0">
                      {isPlaying ? formatDuration(playProgress) : formatDuration(clip.duration)}
                    </span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant/50 mt-0.5">{formatDate(clip.createdAt)}</p>
                </div>

                {/* Delete button */}
                <Tooltip label="Delete">
                  <button
                    onClick={() => deleteClip(clip.id)}
                    className="p-1.5 rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </Tooltip>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
