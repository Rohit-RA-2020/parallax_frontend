export type ToolId = 'media' | 'titles' | 'audio' | 'effects' | 'transitions'

export type TrackKind = 'video' | 'audio' | 'title'

export type MediaKind = 'video' | 'audio' | 'title'

export type Clip = {
  id: string
  name: string
  track: string
  kind: TrackKind
  start: number
  duration: number
  thumb?: string
  src?: string
  mediaType?: 'video' | 'audio' | 'image'
  color: string
  waveSeed?: number
}

export type Track = {
  id: string
  label: string
  kind: TrackKind
  locked?: boolean
  muted?: boolean
}

export type MediaAsset = {
  id: string
  name: string
  kind: MediaKind
  duration: number
  thumb?: string
  src?: string
  mediaType?: 'video' | 'audio' | 'image'
}

export type ChatRole = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: ChatRole
  text: string
  time: string
}

export type Grade = {
  warmth: number
  contrast: number
  saturation: number
}
