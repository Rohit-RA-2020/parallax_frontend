import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip, Grade, MediaAsset, ToolId } from '../types'
import {
  PROJECT_FPS,
  clipAtTime,
} from '../data/project'
import { clipFromAsset, sequenceDuration } from '../lib/edit'
import {
  applySourceDuration,
  buildTimelineDocument,
  clampClip,
  clipsFromDocument,
  emptyTimelineDocument,
  findClipAsset,
  hydrateClip,
  snapTime,
  timelineFingerprint,
} from '../lib/timeline'
import {
  createProject as createRemoteProject,
  createProjectChat,
  deleteProjectChat,
  deleteProjectMedia,
  downloadProjectFile,
  exportProjectMedia,
  getProjectChat,
  getProjectTimeline,
  listProjectChats,
  listProjectMedia,
  listProjects,
  mediaURL,
  putProjectTimeline,
  streamAgent,
  uploadProjectMedia,
  type ChatRecord,
  type ProjectMedia,
  type ProjectRecord,
  type ExportRequest,
  type SavedChatMessage,
} from '../lib/api'
import { TopBar } from './TopBar'
import { ToolRail } from './ToolRail'
import { MediaPanel } from './MediaPanel'
import { PreviewStage } from './PreviewStage'
import { Timeline } from './Timeline'
import { ChatPanel, ChatRail } from './ChatPanel'
import { ExportDialog } from './ExportDialog'
import { fade, panelTransition } from '../lib/motion'

