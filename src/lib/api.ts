import type { TimelineDocument } from './timeline'

export const API_BASE = (import.meta.env.VITE_API_URL ?? 'http://localhost:8080').replace(/\/$/, '')

export type ProjectRecord = {
  id: string
  name: string
  created_at: string
  updated_at: string
  media_count: number
}

export type ProjectMedia = {
  id: string
  name: string
  path: string
  kind: 'video' | 'audio' | 'image' | 'subtitle' | 'file'
  content_type: string
  content_url: string
  bytes: number
  duration?: number
  width?: number
  height?: number
  modified_at: string
}

export type ChatRecord = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

export type SavedChatMessage = {
  role: 'user' | 'assistant'
  content: string
}

export type AgentEvent = {
  type: string
  data: Record<string, unknown>
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE + path, init)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Request failed (${response.status})`)
  }
  return response.json() as Promise<T>
}

export async function listProjects() {
  const result = await request<{ projects: ProjectRecord[] }>('/v1/projects')
  return result.projects
}

export function createProject(name: string) {
  return request<ProjectRecord>('/v1/projects', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function listProjectMedia(projectID: string) {
  const result = await request<{ media: ProjectMedia[] }>(`/v1/projects/${projectID}/media`)
  return result.media
}

export async function uploadProjectMedia(projectID: string, files: File[]) {
  const form = new FormData()
  files.forEach((file) => form.append('files', file))
  const result = await request<{ media: ProjectMedia[] }>(`/v1/projects/${projectID}/media`, {
    method: 'POST',
    body: form,
  })
  return result.media
}

export function mediaURL(item: ProjectMedia) {
  return API_BASE + item.content_url
}

export type ExportFormat = 'mp4' | 'mov' | 'webm' | 'gif' | 'mp3'
export type ExportQuality = 'draft' | 'standard' | 'high' | 'original'
export type ExportResolution = 'source' | '3840x2160' | '1920x1080' | '1280x720' | '854x480'

export type ExportRequest = {
  source: string
  format: ExportFormat
  quality: ExportQuality
  resolution: ExportResolution
  fps: number
  audio: boolean
  start?: number
  duration?: number
  filename: string
}

export type ExportResult = {
  media: ProjectMedia
  download_url: string
}

export function exportProjectMedia(projectID: string, body: ExportRequest) {
  return request<ExportResult>(`/v1/projects/${projectID}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function downloadProjectFile(contentURL: string, filename: string) {
  const response = await fetch(API_BASE + contentURL)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Download failed (${response.status})`)
  }
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function deleteProjectMedia(projectID: string, path: string) {
  const encoded = path.split('/').filter(Boolean).map(encodeURIComponent).join('/')
  const response = await fetch(`${API_BASE}/v1/projects/${projectID}/files/${encoded}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Request failed (${response.status})`)
  }
}

export async function listProjectChats(projectID: string) {
  const result = await request<{ chats: ChatRecord[] }>(`/v1/projects/${projectID}/chats`)
  return result.chats
}

export function createProjectChat(projectID: string, title = '') {
  return request<ChatRecord>(`/v1/projects/${projectID}/chats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function getProjectChat(projectID: string, chatID: string) {
  return request<ChatRecord & { messages: SavedChatMessage[] }>(`/v1/projects/${projectID}/chats/${chatID}`)
}

export function renameProjectChat(projectID: string, chatID: string, title: string) {
  return request<ChatRecord>(`/v1/projects/${projectID}/chats/${chatID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
}

export async function deleteProjectChat(projectID: string, chatID: string) {
  const response = await fetch(`${API_BASE}/v1/projects/${projectID}/chats/${chatID}`, { method: 'DELETE' })
  if (!response.ok && response.status !== 204) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Request failed (${response.status})`)
  }
}

export type { TimelineDocument, TimelineClipRecord } from './timeline'

export function getProjectTimeline(projectID: string) {
  return request<TimelineDocument>(`/v1/projects/${projectID}/timeline`)
}

export function putProjectTimeline(
  projectID: string,
  body: TimelineDocument,
  opts?: { keepalive?: boolean },
) {
  return request<TimelineDocument>(`/v1/projects/${projectID}/timeline`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    keepalive: opts?.keepalive,
  })
}

export async function streamAgent(
  input: { projectID: string; sessionID?: string; message: string },
  onEvent: (event: AgentEvent) => void,
) {
  const response = await fetch(API_BASE + '/v1/agent/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({
      project_id: input.projectID,
      session_id: input.sessionID || undefined,
      message: input.message,
    }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `Director request failed (${response.status})`)
  }
  if (!response.body) throw new Error('Director stream is unavailable')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value, { stream: !done })
    const blocks = buffer.split(/\r?\n\r?\n/)
    buffer = blocks.pop() ?? ''
    for (const block of blocks) {
      let type = 'message'
      const data: string[] = []
      for (const line of block.split(/\r?\n/)) {
        if (line.startsWith('event:')) type = line.slice(6).trim()
        if (line.startsWith('data:')) data.push(line.slice(5).trim())
      }
      if (!data.length) continue
      onEvent({ type, data: JSON.parse(data.join('\n')) as Record<string, unknown> })
    }
    if (done) break
  }
}
