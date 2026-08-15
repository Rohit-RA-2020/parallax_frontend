import { useEffect, useRef, type FormEvent, type KeyboardEvent } from 'react'
import { ArrowUp, PanelRightClose } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { ChatMessage, Clip } from '../types'
import { suggestions } from '../data/project'
import { formatRange } from '../lib/time'
import { cn } from '../lib/cn'
import { fade, softSpring } from '../lib/motion'

type Props = {
  messages: ChatMessage[]
  draft: string
  pending: boolean
  selected: Clip | undefined
  onDraft: (value: string) => void
  onSend: (text: string) => void
  onCollapse: () => void
}

export function ChatPanel({
  messages,
  draft,
  pending,
  selected,
  onDraft,
  onSend,
  onCollapse,
}: Props) {
  const reduce = useReducedMotion()
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pending])

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
    <aside className="flex h-full w-[360px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex h-12 items-center justify-between border-b border-line px-4">
        <div className="flex items-center gap-2.5">
          <span className="relative grid size-6 place-items-center rounded-full border border-live/30">
            <motion.span
              className="size-1.5 rounded-full bg-live"
              animate={reduce ? undefined : { scale: [1, 1.18, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </span>
          <div>
            <div className="text-[13px] font-medium">Director</div>
            <div className="text-[10px] tracking-wide text-mute uppercase">On the timeline</div>
          </div>
        </div>
        <motion.button
          type="button"
          onClick={onCollapse}
          aria-label="Collapse chat"
          whileHover={reduce ? undefined : { scale: 1.06 }}
          whileTap={reduce ? undefined : { scale: 0.92 }}
          transition={softSpring}
          className="grid size-8 place-items-center rounded-md text-mute hover:bg-white/5 hover:text-cream"
        >
          <PanelRightClose size={15} />
        </motion.button>
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
        <div className="mb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <motion.button
              key={s}
              type="button"
              onClick={() => onSend(s)}
              whileHover={reduce ? undefined : { y: -1 }}
              whileTap={reduce ? undefined : { scale: 0.97 }}
              transition={softSpring}
              className="rounded-full border border-line px-2.5 py-1 text-[11px] text-mute transition-colors hover:border-line-strong hover:text-cream"
            >
              {s}
            </motion.button>
          ))}
        </div>
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
            className="absolute right-2 bottom-2 grid size-7 place-items-center rounded-md bg-cream text-ink disabled:bg-white/10 disabled:text-dim"
          >
            <ArrowUp size={14} />
          </motion.button>
        </form>
      </div>
    </aside>
  )
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
        <span className="font-mono">{message.time}</span>
      </div>
      <div
        className={cn(
          'max-w-[92%] text-[13px] leading-relaxed',
          mine
            ? 'rounded-lg rounded-tr-sm bg-lift px-3 py-2 text-cream'
            : 'text-mute',
        )}
      >
        {message.text}
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
      whileHover={reduce ? undefined : { backgroundColor: 'rgba(255,255,255,0.02)' }}
      className="flex w-11 shrink-0 flex-col items-center gap-3 border-l border-line bg-panel py-4 text-mute hover:text-cream"
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
