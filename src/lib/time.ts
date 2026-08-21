export function formatTimecode(seconds: number, fps = 24): string {
  const clamped = Math.max(0, seconds)
  const totalFrames = Math.round(clamped * fps)
  const frames = totalFrames % fps
  const totalSeconds = Math.floor(totalFrames / fps)
  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  const pad = (n: number, w = 2) => String(n).padStart(w, '0')
  return `${pad(h)}:${pad(m)}:${pad(s)}:${pad(frames)}`
}

export function formatClock(seconds: number): string {
  const clamped = Math.max(0, seconds)
  const totalTenths = Math.floor(clamped * 10 + 1e-6)
  const totalSeconds = Math.floor(totalTenths / 10)
  const s = totalSeconds % 60
  const m = Math.floor(totalSeconds / 60) % 60
  const h = Math.floor(totalSeconds / 3600)
  const frac = totalTenths % 10
  const clock = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`
  return h > 0 ? `${String(h).padStart(2, '0')}:${clock}` : clock
}

export function formatRange(start: number, duration: number): string {
  return `${formatClock(start)} – ${formatClock(start + duration)}`
}

export function formatDurationMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)}ms`
  const sec = ms / 1000
  if (sec < 60) return `${sec < 10 ? sec.toFixed(2) : sec.toFixed(1)}s`
  const minutes = Math.floor(sec / 60)
  const seconds = sec - minutes * 60
  if (minutes < 60) return `${minutes}m ${seconds.toFixed(0).padStart(2, '0')}s`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return `${hours}h ${remMin}m`
}

export function realtimeFactor(mediaSeconds: number, transcribeMs: number): number | null {
  if (!(mediaSeconds > 0) || !(transcribeMs > 0)) return null
  return mediaSeconds / (transcribeMs / 1000)
}
