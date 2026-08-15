import type { Clip, MediaAsset, TrackKind } from '../types'

export const MIN_DURATION = 28
export const ASSET_MIME = 'application/x-parallax-asset'

const TRACK_FOR: Record<TrackKind, string> = {
  video: 'V1',
  title: 'V2',
  audio: 'A1',
}

const COLOR_FOR: Record<TrackKind, string> = {
  video: '#8a6a48',
  title: '#c4a36a',
  audio: '#3d8f72',
}

export function sequenceDuration(clips: Clip[]) {
  const end = clips.reduce((max, clip) => Math.max(max, clip.start + clip.duration), 0)
  return Math.max(MIN_DURATION, end + 2)
}

export function defaultTrack(kind: TrackKind) {
  return TRACK_FOR[kind]
}

export function trackAccepts(trackId: string, kind: TrackKind) {
  if (kind === 'video') return trackId === 'V1'
  if (kind === 'title') return trackId === 'V2'
  return trackId === 'A1' || trackId === 'A2'
}

export function clipFromAsset(asset: MediaAsset, start: number, track?: string): Clip {
  const kind = asset.kind
  const known = asset.duration > 0
  return {
    id: `clip-${Math.random().toString(36).slice(2, 9)}`,
    name: kind === 'title' ? 'SALT ROAD' : asset.name,
    track: track && trackAccepts(track, kind) ? track : defaultTrack(kind),
    kind,
    start: Math.max(0, start),
    duration: known ? asset.duration : 8,
    sourceIn: 0,
    sourceDuration: known ? asset.duration : undefined,
    autoFit: !known,
    thumb: asset.thumb,
    src: asset.src,
    mediaPath: asset.path,
    mediaType: asset.mediaType,
    width: asset.width,
    height: asset.height,
    color: COLOR_FOR[kind],
    waveSeed: kind === 'audio' ? Math.floor(Math.random() * 200) + 1 : undefined,
  }
}

let draggingAsset: MediaAsset | null = null

export function setDraggingAsset(asset: MediaAsset | null) {
  draggingAsset = asset
}

export function getDraggingAsset() {
  return draggingAsset
}

export function parseAssetTransfer(data: DataTransfer) {
  if (draggingAsset) return draggingAsset
  const raw = data.getData(ASSET_MIME)
  if (!raw) return null
  try {
    return JSON.parse(raw) as MediaAsset
  } catch {
    return null
  }
}
