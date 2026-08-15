import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip, Grade, MediaAsset, ToolId } from '../types'
import {
  PROJECT_FPS,
  clipAtTime,
  initialClips,
  initialMessages,
} from '../data/project'
import { clipFromAsset, sequenceDuration } from '../lib/edit'
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
  const [clips, setClips] = useState<Clip[]>(initialClips)
  const [pxPerSecond, setPxPerSecond] = useState(24)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [draft, setDraft] = useState('')
  const [pending, setPending] = useState(false)
  const [grade, setGrade] = useState<Grade>({ warmth: 0, contrast: 0.15, saturation: 0.1 })
  const [toast, setToast] = useState<string | null>(null)

  const duration = useMemo(() => sequenceDuration(clips), [clips])
  const durationRef = useRef(duration)
  durationRef.current = duration
  const selectedIdRef = useRef(selectedId)
  selectedIdRef.current = selectedId
  const clipsRef = useRef(clips)
  clipsRef.current = clips

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

  function send(text: string) {
    const value = text.trim()
    if (!value || pending) return
    const userMsg: ChatMessage = { id: uid(), role: 'user', text: value, time: clock() }
    setMessages((m) => [...m, userMsg])
    setDraft('')
    setPending(true)

    window.setTimeout(() => {
      const { reply, nextClips, nextGrade } = interpret(value, clips, grade)
      if (nextClips) setClips(nextClips)
      if (nextGrade) setGrade(nextGrade)
      setMessages((m) => [
        ...m,
        { id: uid(), role: 'assistant', text: reply, time: clock() },
      ])
      setPending(false)
    }, 720)
  }



  return (
    <LayoutGroup>
    <div className="relative flex h-full min-w-[1100px] flex-col bg-ink text-cream">
      <TopBar onExport={() => setToast('Export is waiting on the backend — visuals only for now.')} />

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
              <MediaPanel tool={tool} onAdd={(asset) => addAsset(asset)} />
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
                draft={draft}
                pending={pending}
                selected={selected}
                onDraft={setDraft}
                onSend={send}
                onCollapse={() => setChatOpen(false)}
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
        {toast && (
          <motion.div
            key={toast}
            initial={reduce ? false : { opacity: 0, y: 10, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={reduce ? undefined : { opacity: 0, y: 8, x: '-50%' }}
            transition={fade}
            className="pointer-events-none absolute bottom-6 left-1/2 z-50 rounded-full border border-line bg-lift px-4 py-2 text-[12px] text-cream shadow-lg"
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

function interpret(text: string, clips: Clip[], grade: Grade) {
  const t = text.toLowerCase()

  if (t.includes('trim') || t.includes('tighten') || t.includes('highway')) {
    const nextClips = clips.map((c) =>
      c.id === 'clip-highway' ? { ...c, duration: Math.max(4.8, Math.min(c.duration, 5.4)) } : c,
    )
    return {
      reply:
        'Trimmed Highway 01 to 5.4s and left a six-frame handle. Wheelhouse still comes in on the same cut — tell me if you want that pulled earlier.',
      nextClips,
    }
  }

  if (t.includes('warm') || t.includes('grade') || t.includes('cliff')) {
    return {
      reply:
        'Pushed the cliff shot warmer — more tungsten in the highlights, shadows still cool. Contrast is sitting a touch higher so the horizon holds.',
      nextGrade: { ...grade, warmth: 0.85, contrast: 0.35, saturation: 0.2 },
    }
  }

  if (t.includes('title') || t.includes('card') || t.includes('salt')) {
    const exists = clips.some((c) => c.id === 'title-open')
    const nextClips = exists
      ? clips
      : [
          {
            id: 'title-open',
            name: 'SALT ROAD',
            track: 'V2',
            kind: 'title' as const,
            start: 0.6,
            duration: 3.4,
            color: '#c4a36a',
          },
          ...clips,
        ]
    return {
      reply:
        'Title card is on V2 from 00:00.6 — tracking-wide SALT ROAD over the open. I can slide it later or swap the type if you want something quieter.',
      nextClips,
    }
  }

  if (t.includes('wave') || t.includes('cut on')) {
    return {
      reply:
        'I’d cut Highway → Wheelhouse on the bright edge of the water, about 00:07:18. That’s a visual-only mark for now — say the word and I’ll move the edit.',
    }
  }

  return {
    reply:
      'Noted. I can trim, grade, or retitle from here. Point me at a clip — or keep talking and I’ll treat the playhead as the subject.',
  }
}
