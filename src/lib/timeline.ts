import type { Clip, MediaAsset, TrackKind } from '../types'
import { PROJECT_FPS } from '../data/project'

export const TIMELINE_SCHEMA = 1
export const MIN_CLIP_FRAMES = 1

export type TimelineClipRecord = {
  id: string
  name: string
  track: string
  kind: TrackKind
  start_frame: number
  duration_frames: number
  source_in_frame: number
  source_duration_frames?: number
  media_path?: string
  media_type?: 'video' | 'audio' | 'image'
  color: string
  wave_seed?: number
}

export type TimelineDocument = {
  schema: number
  fps: number
  revision: number
  playhead_frame: number
  selected_id?: string
  px_per_second?: number
  updated_at?: string
  clips: TimelineClipRecord[]
}

const COLOR_FOR: Record<TrackKind, string> = {
  video: '#8a6a48',
  title: '#c4a36a',
  audio: '#3d8f72',
}

export function toFrames(seconds: number, fps = PROJECT_FPS) {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.round(seconds * fps)
}

export function fromFrames(frames: number, fps = PROJECT_FPS) {
  if (!Number.isFinite(frames) || frames <= 0 || fps <= 0) return 0
  return frames / fps
}

export function snapTime(seconds: number, fps = PROJECT_FPS) {
  return fromFrames(toFrames(seconds, fps), fps)
}

export function frameDuration(fps = PROJECT_FPS) {
  return 1 / Math.max(1, fps)
}

export function clipSourceTime(clip: Pick<Clip, 'start' | 'sourceIn'>, timelineTime: number) {
  return Math.max(0, (clip.sourceIn ?? 0) + (timelineTime - clip.start))
}

export function clampClip(clip: Clip, fps = PROJECT_FPS): Clip {
  const frame = frameDuration(fps)
  let start = Math.max(0, snapTime(clip.start, fps))
  let sourceIn = Math.max(0, snapTime(clip.sourceIn ?? 0, fps))
  let duration = Math.max(frame, snapTime(clip.duration, fps))
  const sourceDuration = clip.sourceDuration && clip.sourceDuration > 0
    ? snapTime(clip.sourceDuration, fps)
    : 0

  if (sourceDuration > 0) {
    const maxIn = Math.max(0, sourceDuration - frame)
    if (sourceIn > maxIn) sourceIn = maxIn
    const maxDur = sourceDuration - sourceIn
    if (duration > maxDur) duration = Math.max(frame, snapTime(maxDur, fps))
  }

  return {
    ...clip,
    start,
    duration,
    sourceIn,
    sourceDuration: sourceDuration || clip.sourceDuration,
  }
}

export function applySourceDuration(clip: Clip, sourceDuration: number, fps = PROJECT_FPS): Clip {
  if (!Number.isFinite(sourceDuration) || sourceDuration <= 0) return clip
  const next = { ...clip, sourceDuration }
  if (clip.autoFit) {
    next.duration = sourceDuration
    next.sourceIn = clip.sourceIn ?? 0
    next.autoFit = false
  }
  return clampClip(next, fps)
}

export function buildTimelineDocument(input: {
  clips: Clip[]
  fps?: number
  revision?: number
  playhead?: number
  selectedId?: string | null
  pxPerSecond?: number
}): TimelineDocument {
  const fps = input.fps && input.fps > 0 ? input.fps : PROJECT_FPS
  const clips = input.clips
    .map((clip) => clipToRecord(clampClip(clip, fps), fps))
    .sort((a, b) => a.start_frame - b.start_frame || a.id.localeCompare(b.id))
  return {
    schema: TIMELINE_SCHEMA,
    fps,
    revision: input.revision ?? 0,
    playhead_frame: toFrames(input.playhead ?? 0, fps),
    selected_id: input.selectedId || undefined,
    px_per_second: input.pxPerSecond,
    clips,
  }
}

export function clipsFromDocument(doc: TimelineDocument, assets: MediaAsset[]): Clip[] {
  const fps = doc.fps > 0 ? doc.fps : PROJECT_FPS
  return (doc.clips ?? []).map((record) => hydrateClip(clipFromRecord(record, fps), assets))
}

export function hydrateClip(clip: Clip, assets: MediaAsset[]): Clip {
  const asset = findClipAsset(clip, assets)
  if (!asset) {
    return { ...clip, src: undefined, thumb: undefined }
  }
  let next: Clip = {
    ...clip,
    name: clip.name || asset.name,
    src: asset.src,
    thumb: asset.thumb ?? clip.thumb,
    mediaPath: asset.path ?? clip.mediaPath,
    mediaType: asset.mediaType ?? clip.mediaType,
  }
  if (asset.duration > 0) {
    next = applySourceDuration(next, asset.duration)
  }
  return next
}

export function timelineFingerprint(doc: TimelineDocument): string {
  return JSON.stringify({
    fps: doc.fps,
    playhead_frame: doc.playhead_frame,
    selected_id: doc.selected_id ?? '',
    px_per_second: doc.px_per_second ?? 0,
    clips: doc.clips,
  })
}

export function emptyTimelineDocument(): TimelineDocument {
  return {
    schema: TIMELINE_SCHEMA,
    fps: PROJECT_FPS,
    revision: 0,
    playhead_frame: 0,
    clips: [],
  }
}

function clipToRecord(clip: Clip, fps: number): TimelineClipRecord {
  const record: TimelineClipRecord = {
    id: clip.id,
    name: clip.name,
    track: clip.track,
    kind: clip.kind,
    start_frame: toFrames(clip.start, fps),
    duration_frames: Math.max(MIN_CLIP_FRAMES, toFrames(clip.duration, fps)),
    source_in_frame: toFrames(clip.sourceIn ?? 0, fps),
    color: clip.color || COLOR_FOR[clip.kind],
  }
  if (clip.sourceDuration && clip.sourceDuration > 0) {
    record.source_duration_frames = toFrames(clip.sourceDuration, fps)
  }
  if (clip.mediaPath) record.media_path = clip.mediaPath
  if (clip.mediaType) record.media_type = clip.mediaType
  if (clip.waveSeed) record.wave_seed = clip.waveSeed
  return record
}

function clipFromRecord(record: TimelineClipRecord, fps: number): Clip {
  return {
    id: record.id,
    name: record.name || 'Clip',
    track: record.track,
    kind: record.kind,
    start: fromFrames(record.start_frame, fps),
    duration: fromFrames(Math.max(MIN_CLIP_FRAMES, record.duration_frames), fps),
    sourceIn: fromFrames(Math.max(0, record.source_in_frame), fps),
    sourceDuration: record.source_duration_frames
      ? fromFrames(record.source_duration_frames, fps)
      : undefined,
    mediaPath: record.media_path,
    mediaType: record.media_type,
    color: record.color || COLOR_FOR[record.kind],
    waveSeed: record.wave_seed,
  }
}

export function findClipAsset(clip: Pick<Clip, 'mediaPath' | 'src'>, assets: MediaAsset[]) {
  if (clip.mediaPath) {
    const byPath = assets.find((asset) => asset.path === clip.mediaPath)
    if (byPath) return byPath
  }
  if (clip.src) {
    const want = stripQuery(clip.src)
    return assets.find((asset) => asset.src && stripQuery(asset.src) === want)
  }
  return undefined
}

function stripQuery(url: string) {
  const index = url.indexOf('?')
  return index === -1 ? url : url.slice(0, index)
}
