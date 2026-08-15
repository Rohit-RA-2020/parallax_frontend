import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip, Grade, MediaAsset, ToolId } from '../types'
import {
  PROJECT_FPS,
  clipAtTime,
} from '../data/project'
import { clipFromAsset, sequenceDuration } from '../lib/edit'
import {
  createProject as createRemoteProject,
  createProjectChat,
  deleteProjectChat,
  deleteProjectMedia,
  getProjectChat,
  listProjectChats,
  listProjectMedia,
  listProjects,
  mediaURL,
  streamAgent,
  uploadProjectMedia,
  type ChatRecord,
  type ProjectMedia,
  type ProjectRecord,
  type SavedChatMessage,
} from '../lib/api'
import { TopBar } from './TopBar'
import { ToolRail } from './ToolRail'
import { MediaPanel } from './MediaPanel'
import { PreviewStage } from './PreviewStage'
import { Timeline } from './Timeline'
import { ChatPanel, ChatRail } from './ChatPanel'
import { fade, panelTransition } from '../lib/motion'

export function Editor() {
  const reduce = useReducedMotion()
  const [tool, setTool] = useState<ToolId>('media')
  const [panelOpen, setPanelOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(3.2)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [safeArea, setSafeArea] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>('clip-highway')
  const [clips, setClips] = useState<Clip[]>([])
  const [pxPerSecond, setPxPerSecond] = useState(24)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [grade] = useState<Grade>({ warmth: 0, contrast: 0.15, saturation: 0.1 })
  const [toast, setToast] = useState<string | null>(null)
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [projectId, setProjectId] = useState('')
  const [assets, setAssets] = useState<MediaAsset[]>([])
  const [mediaLoading, setMediaLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [sessionId, setSessionId] = useState('')
  const [chats, setChats] = useState<ChatRecord[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [projectNameDraft, setProjectNameDraft] = useState('')
  const [creatingProject, setCreatingProject] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const duration = useMemo(() => sequenceDuration(clips), [clips])
  const durationRef = useRef(duration)
  durationRef.current = duration
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const clipsRef = useRef(clips)
  clipsRef.current = clips

  const refreshMedia = useCallback(async (id: string) => {
    setMediaLoading(true)
    try {
      const items = await listProjectMedia(id)
      const next = items.map(toMediaAsset)
      setAssets(next)
      setClips((current) => syncClipMedia(current, next))
    } catch (error) {
      setToast(errorMessage(error))
    } finally {
      setMediaLoading(false)
    }
  }, [])

  const loadChats = useCallback(async (id: string, preferredId?: string) => {
    let items = await listProjectChats(id)
    if (items.length === 0) {
      items = [await createProjectChat(id, '')]
    }
    const wanted = preferredId || readActiveChat(id)
    const active = items.find((chat) => chat.id === wanted) ?? items[0]
    setChats(items)
    setSessionId(active.id)
    writeActiveChat(id, active.id)
    const detail = await getProjectChat(id, active.id)
    setMessages(toUiMessages(detail.messages))
  }, [])

  useEffect(() => {
    let live = true
    listProjects()
      .then(async (items) => {
        if (!live) return
        setProjects(items)
        if (!items[0]) return
        setProjectId(items[0].id)
        void refreshMedia(items[0].id)
        try {
          await loadChats(items[0].id)
        } catch (error) {
          if (live) setToast(errorMessage(error))
        }
      })
      .catch((error) => {
        if (live) setToast(`Backend unavailable: ${errorMessage(error)}`)
      })
    return () => { live = false }
  }, [loadChats, refreshMedia])

  const seek = useCallback((time: number) => {
    setCurrentTime(Math.min(durationRef.current, Math.max(0, time)))
  }, [])

  const removeClip = useCallback((id: string) => {
    const clip = clipsRef.current.find((c) => c.id === id)
    if (!clip) return
    setClips((prev) => prev.filter((c) => c.id !== id))
    setSelectedId((cur) => (cur === id ? null : cur))
    setToast(`Removed ${clip.name}`)
  }, [])

  useEffect(() => {
    if (!isPlaying) return
    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = (now - last) / 1000
      last = now
      setCurrentTime((t) => {
        const next = t + dt
        if (next >= durationRef.current) {
          queueMicrotask(() => setIsPlaying(false))
          return durationRef.current
        }
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isPlaying])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) return

      if (e.code === 'Space' || e.key === 'k' || e.key === 'K') {
        e.preventDefault()
        setIsPlaying((p) => !p)
      }
      if (e.key === 'j' || e.key === 'J') seek(currentTime - 2)
      if (e.key === 'l' || e.key === 'L') seek(currentTime + 2)
      if (e.key === 'ArrowLeft') seek(currentTime - (e.shiftKey ? 1 : 1 / PROJECT_FPS))
      if (e.key === 'ArrowRight') seek(currentTime + (e.shiftKey ? 1 : 1 / PROJECT_FPS))
      if (e.key === 'Home') seek(0)
      if (e.key === 'Escape') setSelectedId(null)
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const id = selectedIdRef.current
        if (!id) return
        e.preventDefault()
        removeClip(id)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [currentTime, seek, removeClip])

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2800)
    return () => window.clearTimeout(id)
  }, [toast])

  useEffect(() => {
    if (currentTime > duration) setCurrentTime(duration)
  }, [currentTime, duration])

  const videoClip = useMemo(() => clipAtTime(clips, currentTime, 'video'), [clips, currentTime])
  const titleClip = useMemo(() => clipAtTime(clips, currentTime, 'title'), [clips, currentTime])
  const selected = clips.find((c) => c.id === selectedId)

  function setToolAndPanel(id: ToolId) {
    if (id === tool && panelOpen) {
      setPanelOpen(false)
      return
    }
    setTool(id)
    setPanelOpen(true)
  }

  function trimClip(id: string, start: number, nextDuration: number) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, start, duration: nextDuration } : c)))
  }

  function moveClip(id: string, start: number, track: string) {
    setClips((prev) => prev.map((c) => (c.id === id ? { ...c, start, track } : c)))
  }

  async function deleteAsset(asset: MediaAsset) {
    if (!projectId || !asset.path) return
    try {
      await deleteProjectMedia(projectId, asset.path)
      setAssets((current) => current.filter((item) => item.id !== asset.id))
      setClips((current) => current.filter((clip) => !clipUsesAsset(clip, asset)))
      setSelectedId((cur) => {
        const selected = clipsRef.current.find((clip) => clip.id === cur)
        return selected && clipUsesAsset(selected, asset) ? null : cur
      })
      const latest = await listProjects()
      setProjects(latest)
      setToast(`Deleted ${asset.name}`)
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  function addAsset(asset: MediaAsset, start = currentTime, track?: string) {
    const clip = clipFromAsset(asset, start, track)
    setClips((prev) => [...prev, clip])
    setSelectedId(clip.id)
    seek(clip.start)
    setToast(`${clip.name} added to ${clip.track}`)
  }

  function clock() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  async function openProject(id: string) {
    setProjectId(id)
    setClips([])
    setSelectedId(null)
    setCurrentTime(0)
    setDraft('')
    setMessages([])
    setChats([])
    setSessionId('')
    void refreshMedia(id)
    try {
      await loadChats(id)
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  async function openChat(id: string, chatID: string) {
    if (!id || chatID === sessionId) return
    try {
      const detail = await getProjectChat(id, chatID)
      setSessionId(chatID)
      writeActiveChat(id, chatID)
      setMessages(toUiMessages(detail.messages))
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  async function newChat() {
    if (!projectId) return
    try {
      const chat = await createProjectChat(projectId)
      setChats((current) => [chat, ...current])
      setSessionId(chat.id)
      writeActiveChat(projectId, chat.id)
      setMessages([])
      setDraft('')
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  async function removeChat(chatID: string) {
    if (!projectId) return
    try {
      await deleteProjectChat(projectId, chatID)
      const remaining = chats.filter((chat) => chat.id !== chatID)
      if (remaining.length === 0) {
        const chat = await createProjectChat(projectId)
        setChats([chat])
        setSessionId(chat.id)
        writeActiveChat(projectId, chat.id)
        setMessages([])
        return
      }
      setChats(remaining)
      if (sessionId === chatID) {
        const next = remaining[0]
        setSessionId(next.id)
        writeActiveChat(projectId, next.id)
        const detail = await getProjectChat(projectId, next.id)
        setMessages(toUiMessages(detail.messages))
      }
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  async function newProject(name: string) {
    name = name.trim()
    if (!name) return
    setCreatingProject(true)
    try {
      const project = await createRemoteProject(name)
      setProjects((current) => [project, ...current])
      await openProject(project.id)
      setCreateOpen(false)
      setProjectNameDraft('')
      setToast(`${project.name} created`)
    } catch (error) {
      setToast(errorMessage(error))
    } finally {
      setCreatingProject(false)
    }
  }

  async function upload(files: File[]) {
    if (!projectId || files.length === 0) return
    setUploading(true)
    try {
      await uploadProjectMedia(projectId, files)
      await refreshMedia(projectId)
      const latest = await listProjects()
      setProjects(latest)
      setToast(`${files.length} ${files.length === 1 ? 'file' : 'files'} uploaded`)
    } catch (error) {
      setToast(errorMessage(error))
    } finally {
      setUploading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function send(text: string) {
    const value = text.trim()
    if (!value || pending) return
    if (!projectId) {
      setToast('Create a project before using Director')
      return
    }
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: value, time: clock() }
    const responseID = uid()
    setMessages((m) => [
      ...m,
      userMsg,
      { id: responseID, role: 'assistant', text: '', time: clock() },
    ])
    setDraft('')
    setPending(true)
    let streamError = ''
    try {
      await streamAgent({ projectID: projectId, sessionID: sessionId, message: value }, (event) => {
        if (event.type === 'session' && typeof event.data.session_id === 'string') {
          setSessionId(event.data.session_id)
          writeActiveChat(projectId, event.data.session_id)
        }
        if (event.type === 'text' && typeof event.data.delta === 'string') {
          setMessages((current) => current.map((message) =>
            message.id === responseID ? { ...message, text: message.text + event.data.delta } : message,
          ))
        }
        if (event.type === 'step' && event.data.phase === 'think') {
          setMessages((current) => current.map((message) =>
            message.id === responseID && message.text.trim()
              ? { ...message, text: message.text.trimEnd() + '\n\n' }
              : message,
          ))
        }
        if (event.type === 'tool_call' && typeof event.data.name === 'string') {
          setToast(`Director is running ${event.data.name.replaceAll('_', ' ')}`)
        }
        if (event.type === 'error' && typeof event.data.message === 'string') {
          streamError = event.data.message
        }
      })
      if (streamError) throw new Error(streamError)
      setMessages((current) => current.map((message) =>
        message.id === responseID && !message.text
          ? { ...message, text: 'The operation completed without a written summary.' }
          : message,
      ))
      await refreshMedia(projectId)
      try {
        const items = await listProjectChats(projectId)
        setChats(items)
      } catch {
        // keep the in-memory chat list if the refresh fails
      }
    } catch (error) {
      setMessages((current) => current.map((message) =>
        message.id === responseID ? { ...message, text: `I couldn't complete that: ${errorMessage(error)}` } : message,
      ))
    } finally {
      setPending(false)
    }
  }



  return (
    <LayoutGroup>
    <div className="chrome relative flex h-full min-w-[1100px] flex-col bg-ink text-cream">
      <TopBar
        projects={projects}
        projectId={projectId}
        projectName="No project"
        uploading={uploading}
        onProject={(id) => openProject(id)}
        onCreateProject={() => setCreateOpen(true)}
        onUpload={() => fileInput.current?.click()}
        onExport={() => setToast('Ask Director to render an output; completed files appear in this project.')}
      />
      <input
        ref={fileInput}
        type="file"
        multiple
        accept="video/*,audio/*,image/*,.srt,.ass,.vtt,.lrc"
        className="hidden"
        onChange={(event) => void upload(Array.from(event.target.files ?? []))}
      />

      <div className="flex min-h-0 flex-1">
        <ToolRail tool={tool} onChange={setToolAndPanel} />
        <AnimatePresence initial={false}>
          {panelOpen && (
            <motion.div
              key="bin"
              initial={reduce ? false : { width: 0, opacity: 0 }}
              animate={{ width: 268, opacity: 1 }}
              exit={reduce ? undefined : { width: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : panelTransition}
              className="h-full shrink-0 overflow-hidden"
            >
              <MediaPanel
                tool={tool}
                assets={assets}
                loading={mediaLoading}
                hasProject={!!projectId}
                onDuration={(id, duration) => setAssets((current) => current.map((asset) =>
                  asset.id === id ? { ...asset, duration } : asset,
                ))}
                onAdd={(asset) => addAsset(asset)}
                onDelete={(asset) => void deleteAsset(asset)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-w-0 flex-1 flex-col">
          <PreviewStage
            currentTime={currentTime}
            isPlaying={isPlaying}
            muted={muted}
            safeArea={safeArea}
            clip={videoClip}
            titleClip={titleClip}
            grade={grade}
            duration={duration}
            onTogglePlay={() => setIsPlaying((p) => !p)}
            onSeek={seek}
            onToggleMute={() => setMuted((m) => !m)}
            onToggleSafe={() => setSafeArea((s) => !s)}
          />
          <Timeline
            clips={clips}
            selectedId={selectedId}
            currentTime={currentTime}
            duration={duration}
            pxPerSecond={pxPerSecond}
            onSelect={setSelectedId}
            onSeek={seek}
            onZoom={setPxPerSecond}
            onTrim={trimClip}
            onMove={moveClip}
            onRemove={removeClip}
            onDropAsset={(asset, start, track) => addAsset(asset, start, track)}
          />
        </div>

        <AnimatePresence initial={false} mode="popLayout">
          {chatOpen ? (
            <motion.div
              key="chat"
              initial={reduce ? false : { width: 0, opacity: 0 }}
              animate={{ width: 360, opacity: 1 }}
              exit={reduce ? undefined : { width: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : panelTransition}
              className="h-full shrink-0 overflow-hidden"
            >
              <ChatPanel
                messages={messages}
                chats={chats}
                chatId={sessionId}
                emptyHint={`${projects.find((item) => item.id === projectId)?.name ?? 'This project'} is ready. Upload media, add it to the timeline, or ask me to inspect and transform project files.`}
                draft={draft}
                pending={pending}
                selected={selected}
                onDraft={setDraft}
                onSend={send}
                onCollapse={() => setChatOpen(false)}
                onNewChat={() => void newChat()}
                onSelectChat={(id) => void openChat(projectId, id)}
                onDeleteChat={(id) => void removeChat(id)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="rail"
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduce ? undefined : { opacity: 0 }}
              transition={fade}
            >
              <ChatRail onOpen={() => setChatOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {createOpen && (
          <motion.div
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduce ? undefined : { opacity: 0 }}
            className="absolute inset-0 z-[70] grid place-items-center bg-black/65 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-project-title"
            onPointerDown={(event) => {
              if (event.target === event.currentTarget && !creatingProject) setCreateOpen(false)
            }}
          >
            <motion.form
              initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? undefined : { opacity: 0, y: 8, scale: 0.98 }}
              onSubmit={(event) => {
                event.preventDefault()
                void newProject(projectNameDraft)
              }}
              className="w-[380px] rounded-xl border border-line bg-panel p-5 shadow-2xl"
            >
              <h2 id="create-project-title" className="text-[16px] font-medium text-cream">Create a project</h2>
              <p className="mt-1 text-[12px] text-mute">Uploads and Director operations stay isolated inside this project.</p>
              <label className="mt-5 block text-[10px] tracking-[0.14em] text-dim uppercase">
                Project name
                <input
                  autoFocus
                  value={projectNameDraft}
                  onChange={(event) => setProjectNameDraft(event.target.value)}
                  maxLength={120}
                  placeholder="Campaign cut"
                  className="mt-2 h-10 w-full rounded-lg border border-line bg-well px-3 text-[13px] normal-case tracking-normal text-cream outline-none placeholder:text-dim focus:border-line-strong"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  type="button"
                  disabled={creatingProject}
                  onClick={() => setCreateOpen(false)}
                  className="h-9 rounded-md px-3 text-[12px] text-mute hover:bg-wash hover:text-cream"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!projectNameDraft.trim() || creatingProject}
                  className="h-9 rounded-md bg-cream px-4 text-[12px] font-medium text-ink disabled:opacity-40"
                >
                  {creatingProject ? 'Creating…' : 'Create project'}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            key={toast}
            initial={reduce ? false : { opacity: 0, y: 10, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={reduce ? undefined : { opacity: 0, y: 8, x: '-50%' }}
            transition={fade}
            className="pointer-events-none absolute bottom-6 left-1/2 z-50 rounded-full border border-line bg-lift px-4 py-2 text-[12px] text-cream shadow-[var(--toast-shadow)]"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
    </LayoutGroup>
  )
}

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function toMediaAsset(item: ProjectMedia): MediaAsset {
  const url = mediaURL(item)
  const kind = item.kind === 'audio' ? 'audio' : item.kind === 'subtitle' ? 'title' : 'video'
  const mediaType = item.kind === 'image' ? 'image' : item.kind === 'audio' ? 'audio' : 'video'
  return {
    id: `project-${item.id}`,
    name: item.name,
    kind,
    duration: item.kind === 'audio' ? 30 : item.kind === 'image' ? 5 : item.kind === 'subtitle' ? 4 : 8,
    thumb: item.kind === 'image' ? url : undefined,
    src: url,
    path: item.path,
    mediaType,
  }
}

function toUiMessages(messages: SavedChatMessage[]): ChatMessage[] {
  return messages
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .filter((message) => message.content.trim())
    .map((message) => ({
      id: uid(),
      role: message.role,
      text: message.content,
      time: '',
    }))
}

function clipUsesAsset(clip: Clip, asset: MediaAsset) {
  if (asset.path && clip.mediaPath === asset.path) return true
  if (asset.src && clip.src && stripQuery(clip.src) === stripQuery(asset.src)) return true
  return false
}

function syncClipMedia(clips: Clip[], assets: MediaAsset[]) {
  const byPath = new Map(assets.filter((asset) => asset.path).map((asset) => [asset.path, asset]))
  const bySrc = new Map(
    assets.filter((asset) => asset.src).map((asset) => [stripQuery(asset.src as string), asset]),
  )
  return clips.map((clip) => {
    const asset = (clip.mediaPath && byPath.get(clip.mediaPath))
      || (clip.src ? bySrc.get(stripQuery(clip.src)) : undefined)
    if (!asset) return clip
    if (asset.src === clip.src && asset.thumb === clip.thumb) return clip
    return {
      ...clip,
      src: asset.src,
      thumb: asset.thumb ?? clip.thumb,
      mediaPath: asset.path ?? clip.mediaPath,
    }
  })
}

function stripQuery(url: string) {
  const index = url.indexOf('?')
  return index === -1 ? url : url.slice(0, index)
}

function activeChatKey(projectID: string) {
  return `parallax.activeChat.${projectID}`
}

function readActiveChat(projectID: string) {
  try {
    return localStorage.getItem(activeChatKey(projectID)) || ''
  } catch {
    return ''
  }
}

function writeActiveChat(projectID: string, chatID: string) {
  try {
    localStorage.setItem(activeChatKey(projectID), chatID)
  } catch {
    // ignore quota / private mode
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unexpected error'
}
