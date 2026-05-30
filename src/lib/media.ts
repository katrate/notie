/**
 * Detect whether a URL points to a video file.
 * Works with both data URLs (data:video/...) and regular URLs by extension.
 */
export function isVideoUrl(url: string): boolean {
  if (!url) return false
  if (url.startsWith('data:video/')) return true
  const ext = url.split('.').pop()?.toLowerCase() || ''
  return ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv'].includes(ext)
}
