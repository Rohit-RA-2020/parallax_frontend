export type ToolId = 'media' | 'titles' | 'audio' | 'effects' | 'transitions' | 'history'

export type TrackKind = 'video' | 'audio' | 'title' | 'caption'

export type MediaKind = 'video' | 'audio' | 'title' | 'caption'

export type Clip = {
  id: string
  name: string
  track: string
  kind: TrackKind
  start: number
  duration: number
  sourceIn?: number
  sourceDuration?: number
  autoFit?: boolean
  thumb?: string
  src?: string
  mediaPath?: string
  mediaType?: 'video' | 'audio' | 'image' | 'subtitle'
  width?: number
  height?: number
  previewState?: MediaAsset['previewState']
  previewProgress?: string
  previewError?: string
  previewReason?: string
  previewPoster?: string
  color: string
  waveSeed?: number
  linkId?: string
  enabled?: boolean
  transform?: TimelineTransform
  playback?: TimelinePlayback
  audio?: TimelineAudio
  grade?: TimelineColor
  title?: TimelineTitle
  captions?: TimelineCaptions
  keyframes?: TimelineKeyframe[]
}

export type TimelineTransform = {
  x?: number; y?: number; anchorX?: number; anchorY?: number
  scaleX?: number; scaleY?: number; rotation?: number; opacity?: number
  cropTop?: number; cropRight?: number; cropBottom?: number; cropLeft?: number
}
export type TimelinePlayback = { rate?: number; preservePitch?: boolean }
export type TimelineAudio = { volumeDb?: number; muted?: boolean; pan?: number }
export type TimelineColor = { exposure?: number; contrast?: number; saturation?: number; temperature?: number; tint?: number }
export type TimelineTitle = { text: string; fontFamily?: string; fontSize?: number; fontWeight?: number; align?: string; fill?: string; stroke?: string; strokeWidth?: number; background?: string }
export type TimelineCaptions = { language?: string; source?: string }
export type CaptionCue = { start: number; end: number; text: string }
export type TimelineKeyframe = { property: string; frame: number; value: number; easing?: 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out' }

export type Track = {
  id: string
  label: string
  kind: TrackKind
  locked?: boolean
  muted?: boolean
}

export type MediaIndexState =
  | 'queued'
  | 'transcribing'
  | 'translating'
  | 'describing'
  | 'indexing'
  | 'ready'
  | 'index_failed'
  | 'failed'
  | 'skipped'

export type MediaIndexTimings = {
  upload_ms?: number
  queue_ms?: number
  extract_ms?: number
  transcribe_ms?: number
  translate_ms?: number
  describe_ms?: number
  index_ms?: number
  total_ms?: number
  cached?: boolean
  model?: string
  device?: string
}

export type MediaPreviewTimings = {
  queue_ms?: number
  probe_ms?: number
  poster_ms?: number
  transcode_ms?: number
  total_ms?: number
}

export type MediaAsset = {
  id: string
  name: string
  kind: MediaKind
  duration: number
  thumb?: string
  src?: string
  path?: string
  mediaType?: 'video' | 'audio' | 'image'
  width?: number
  height?: number
  indexState?: MediaIndexState
  indexError?: string
  indexProgress?: string
  indexTimings?: MediaIndexTimings
  indexStartedAt?: string
  indexStageStartedAt?: string
  previewState?: 'original' | 'queued' | 'building' | 'ready' | 'failed'
  previewProgress?: string
  previewError?: string
  previewReason?: string
  previewPoster?: string
  previewEncoder?: string
  previewDevice?: string
  previewHardware?: boolean
  previewPipeline?: 'gpu_full' | 'gpu_encode' | 'cpu'
  previewTimings?: MediaPreviewTimings
  previewStartedAt?: string
  canDescribe?: boolean
}

export type ChatRole = 'user' | 'assistant'

export type ChatImage = {
  name?: string
  mime?: string
  path?: string
  url: string
}

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  time: string
  images?: ChatImage[]
  workedMs?: number
  trace?: DirectorActivity[]
  parts?: ChatPart[]
}

export type ChatPart =
  | { id: string; kind: 'text'; text: string }
  | { id: string; kind: 'activity'; activity: DirectorActivity }

export type DirectorActivity = {
  id: string
  kind: 'thinking' | 'tool'
  status: 'active' | 'success' | 'error'
  title: string
  name?: string
  detail?: string
  arguments?: unknown
  iteration?: number
  elapsedMs?: number
}

export type Grade = {
  warmth: number
  contrast: number
  saturation: number
}
