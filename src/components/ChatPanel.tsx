import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, ChevronDown, Plus, PanelRightClose, Trash2 } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip } from '../types'
import type { ChatRecord, LLMProfile, ThinkingEffort } from '../lib/api'
import { profileLabel } from '../lib/api'
import { formatRange } from '../lib/time'
import { cn } from '../lib/cn'
import { fade, softSpring } from '../lib/motion'
import { MarkdownText } from './MarkdownText'
import { Select, SelectContent, SelectItem, SelectTrigger } from './Select'

type Props = {
  messages: ChatMessage[]
  chats: ChatRecord[]
  chatId: string
  emptyHint: string
  draft: string
  pending: boolean
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
  messages,
  chats,
  chatId,
  emptyHint,
  draft,
  pending,
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
    <aside className="chrome flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
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
        {messages.map((m) => (
          <Message key={m.id} message={m} reduce={!!reduce} />
        ))}
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

      <div className="border-t border-line p-3">
        <form onSubmit={submit} className="relative">
          <textarea
            value={draft}
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={onKey}
            rows={2}
            placeholder="Ask to recut, grade, or title…"
            className="w-full resize-none rounded-lg border border-line bg-well px-3 py-2.5 pr-11 text-[13px] text-cream outline-none placeholder:text-dim focus:border-line-strong"
          />
          <motion.button
            type="submit"
            disabled={!draft.trim() || pending}
            aria-label="Send"
            whileHover={reduce || !draft.trim() ? undefined : { scale: 1.05 }}
            whileTap={reduce || !draft.trim() ? undefined : { scale: 0.92 }}
            transition={softSpring}
            className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-md bg-cream text-ink disabled:bg-cream/15 disabled:text-dim"
          >
            <ArrowUp size={14} />
          </motion.button>
        </form>
        {models.length > 0 && onModel && activeModel && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select value={activeModel.id} onValueChange={onModel}>
              <SelectTrigger aria-label="Language model">
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
            <ThinkingEffortSelect value={thinkingEffort} onChange={onThinkingEffort} />
          </div>
        )}
        {(models.length === 0 || !onModel || !activeModel) && (
          <ThinkingEffortSelect value={thinkingEffort} onChange={onThinkingEffort} className="mt-2" />
        )}
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
      <SelectTrigger className={className} aria-label="Thinking effort">
        <span className="truncate">Thinking: {capitalize(value)}</span>
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

function Message({ message, reduce }: { message: ChatMessage; reduce: boolean }) {
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
