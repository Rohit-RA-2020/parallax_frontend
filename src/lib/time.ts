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
  const s = Math.floor(clamped % 60)
  const m = Math.floor(clamped / 60) % 60
  const frac = Math.floor((clamped % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${frac}`
}

export function formatRange(start: number, duration: number): string {
  return `${formatClock(start)} – ${formatClock(start + duration)}`
}