export function Editor() {
  const reduce = useReducedMotion()
  const [tool, setTool] = useState<ToolId>('media')
  const [panelOpen, setPanelOpen] = useState(true)
  const [chatOpen, setChatOpen] = useState(true)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [safeArea, setSafeArea] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [clips, setClips] = useState<Clip[]>([])
  const [pxPerSecond, setPxPerSecond] = useState(24)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
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
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
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
  const assetsRef = useRef(assets)
  assetsRef.current = assets
  const projectIdRef = useRef(projectId)
  projectIdRef.current = projectId
  const pxPerSecondRef = useRef(pxPerSecond)
  pxPerSecondRef.current = pxPerSecond
  const currentTimeRef = useRef(currentTime)
  currentTimeRef.current = currentTime
  const revisionRef = useRef(0)
  const lastSavedRef = useRef('')
  const timelineReadyRef = useRef(false)
  const saveTimerRef = useRef(0)
  const saveGenRef = useRef(0)
  const savingRef = useRef(false)
  const dirtyRef = useRef(false)

  const refreshMedia = useCallback(async (id: string) => {
    setMediaLoading(true)
    try {
      const items = await listProjectMedia(id)
      if (projectIdRef.current !== id) return
      const previous = new Map(
        assetsRef.current.filter((asset) => asset.path).map((asset) => [asset.path as string, asset]),
      )
      const next = items.map((item) => {
        const asset = toMediaAsset(item)
        if (asset.duration > 0 || !asset.path) return asset
        const known = previous.get(asset.path)
        return known?.duration ? { ...asset, duration: known.duration } : asset
      })
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

  const flushTimeline = useCallback(async (opts?: { keepalive?: boolean }) => {
    if (!timelineReadyRef.current) return
    const id = projectIdRef.current
    if (!id) return
    window.clearTimeout(saveTimerRef.current)
    const doc = buildTimelineDocument({
      clips: clipsRef.current,
      fps: PROJECT_FPS,
      revision: revisionRef.current,
      playhead: currentTimeRef.current,
      selectedId: selectedIdRef.current,
      pxPerSecond: pxPerSecondRef.current,
    })
    const fingerprint = timelineFingerprint(doc)
    if (fingerprint === lastSavedRef.current) {
      dirtyRef.current = false
      return
    }
    dirtyRef.current = false
    const gen = saveGenRef.current
    savingRef.current = true
    setSaveStatus('saving')
    try {
      const saved = await putProjectTimeline(id, doc, opts)
      if (gen !== saveGenRef.current || projectIdRef.current !== id) return
      revisionRef.current = saved.revision
      lastSavedRef.current = fingerprint
      setSaveStatus('saved')
    } catch (error) {
      if (gen !== saveGenRef.current || projectIdRef.current !== id) return
      dirtyRef.current = true
      setSaveStatus('error')
      if (!opts?.keepalive) setToast(errorMessage(error))
    } finally {
      if (gen === saveGenRef.current) savingRef.current = false
    }
  }, [])

  const scheduleSave = useCallback(() => {
    if (!timelineReadyRef.current || !projectIdRef.current) return
    dirtyRef.current = true
    setSaveStatus((status) => (status === 'saving' ? status : 'idle'))
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = window.setTimeout(() => {
      void flushTimeline()
    }, 400)
  }, [flushTimeline])

  const loadTimeline = useCallback(async (id: string, assets: MediaAsset[]) => {
    const timeline = await getProjectTimeline(id)
    if (projectIdRef.current !== id) return
    const nextClips = clipsFromDocument({
      ...emptyTimelineDocument(),
      ...timeline,
      clips: timeline.clips ?? [],
    }, assets)
    const fps = timeline.fps > 0 ? timeline.fps : PROJECT_FPS
    const playhead = Math.max(0, (timeline.playhead_frame ?? 0) / fps)
    const selected = timeline.selected_id && nextClips.some((clip) => clip.id === timeline.selected_id)
      ? timeline.selected_id
      : null
    const zoom = timeline.px_per_second && timeline.px_per_second >= 18 && timeline.px_per_second <= 72
      ? timeline.px_per_second
      : pxPerSecondRef.current
    setClips(nextClips)
    setSelectedId(selected)
    setCurrentTime(playhead)
    setPxPerSecond(zoom)
    revisionRef.current = timeline.revision ?? 0
    lastSavedRef.current = timelineFingerprint(buildTimelineDocument({
      clips: nextClips,
      fps: PROJECT_FPS,
      revision: timeline.revision ?? 0,
      playhead,
      selectedId: selected,
      pxPerSecond: zoom,
    }))
    timelineReadyRef.current = true
    setSaveStatus(nextClips.length ? 'saved' : 'idle')
  }, [])

  const bootProject = useCallback(async (id: string) => {
    projectIdRef.current = id
    setProjectId(id)
    timelineReadyRef.current = false
    lastSavedRef.current = ''
    revisionRef.current = 0
    setSaveStatus('idle')
    setClips([])
    setSelectedId(null)
    setCurrentTime(0)
    setMediaLoading(true)
    try {
      const items = await listProjectMedia(id)
      if (projectIdRef.current !== id) return
      const previous = new Map(
        assetsRef.current.filter((asset) => asset.path).map((asset) => [asset.path as string, asset]),
      )
      const next = items.map((item) => {
        const asset = toMediaAsset(item)
        if (asset.duration > 0 || !asset.path) return asset
        const known = previous.get(asset.path)
        return known?.duration ? { ...asset, duration: known.duration } : asset
      })
      setAssets(next)
      await loadTimeline(id, next)
    } catch (error) {
      if (projectIdRef.current === id) {
        setToast(errorMessage(error))
        timelineReadyRef.current = false
      }
    } finally {
      if (projectIdRef.current === id) setMediaLoading(false)
    }
  }, [loadTimeline])

  useEffect(() => {
    let live = true
    listProjects()
      .then(async (items) => {
        if (!live) return
        setProjects(items)
        if (!items[0]) return
        await bootProject(items[0].id)
        if (!live) return
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
  }, [bootProject, loadChats])

  useEffect(() => {
    scheduleSave()
  }, [clips, selectedId, pxPerSecond, scheduleSave])

  useEffect(() => {
    if (isPlaying || !timelineReadyRef.current) return
    scheduleSave()
  }, [isPlaying, scheduleSave])

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') void flushTimeline({ keepalive: true })
    }
    const onPageHide = () => {
      void flushTimeline({ keepalive: true })
    }
    document.addEventListener('visibilitychange', onHide)
    window.addEventListener('pagehide', onPageHide)
    return () => {
      document.removeEventListener('visibilitychange', onHide)
      window.removeEventListener('pagehide', onPageHide)
      window.clearTimeout(saveTimerRef.current)
      void flushTimeline({ keepalive: true })
    }
  }, [flushTimeline])

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

  function trimClip(id: string, start: number, nextDuration: number, sourceIn: number) {
    setClips((prev) => prev.map((c) => {
      if (c.id !== id) return c
      return clampClip({
        ...c,
        start,
        duration: nextDuration,
        sourceIn,
        autoFit: false,
      }, PROJECT_FPS)
    }))
  }

  function moveClip(id: string, start: number, track: string) {
    setClips((prev) => prev.map((c) => (
      c.id === id ? { ...c, start: snapTime(Math.max(0, start), PROJECT_FPS), track } : c
    )))
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

  function applyMediaDuration(assetId: string, nextDuration: number) {
    if (!Number.isFinite(nextDuration) || nextDuration <= 0) return
    setAssets((current) => current.map((asset) =>
      asset.id === assetId ? { ...asset, duration: nextDuration } : asset,
    ))
    const asset = assetsRef.current.find((item) => item.id === assetId)
    if (!asset) return
    const linked = { ...asset, duration: nextDuration }
    setClips((current) => current.map((clip) => {
      if (!clipUsesAsset(clip, linked)) return clip
      return applySourceDuration(clip, nextDuration, PROJECT_FPS)
    }))
  }

  function applyMediaFrame(assetId: string, width: number, height: number) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return
    const w = Math.round(width)
    const h = Math.round(height)
    setAssets((current) => current.map((asset) =>
      asset.id === assetId && (asset.width !== w || asset.height !== h)
        ? { ...asset, width: w, height: h }
        : asset,
    ))
    const asset = assetsRef.current.find((item) => item.id === assetId)
    if (!asset) return
    setClips((current) => current.map((clip) => {
      if (!clipUsesAsset(clip, asset)) return clip
      if (clip.width === w && clip.height === h) return clip
      return { ...clip, width: w, height: h }
    }))
  }

  function addAsset(asset: MediaAsset, start = currentTime, track?: string) {
    const clip = clampClip(clipFromAsset(asset, snapTime(start, PROJECT_FPS), track), PROJECT_FPS)
    setClips((prev) => [...prev, clip])
    setSelectedId(clip.id)
    seek(clip.start)
    setToast(`${clip.name} added to ${clip.track}`)
  }

  function clock() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  async function openProject(id: string) {
    if (id === projectIdRef.current) return
    await flushTimeline()
    saveGenRef.current += 1
    setDraft('')
    setMessages([])
    setChats([])
    setSessionId('')
    try {
      await bootProject(id)
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

  async function runExport(body: ExportRequest) {
    if (!projectId) return
    setExporting(true)
    try {
      const result = await exportProjectMedia(projectId, body)
      await downloadProjectFile(result.download_url, result.media.name)
      setExportOpen(false)
      setToast(`Exported ${result.media.name}`)
    } catch (error) {
      setToast(errorMessage(error))
    } finally {
      setExporting(false)
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
        exporting={exporting}
        onExport={() => {
          if (!projectId) {
            setToast('Create a project before exporting')
            return
          }
          setExportOpen(true)
        }}
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
                onDuration={(id, nextDuration) => applyMediaDuration(id, nextDuration)}
                onFrame={(id, width, height) => applyMediaFrame(id, width, height)}
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
            saveStatus={saveStatus}
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
        {exportOpen && (
          <ExportDialog
            projectName={projects.find((item) => item.id === projectId)?.name ?? 'Project'}
            assets={assets}
            selected={selected}
            playhead={videoClip}
            busy={exporting}
            onClose={() => {
              if (!exporting) setExportOpen(false)
            }}
            onExport={(body) => void runExport(body)}
          />
        )}
      </AnimatePresence>

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
  const measured = item.duration && item.duration > 0 ? item.duration : 0
  return {
    id: `project-${item.id}`,
    name: item.name,
    kind,
    duration: measured || (item.kind === 'image' ? 5 : item.kind === 'subtitle' ? 4 : 0),
    thumb: item.kind === 'image' ? url : undefined,
    src: url,
    path: item.path,
    mediaType,
    width: item.width && item.width > 0 ? item.width : undefined,
    height: item.height && item.height > 0 ? item.height : undefined,
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
  return findClipAsset(clip, [asset]) != null
}

function syncClipMedia(clips: Clip[], assets: MediaAsset[]) {
  return clips.map((clip) => {
    const next = hydrateClip(clip, assets)
    if (
      next.src === clip.src
      && next.thumb === clip.thumb
      && next.name === clip.name
      && next.mediaPath === clip.mediaPath
      && next.sourceDuration === clip.sourceDuration
      && next.duration === clip.duration
      && next.sourceIn === clip.sourceIn
      && next.width === clip.width
      && next.height === clip.height
    ) {
      return clip
    }
    return next
  })
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
