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
  modified_at: string
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
