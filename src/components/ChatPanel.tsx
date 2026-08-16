import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronDown, ChevronRight, CircleAlert, LoaderCircle, Plus, PanelRightClose, Trash2, Wrench } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip, DirectorActivity } from '../types'
import type { ChatRecord, LLMProfile, ThinkingEffort } from '../lib/api'
import { profileLabel } from '../lib/api'
import { formatRange } from '../lib/time'
import { cn } from '../lib/cn'
import { fade, softSpring } from '../lib/motion'
import { MarkdownText } from './MarkdownText'
import { Select, SelectContent, SelectItem, SelectTrigger } from './Select'

type Props = {
  width: number
  messages: ChatMessage[]
  chats: ChatRecord[]
  chatId: string
  emptyHint: string
  draft: string
  pending: boolean
  activity: DirectorActivity[]
  activityStartedAt: number | null
  selected: Clip | undefined
  onDraft: (value: string) => void
  onSend: (text: string) => void
  onCollapse: () => void
  onNewChat: () => void
  onSelectChat: (id: string) => void
  onDeleteChat: (id: string) => void
  models?: LLMProfile[]
  modelId?: string
  onModel?: (id: string) => void
  thinkingEffort: ThinkingEffort
  onThinkingEffort: (value: ThinkingEffort) => void
}

