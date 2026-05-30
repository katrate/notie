import { useState, useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../../stores/projectStore'
import { Tooltip } from '../Tooltip'
import { CameraPermissionDialog } from './CameraPermissionDialog'

/* ── Types ── */

interface VideoClip {
  id: string
  title: string
  videoData: string   // base64 data URL
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

function getVideoDuration(video: HTMLVideoElement): Promise<number> {
  return new Promise((resolve) => {
    video.onloadedmetadata = () => resolve(video.duration)
    video.onerror = () => resolve(0)
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
  return `vclip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

/* ── Component ── */

export function VideoView() {
  const { pages, activePageId, updatePageContent } = useProjectStore()
  const activePage = pages.find(p => p.id === activePageId)

  const [clips, setClips] = useState<VideoClip[]>([])
  const [recording, setRecording] = useState(false)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [playProgress, setPlayProgress] = useState(0)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [showPermissionDialog, setShowPermissionDialog] = useState(false)
  const [audioMuted, setAudioMuted] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const videoChunksRef = useRef<Blob[]>([])
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Load clips from page content
  useEffect(() => {
    if (activePage?.content && Array.isArray(activePage.content)) {
      setClips(activePage.content as VideoClip[])
    } else {
      setClips([])
    }
  }, [activePage?.content, activePageId])

  // Save clips to page content
  const saveClips = useCallback((newClips: VideoClip[]) => {
    setClips(newClips)
    if (activePageId) updatePageContent(activePageId, newClips)
  }, [activePageId, updatePageContent])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      if (progressTimerRef.current) clearInterval(progressTimerRef.current)
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current = null
      }
      if (previewVideoRef.current) {
        previewVideoRef.current.pause()
        previewVideoRef.current.srcObject = null
        previewVideoRef.current = null
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  /* ── Recording ── */

  const requestCameraAndStart = useCallback(async () => {
    try {
      const constraints: MediaStreamConstraints = {
        audio: !audioMuted,
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
      }
      const stream = await navigator.mediaDevices.getUserMedia(constraints)
      streamRef.current = stream

      // Show preview
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream
        previewVideoRef.current.play()
      }

      // Try preferred mime types
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : 'video/webm'

      const mediaRecorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mediaRecorder
      videoChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) videoChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        // Stop camera stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop())
          streamRef.current = null
        }
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = null
        }

        const blob = new Blob(videoChunksRef.current, { type: mediaRecorder.mimeType || 'video/webm' })
        const base64 = await blobToBase64(blob)
        const video = document.createElement('video')
        video.preload = 'metadata'
        video.src = base64
        const duration = await getVideoDuration(video)

        const newClip: VideoClip = {
          id: getClipId(),
          title: `Recording ${formatDate(new Date().toISOString())}`,
          videoData: base64,
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
    } catch (err: any) {
      let msg = 'Camera access denied. Please allow camera permissions in your browser settings, then try again.'
      if (err.name === 'NotAllowedError') {
        msg = audioMuted
          ? 'Camera access denied. Please allow camera permissions in your browser settings, then try again.'
          : 'Camera and microphone access denied. Please allow both permissions in your browser settings, then try again.'
      } else if (err.name === 'NotFoundError') {
        msg = 'No camera found. Please connect a camera and try again.'
      }
      setError(msg)
      console.error('Video recording error:', err)
    }
  }, [clips, saveClips, audioMuted])

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

    mr.stop()
  }, [])

  const cancelRecording = useCallback(() => {
    const mr = mediaRecorderRef.current
    if (!mr || mr.state === 'inactive') return

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
    }

    // Null out onstop to prevent saving empty clip
    mr.onstop = null
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null
    }
    mr.stop()
    setRecording(false)
    setRecordingDuration(0)
    videoChunksRef.current = []
  }, [])

  /* ── Playback ── */

  const playClip = useCallback((clip: VideoClip) => {
    // Stop any current playback
    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current = null
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }

    const video = document.createElement('video')
    video.src = clip.videoData
    video.preload = 'metadata'
    videoRef.current = video
    setPlayingId(clip.id)
    setPlayProgress(0)

    video.onloadedmetadata = () => {
      video.play()
    }

    video.ontimeupdate = () => {
      if (video.duration) {
        setPlayProgress(video.currentTime)
      }
    }

    video.onended = () => {
      setPlayingId(null)
      setPlayProgress(0)
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current)
        progressTimerRef.current = null
      }
    }

    // Poll progress for real-time updates
    progressTimerRef.current = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) {
        setPlayProgress(videoRef.current.currentTime)
      }
    }, 100)
  }, [])

  const pausePlayback = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.pause()
    }
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
    setPlayingId(null)
  }, [])

  const deleteClip = useCallback((clipId: string) => {
    if (playingId === clipId) {
      if (videoRef.current) {
        videoRef.current.pause()
        videoRef.current = null
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
        <span className="material-symbols-outlined text-[22px] text-primary">videocam</span>
        <h2 className="text-lg font-bold text-on-surface">Video Notes</h2>
        {clips.length > 0 && (
          <span className="text-[11px] text-on-surface-variant">{clips.length} clip{clips.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-error/10 border border-error/20 text-error text-xs flex items-start gap-2">
          <span className="material-symbols-outlined text-[14px] mt-0.5">error</span>
          <div className="flex-1 min-w-0">
            <p className="text-error font-medium mb-1">Camera Required</p>
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

      {/* Recording indicator with preview */}
      {recording && (
        <div className="mb-4 rounded-xl bg-error/10 border border-error/20 overflow-hidden">
          {/* Live preview */}
          <div className="relative bg-black/60 aspect-video flex items-center justify-center">
            <video
              ref={previewVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4 h-4 rounded-full bg-error animate-pulse flex-shrink-0" />
            </div>
            <div className="absolute top-3 right-3 bg-black/50 backdrop-blur-sm px-2.5 py-1 rounded-lg">
              <span className="text-lg font-bold text-white font-mono tabular-nums">
                {formatDuration(recordingDuration)}
              </span>
            </div>
          </div>
          <div className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full bg-error animate-pulse flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-error">Recording...</p>
                <p className="text-xs text-error/70">Recording video — speak now</p>
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
        </div>
      )}

      {/* Permission dialog */}
      {showPermissionDialog && (
        <CameraPermissionDialog
          audioMuted={audioMuted}
          onToggleAudio={() => setAudioMuted(!audioMuted)}
          onAllow={() => {
            setShowPermissionDialog(false)
            requestCameraAndStart()
          }}
          onDismiss={() => setShowPermissionDialog(false)}
        />
      )}

      {/* Record + Audio Toggle buttons (when not recording) */}
      {!recording && (
        <div className="mb-5 flex items-center gap-3">
          <button
            onClick={startRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">videocam</span>
            Start Recording
          </button>
          <Tooltip label={audioMuted ? 'Audio muted — click to enable' : 'Audio enabled — click to mute'}>
            <button
              onClick={() => setAudioMuted(!audioMuted)}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                audioMuted
                  ? 'border-error/30 text-error/70 bg-error/5'
                  : 'border-outline/20 text-on-surface-variant bg-surface/50 hover:border-primary/30'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {audioMuted ? 'mic_off' : 'mic'}
              </span>
              {audioMuted ? 'Muted' : 'Audio On'}
            </button>
          </Tooltip>
        </div>
      )}

      {/* Clip list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {clips.length === 0 && !recording ? (
          <div className="text-center text-on-surface-variant py-10 opacity-40">
            <span className="material-symbols-outlined text-[48px] block mb-3">videocam_off</span>
            <p className="text-sm">No video recordings yet</p>
            <p className="text-xs mt-1">Click "Start Recording" to create your first video note</p>
          </div>
        ) : (
          clips.map(clip => {
            const isPlaying = playingId === clip.id
            const progress = isPlaying && clip.duration > 0 ? (playProgress / clip.duration) * 100 : 0

            return (
              <div
                key={clip.id}
                className={`rounded-xl border transition-all group overflow-hidden ${
                  isPlaying
                    ? 'bg-primary/10 border-primary/30 shadow-sm'
                    : 'bg-surface/50 border-outline/10 hover:border-primary/30 shadow-sm'
                }`}
              >
                {/* Video thumbnail / player */}
                {isPlaying ? (
                  <div className="relative aspect-video bg-black/40">
                    <video
                      ref={(el) => {
                        if (el && !el.src) {
                          el.src = clip.videoData
                          el.play()
                        }
                      }}
                      controls
                      autoPlay
                      className="w-full h-full object-contain"
                      onEnded={() => {
                        setPlayingId(null)
                        setPlayProgress(0)
                      }}
                      onTimeUpdate={(e) => {
                        const v = e.currentTarget
                        if (v.duration) setPlayProgress(v.currentTime)
                      }}
                    />
                  </div>
                ) : (
                  <div className="relative aspect-video bg-surface-variant/30 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/30">play_circle</span>
                  </div>
                )}

                {/* Info row */}
                <div className="flex items-center gap-3 p-3">
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

                  {/* Info + progress */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-on-surface truncate">{clip.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="flex-1 h-2 bg-on-surface/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-200 ${
                            isPlaying ? 'bg-primary' : 'bg-primary/40'
                          }`}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
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
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}


