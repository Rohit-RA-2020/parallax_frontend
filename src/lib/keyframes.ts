import type { Clip, TimelineKeyframe } from '../types'
import { PROJECT_FPS } from '../data/project'

export function propertyAt(clip: Clip, property: string, timelineTime: number, fallback: number) {
  const keys = (clip.keyframes ?? []).filter((key) => key.property === property).sort((a, b) => a.frame - b.frame)
  if (keys.length === 0) return fallback
  const frame = Math.max(0, (timelineTime - clip.start) * PROJECT_FPS)
  if (frame <= keys[0].frame) return keys[0].value
  const last = keys[keys.length - 1]
  if (frame >= last.frame) return last.value
  for (let i = 1; i < keys.length; i += 1) {
    const right = keys[i]
    if (frame > right.frame) continue
    const left = keys[i - 1]
    const span = Math.max(1, right.frame - left.frame)
    const progress = ease((frame - left.frame) / span, right.easing ?? left.easing)
    return left.value + (right.value - left.value) * progress
  }
  return fallback
}

function ease(value: number, easing?: TimelineKeyframe['easing']) {
  const t = Math.min(1, Math.max(0, value))
  if (easing === 'ease_in') return t * t
  if (easing === 'ease_out') return 1 - (1 - t) * (1 - t)
  if (easing === 'ease_in_out') return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
  return t
}