export function ChatPanel({
  width,
  messages,
  chats,
  chatId,
  emptyHint,
  draft,
  pending,
  activity,
  activityStartedAt,
  selected,
  onDraft,
  onSend,
  onCollapse,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  models = [],
  modelId = '',
  onModel,
  thinkingEffort,
  onThinkingEffort,
}: Props) {
  const reduce = useReducedMotion()
  const end = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const menu = useRef<HTMLDivElement>(null)
  const active = chats.find((chat) => chat.id === chatId)
  const activeModel = models.find((model) => model.id === modelId) ?? models[0]

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

  useEffect(() => {
    if (!menuOpen) return
    const onPointer = (event: MouseEvent) => {
      if (!menu.current?.contains(event.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    return () => window.removeEventListener('mousedown', onPointer)
  }, [menuOpen])

  function submit(e: FormEvent) {
    e.preventDefault()
    onSend(draft)
  }

  function onKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend(draft)
    }
  }

  return (
    <aside className="chrome flex h-full w-full shrink-0 flex-col border-l border-line bg-panel" style={{ width }}>
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="relative grid size-6 shrink-0 place-items-center rounded-full border border-live/30">
            <motion.span
              className="size-1.5 rounded-full bg-live"
              animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
          <div className="relative min-w-0" ref={menu}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="flex max-w-[190px] items-center gap-1 text-left"
              aria-haspopup="listbox"
              aria-expanded={menuOpen}
            >
              <span className="min-w-0">
                <span className="block text-[13px] font-medium">Director</span>
                <span className="block truncate text-[10px] tracking-wide text-mute uppercase">
                  {active?.title || 'New chat'}
                </span>
              </span>
              <ChevronDown size={12} className={cn('shrink-0 text-dim transition-transform', menuOpen && 'rotate-180')} />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={reduce ? false : { opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduce ? undefined : { opacity: 0, y: -4 }}
                  transition={fade}
                  className="absolute top-full left-0 z-30 mt-2 w-[220px] overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--toast-shadow)]"
                  role="listbox"
                >
                  <div className="max-h-56 overflow-y-auto py-1 scroll-thin">
                    {chats.length === 0 && (
                      <div className="px-3 py-2 text-[11px] text-dim">No saved chats yet</div>
                    )}
                    {chats.map((chat) => (
                      <div
                        key={chat.id}
                        className={cn(
                          'flex items-center gap-1 px-1.5 py-0.5',
                          chat.id === chatId && 'bg-wash',
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            onSelectChat(chat.id)
                            setMenuOpen(false)
                          }}
                          className="min-w-0 flex-1 truncate rounded-md px-1.5 py-1.5 text-left text-[12px] text-cream hover:bg-wash"
                        >
                          {chat.title || 'New chat'}
                        </button>
                        <button
                          type="button"
                          aria-label={`Delete ${chat.title || 'chat'}`}
                          onClick={() => onDeleteChat(chat.id)}
                          className="grid size-7 shrink-0 place-items-center rounded-md text-dim hover:bg-wash hover:text-cream"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        <div className="flex items-center">
          <motion.button
            type="button"
            onClick={() => {
              setMenuOpen(false)
              onNewChat()
            }}
            aria-label="New chat"
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={softSpring}
            className="grid size-8 place-items-center rounded-md text-mute hover:bg-wash hover:text-cream"
          >
            <Plus size={15} />
          </motion.button>
          <motion.button
            type="button"
            onClick={onCollapse}
            aria-label="Collapse chat"
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={softSpring}
            className="grid size-8 place-items-center rounded-md text-mute hover:bg-wash hover:text-cream"
          >
            <PanelRightClose size={15} />
          </motion.button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {selected && (
          <motion.div
            key={selected.id}
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            transition={fade}
            className="overflow-hidden border-b border-line"
          >
            <div className="px-4 py-2.5">
              <div className="text-[10px] tracking-[0.14em] text-dim uppercase">Looking at</div>
              <div className="mt-0.5 flex items-baseline justify-between gap-3">
                <span className="text-[12px] text-cream">{selected.name}</span>
                <span className="font-mono text-[10px] text-mute">
                  {formatRange(selected.start, selected.duration)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 scroll-thin">
        {messages.length === 0 && !pending && (
          <div className="text-[13px] leading-relaxed text-mute">{emptyHint}</div>
        )}
        {messages.map((m, index) => {
          const beforeResponse = activity.length > 0 && index === messages.length - 1 && m.role === 'assistant'
          if (beforeResponse) {
            return <Message
              key={m.id}
              message={m}
              reduce={!!reduce}
              activity={<ActivityPanel items={activity} pending={pending} startedAt={activityStartedAt} reduce={!!reduce} />}
            />
          }
          return <Message key={m.id} message={m} reduce={!!reduce} />
        })}
        {activity.length > 0 && (messages.length === 0 || messages[messages.length - 1].role !== 'assistant') && (
          <ActivityPanel items={activity} pending={pending} startedAt={activityStartedAt} reduce={!!reduce} />
        )}
        {pending && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 text-[12px] text-mute"
          >
            <span className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <motion.i
                  key={i}
                  className="size-1 rounded-full bg-live"
                  animate={reduce ? undefined : { opacity: [0.3, 1, 0.3], y: [0, -2, 0] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.12 }}
                />
              ))}
            </span>
            Cutting…
          </motion.div>
        )}
        <div ref={end} />
      </div>

      <div className="border-t border-line bg-panel p-3">
        <form
          onSubmit={submit}
          className="overflow-hidden rounded-[18px] border border-line-strong bg-lift shadow-[0_10px_28px_rgb(0_0_0_/_0.07)] transition-colors focus-within:border-line-strong"
        >
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Ask Director to recut, grade, or title…"
            className="block min-h-[78px] w-full resize-none border-0 bg-transparent px-3.5 py-3.5 pr-4 text-[10px] leading-relaxed text-cream outline-none placeholder:text-dim"
          />
          <div className="flex min-w-0 items-center justify-end gap-1.5 px-2.5 pb-2.5">
            <div className="ml-auto flex min-w-0 items-center gap-0.5">
              {models.length > 0 && onModel && activeModel && (
                <Select value={activeModel.id} onValueChange={onModel}>
                  <SelectTrigger
                    className="!h-7 !w-auto !min-w-0 !max-w-[116px] !border-transparent !bg-transparent px-1.5 text-[6px] tracking-wide text-dim shadow-none hover:bg-wash hover:text-cream focus-visible:bg-wash"
                    aria-label="Language model"
                    title={`Language model: ${profileLabel(activeModel)}`}
                  >
                    <span className="truncate">{profileLabel(activeModel)}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {models.map((model) => {
                      const host = profileHost(model.base_url)
                      return (
                        <SelectItem key={model.id} value={model.id} textValue={profileLabel(model)}>
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate">{profileLabel(model)}</span>
                            {host && <span className="truncate text-[10px] text-dim">{host}</span>}
                          </span>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              )}
              {models.length > 0 && onModel && activeModel && (
                <span className="px-0.5 text-[10px] text-dim/50" aria-hidden>·</span>
              )}
              <ThinkingEffortSelect
                value={thinkingEffort}
                onChange={onThinkingEffort}
                className="!h-7 !w-auto !min-w-[78px] !max-w-[104px] !border-transparent !bg-transparent px-1.5 text-[6px] tracking-wide text-dim shadow-none hover:bg-wash hover:text-cream focus-visible:bg-wash"
              />
            </div>
            <motion.button
                type="submit"
                disabled={!draft.trim() || pending}
                aria-label="Send"
                whileHover={reduce || !draft.trim() ? undefined : { scale: 1.06, y: -1 }}
                whileTap={reduce || !draft.trim() ? undefined : { scale: 0.9 }}
                transition={softSpring}
                className="grid size-7 place-items-center rounded-full bg-cream text-ink transition-opacity disabled:opacity-25"
              >
                <ArrowUp size={14} />
            </motion.button>
          </div>
        </form>
      </div>
    </aside>
  )
}

function ThinkingEffortSelect({
  value,
  onChange,
  className,
}: {
  value: ThinkingEffort
  onChange: (value: ThinkingEffort) => void
  className?: string
}) {
  return (
    <Select value={value} onValueChange={(next) => onChange(next as ThinkingEffort)}>
      <SelectTrigger
        className={className}
        aria-label="Thinking effort"
        title={`Thinking effort: ${capitalize(value)}`}
      >
        <span className="truncate">{capitalize(value)}</span>
      </SelectTrigger>
      <SelectContent>
        {(['low', 'medium', 'high'] as ThinkingEffort[]).map((effort) => (
          <SelectItem key={effort} value={effort} textValue={capitalize(effort)}>
            {capitalize(effort)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function Message({
  message,
  reduce,
  activity,
}: {
  message: ChatMessage
  reduce: boolean
  activity?: ReactNode
}) {
  const mine = message.role === 'user'
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={fade}
      className={cn('flex flex-col gap-1', mine && 'items-end')}
    >
      <div className="flex items-center gap-2 text-[10px] text-dim">
        <span>{mine ? 'You' : 'Director'}</span>
        {message.time && <span className="font-mono">{message.time}</span>}
      </div>
      {activity ?? (!mine && message.workedMs != null ? (
        message.trace?.length
          ? <ActivityPanel items={message.trace} pending={false} startedAt={null} elapsedOverride={message.workedMs} reduce={reduce} />
          : <WorkedDuration value={message.workedMs} />
      ) : null)}
      <div
        className={cn(
          'max-w-[92%] text-[13px] leading-relaxed',
          mine
            ? 'rounded-lg rounded-tr-sm border border-line bg-lift px-3 py-2 text-cream'
            : 'text-mute',
        )}
      >
        {mine ? message.text : <MarkdownText>{message.text}</MarkdownText>}
      </div>
    </motion.div>
  )
}

function WorkedDuration({ value }: { value: number }) {
  return <div className="mt-1 w-full border-t border-dotted border-line/80 px-0 pt-1 text-[9px] text-mute">Worked for {formatWorkDuration(value)}</div>
}

function ActivityPanel({
  items,
  pending,
  startedAt,
  elapsedOverride,
  reduce,
}: {
  items: DirectorActivity[]
  pending: boolean
  startedAt: number | null
  elapsedOverride?: number
  reduce: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    setExpanded(false)
  }, [pending])

  useEffect(() => {
    if (!startedAt) return
    const update = () => setElapsedMs(Math.max(0, Date.now() - startedAt))
    update()
    if (!pending) return
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [pending, startedAt])

  const latest = items[items.length - 1]
  const label = compactActivityLabel(latest?.title ?? 'Working')

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-1 w-full max-w-full border-t border-dotted border-line/80 pt-1 opacity-70"
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={pending ? `Director is ${label}` : `Show ${items.length} Director steps`}
        className="flex w-full max-w-full items-center gap-1 rounded px-0 py-0 text-left text-[8px] text-dim transition-colors hover:bg-wash"
      >
        {pending ? (
          <>
            <span className="size-1 shrink-0 rounded-full bg-live" />
            <span className="min-w-0 truncate text-mute">{label}</span>
            <span className="ml-auto shrink-0 font-mono text-[7px] text-dim">{formatWorkDuration(elapsedMs)}</span>
          </>
        ) : (
          <span className="shrink-0 text-[9px] text-mute">Worked for {formatWorkDuration(elapsedOverride ?? elapsedMs)}</span>
        )}
        <ChevronRight size={11} className={cn('shrink-0 transition-transform', expanded && 'rotate-90')} />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reduce ? undefined : { height: 0, opacity: 0 }}
            className="ml-2 space-y-1 border-l border-line/40 py-1 pl-2"
          >
            {items.map((item) => <ActivityRow key={item.id} item={item} reduce={reduce} />)}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function ActivityRow({ item, reduce }: { item: DirectorActivity; reduce: boolean }) {
  const tool = item.kind === 'tool'
  const icon = item.status === 'active'
    ? <LoaderCircle size={12} className={cn('text-live', !reduce && 'animate-spin')} />
    : item.status === 'error'
      ? <CircleAlert size={12} className="text-mark" />
      : tool
        ? <Wrench size={11} className="text-live" />
        : <Check size={12} className="text-dim" />

  return (
    <div className="rounded-md px-1 py-1 text-[10px] text-dim transition-colors hover:bg-wash">
      <div className="flex min-w-0 items-center gap-2">
        <span className="grid size-4 shrink-0 place-items-center text-dim">
          {icon}
        </span>
        <span className={cn('min-w-0 flex-1 truncate', item.status === 'error' ? 'text-mark/90' : 'text-mute')}>
          {item.title}
        </span>
        {item.iteration != null && <span className="shrink-0 font-mono text-[9px] text-dim">#{item.iteration}</span>}
        {item.elapsedMs != null && <span className="shrink-0 font-mono text-[9px] text-dim">{formatElapsed(item.elapsedMs)}</span>}
      </div>
      {(item.detail || item.arguments !== undefined) && (
        <div className="mt-1 ml-6 min-w-0 space-y-1">
          {item.detail && <div className={cn('break-words text-[9px] leading-relaxed text-dim', item.status === 'error' && 'text-mark/80')}>{item.detail}</div>}
          {item.arguments !== undefined && (
            <details className="group">
              <summary className="cursor-pointer text-[9px] text-dim hover:text-mute">Show arguments</summary>
              <pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded bg-wash-strong p-1.5 font-mono text-[9px] leading-relaxed text-dim scroll-thin">
                {formatArguments(item.arguments)}
              </pre>
            </details>
          )}
        </div>
      )}
    </div>
  )
}

function formatArguments(value: unknown) {
  let text = ''
  try {
    text = JSON.stringify(value, null, 2) ?? String(value)
  } catch {
    text = String(value)
  }
  return text.length > 1200 ? `${text.slice(0, 1200)}…` : text
}

function formatElapsed(value: number) {
  if (value < 1000) return `${Math.max(1, Math.round(value))}ms`
  return `${(value / 1000).toFixed(1)}s`
}

function compactActivityLabel(value: string) {
  if (/^Planning/.test(value)) return 'Planning…'
  if (/^Searching/.test(value)) return 'Searching…'
  if (/^Executing/.test(value)) return 'Working…'
  if (/^Inspecting/.test(value)) return 'Inspecting…'
  if (/^Reading/.test(value)) return 'Reading…'
  if (/^Editing/.test(value)) return 'Editing…'
  if (/^Placing/.test(value)) return 'Placing…'
  return value
}

function formatWorkDuration(value: number) {
  const seconds = Math.max(1, Math.round(value / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainder = seconds % 60
  return remainder ? `${minutes}m ${remainder}s` : `${minutes}m`
}

export function ChatRail({ onOpen }: { onOpen: () => void }) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="chrome flex w-11 shrink-0 flex-col items-center gap-3 border-l border-line bg-panel py-4 text-mute transition-colors hover:bg-wash hover:text-cream"
      aria-label="Open Director"
    >
      <motion.span
        className="size-1.5 rounded-full bg-live"
        animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span className="rotate-180 text-[10px] font-medium tracking-[0.18em] uppercase [writing-mode:vertical-rl]">
        Director
      </span>
    </motion.button>
  )
}

function profileHost(url: string) {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}
