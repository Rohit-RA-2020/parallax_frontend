import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search, Star, X } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import type { LLMProfile } from '../lib/api'
import { profileLabel } from '../lib/api'
import { groupLLMProfiles } from '../lib/llmSettings'
import { cn } from '../lib/cn'

type Props = {
  models: LLMProfile[]
  modelId: string
  onModel: (id: string) => void
}

const FAVORITES_KEY = 'parallax.modelFavorites'

function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function providerInitial(label: string) {
  const trimmed = label.trim()
  if (!trimmed) return '·'
  return trimmed.charAt(0).toUpperCase()
}

function hostOf(baseURL: string) {
  try {
    return new URL(baseURL).host.replace(/^www\./, '')
  } catch {
    return ''
  }
}

function modelSublabel(model: LLMProfile, providerLabel: string) {
  const host = hostOf(model.base_url)
  const provider = providerLabel || model.provider_label || ''
  // Mimic "OpenCode · OpenCode Zen": provider grouping + endpoint/host detail
  if (provider && host) return `${provider} · ${host}`
  return provider || host || model.model
}

type RowProps = {
  model: LLMProfile
  label: string
  sublabel: string
  providerGlyph: string
  index: number
  selected: boolean
  highlighted: boolean
  favorite: boolean
  animateIn: boolean
  reduce: boolean
  onHighlight: (index: number) => void
  onChoose: (id: string) => void
  onFavorite: (id: string) => void
  registerRow: (id: string, node: HTMLDivElement | null) => void
}

// Plain div + CSS transitions only — no framer layout/measurement per row,
// so hover/highlight stays at 60fps even with long lists.
const ModelRow = memo(function ModelRow({
  model,
  label,
  sublabel,
  providerGlyph,
  index,
  selected,
  highlighted,
  favorite,
  animateIn,
  reduce,
  onHighlight,
  onChoose,
  onFavorite,
  registerRow,
}: RowProps) {
  return (
    <div
      ref={(node) => registerRow(model.id, node)}
      style={
        animateIn && !reduce
          ? { animationDelay: `${Math.min(index * 18, 144)}ms` }
          : undefined
      }
      className={cn(
        'group relative mb-0.5 flex items-start gap-2 rounded-lg px-2 py-2 last:mb-0',
        'transition-colors duration-100 ease-out active:scale-[0.995]',
        selected ? 'bg-wash-strong' : highlighted ? 'bg-wash' : 'hover:bg-wash',
        animateIn && !reduce && 'model-row-in',
      )}
    >
      {/* Static selection bar — no layoutId, so no layout thrash on hover */}
      <span
        aria-hidden
        className={cn(
          'absolute top-1/2 left-0 z-10 h-5 w-[2.5px] -translate-y-1/2 rounded-full bg-[#3b82f6]',
          'transition-all duration-150 ease-out',
          selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
        )}
      />
      <button
        type="button"
        role="option"
        aria-selected={selected}
        title={label}
        onClick={() => onChoose(model.id)}
        onMouseEnter={() => onHighlight(index)}
        onFocus={() => onHighlight(index)}
        className="relative z-[1] flex min-w-0 flex-1 cursor-pointer items-start gap-2.5 text-left"
      >
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border border-line bg-lift text-[11px] font-semibold text-mute transition-transform duration-100 ease-out group-hover:scale-[1.04]">
          {providerGlyph}
        </span>
        <span className="min-w-0 flex-1">
          {/* Full model name — wraps instead of truncating */}
          <span className="block text-[13px] leading-snug font-medium break-words whitespace-normal text-cream">
            {label}
          </span>
          <span className="mt-1 flex items-start gap-1.5 text-[11px] leading-snug text-dim">
            <span className="mt-[1px] grid size-3 shrink-0 place-items-center rounded-[3px] border border-line text-[7px]">
              ▢
            </span>
            <span className="min-w-0 flex-1 break-words whitespace-normal">{sublabel}</span>
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          {index < 9 && (
            <span
              className={cn(
                'font-mono whitespace-nowrap text-[10px] text-dim transition-colors duration-100',
                selected && 'rounded-md bg-well px-1.5 py-0.5 text-mute',
              )}
            >
              Ctrl+{index + 1}
            </span>
          )}
          <span
            className={cn(
              'grid shrink-0 place-items-center text-cream transition-all duration-150 ease-out',
              selected ? 'scale-100 opacity-100' : 'scale-50 opacity-0',
            )}
          >
            <Check size={13} />
          </span>
        </span>
      </button>
      <button
        type="button"
        title={favorite ? 'Remove from favorites' : 'Add to favorites'}
        aria-label={`${favorite ? 'Remove' : 'Add'} ${label} ${favorite ? 'from' : 'to'} favorites`}
        aria-pressed={favorite}
        onClick={() => onFavorite(model.id)}
        className={cn(
          'relative z-[1] grid size-6 shrink-0 cursor-pointer place-items-center self-center rounded-md transition-all duration-150 ease-out active:scale-90',
          favorite
            ? 'scale-100 text-cream opacity-100'
            : 'scale-90 text-dim opacity-0 group-hover:scale-100 group-hover:opacity-100 hover:text-cream focus-visible:scale-100 focus-visible:opacity-100',
        )}
      >
        <Star size={13} className={cn('transition-transform duration-150', favorite && 'fill-current')} />
      </button>
    </div>
  )
})

export function ModelSelector({ models, modelId, onModel }: Props) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [rail, setRail] = useState<string>('all')
  const [favorites, setFavorites] = useState<string[]>(() => readFavorites())
  const [highlight, setHighlight] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const rowRefs = useRef(new Map<string, HTMLDivElement>())
  // Only entrance rows animate; filter/search updates render instantly.
  const [animateIn, setAnimateIn] = useState(true)
  // Keyboard nav scrolls; mouse hover never yanks scroll.
  const navMode = useRef<'mouse' | 'keyboard'>('mouse')
  const [popupPos, setPopupPos] = useState({ left: 0, bottom: 0 })

  const providers = useMemo(() => groupLLMProfiles(models), [models])
  const activeModel = models.find((model) => model.id === modelId) ?? models[0]
  const activeProvider = providers.find((provider) =>
    provider.models.some((model) => model.id === activeModel?.id),
  ) ?? providers[0]

  const favoriteSet = useMemo(() => new Set(favorites), [favorites])

  useEffect(() => {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
    } catch {
      // ignore quota / privacy errors
    }
  }, [favorites])

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      const target = event.target as Node
      if (root.current?.contains(target)) return
      if (popupRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [open ])

  // Portaled popup: the chat composer uses overflow-hidden, so an
  // absolutely-positioned list gets clipped. Anchor a fixed popup to
  // the trigger rect instead.
  useLayoutEffect(() => {
    if (!open) return
    const update = () => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const width = 420
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))
      const bottom = Math.max(8, window.innerHeight - rect.top + 8)
      setPopupPos({ left, bottom })
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [open])

  useEffect(() => {
    if (open) {
      setQuery('')
      setRail('all')
      setHighlight(0)
      setAnimateIn(true)
      navMode.current = 'mouse'
      window.requestAnimationFrame(() => searchInput.current?.focus())
    }
  }, [open])

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    let list = models
    if (rail === 'favorites') {
      list = list.filter((model) => favoriteSet.has(model.id))
    } else if (rail !== 'all') {
      const provider = providers.find((item) => item.id === rail)
      const ids = new Set((provider?.models ?? []).map((model) => model.id))
      list = list.filter((model) => ids.has(model.id))
    }
    if (needle) {
      list = list.filter((model) => {
        const provider = providers.find((item) => item.models.some((m) => m.id === model.id))
        const hay = `${model.model} ${model.label ?? ''} ${model.provider_label ?? ''} ${provider?.label ?? ''} ${model.base_url}`.toLowerCase()
        return hay.includes(needle)
      })
    }
    // Favorites first, then alphabetical — keeps Ctrl+1..9 stable and useful
    return [...list].sort((a, b) => {
      const favA = favoriteSet.has(a.id) ? 0 : 1
      const favB = favoriteSet.has(b.id) ? 0 : 1
      if (favA !== favB) return favA - favB
      return profileLabel(a).localeCompare(profileLabel(b))
    })
  }, [favoriteSet, models, providers, query, rail])

  // Filter/search changes render instantly; entrance stagger runs once per open.
  useEffect(() => {
    if (!open) return
    setHighlight(0)
    setAnimateIn(false)
    listRef.current?.scrollTo({ top: 0 })
  }, [query, rail, open])

  // Keyboard-highlighted row follows instantly — no smooth-scroll fighting.
  useEffect(() => {
    if (!open || navMode.current !== 'keyboard') return
    const target = visible[highlight]
    if (!target) return
    const node = rowRefs.current.get(target.id)
    const list = listRef.current
    if (!node || !list) return
    const nodeTop = node.offsetTop
    const nodeBottom = nodeTop + node.offsetHeight
    if (nodeTop < list.scrollTop) list.scrollTop = nodeTop - 6
    else if (nodeBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = nodeBottom - list.clientHeight + 6
    }
  }, [highlight, open, visible])

  // Ctrl/Cmd+1..9 quick-switch, like the reference picker
  useEffect(() => {
    if (!open) return
    const onShortcut = (event: KeyboardEvent) => {
      const isMod = event.ctrlKey || event.metaKey
      if (!isMod) return
      const digit = Number.parseInt(event.key, 10)
      if (!Number.isInteger(digit) || digit < 1 || digit > 9) return
      const target = visible[digit - 1]
      if (!target?.id?.trim()) return
      event.preventDefault()
      onModel(target.id)
      setOpen(false)
    }
    window.addEventListener('keydown', onShortcut)
    return () => window.removeEventListener('keydown', onShortcut)
  }, [open, visible, onModel])

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  function choose(id: string) {
    if (!id.trim()) return
    onModel(id)
    setOpen(false)
  }

  function highlightFromMouse(index: number) {
    navMode.current = 'mouse'
    setHighlight(index)
  }

  function stepHighlight(delta: 1 | -1) {
    navMode.current = 'keyboard'
    setHighlight((i) => Math.min(visible.length - 1, Math.max(0, i + delta)))
  }

  function onListKey(event: React.KeyboardEvent) {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      stepHighlight(1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      stepHighlight(-1)
    } else if (event.key === 'Enter') {
      const target = visible[highlight]
      if (target) {
        event.preventDefault()
        choose(target.id)
      }
    }
  }

  if (!activeModel) return null
  const activeLabel = profileLabel(activeModel)

  return (
    <div className="relative min-w-0 shrink-0" ref={root}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title={`Language model: ${activeLabel}`}
        className="flex h-7 w-auto min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-left transition-colors duration-150 hover:bg-wash active:scale-[0.97]"
      >
        <span className="grid size-[18px] shrink-0 place-items-center rounded-[5px] border border-line bg-lift text-[10px] font-semibold text-cream">
          {providerInitial(activeProvider?.label ?? activeModel.provider_label ?? activeLabel)}
        </span>
        {/* Full name — no ellipsis */}
        <span className="min-w-0 flex-1 text-[12px] font-medium whitespace-nowrap text-cream">
          {activeLabel}
        </span>
        <span
          className={cn(
            'grid shrink-0 place-items-center text-dim transition-transform duration-200 ease-out',
            open && 'rotate-180',
          )}
        >
          <ChevronDown size={13} />
        </span>
      </button>

      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={popupRef}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
              transition={
                reduce ? { duration: 0.1 } : { duration: 0.16, ease: [0.22, 1, 0.36, 1] }
              }
              style={{ left: popupPos.left, bottom: popupPos.bottom, transformOrigin: 'bottom left' }}
              className="fixed z-[90] flex w-[420px] max-w-[calc(100vw-16px)] transform-gpu overflow-hidden rounded-xl border border-line bg-panel shadow-[var(--toast-shadow)] will-change-transform"
              role="listbox"
              aria-label="Choose model"
              onKeyDown={onListKey}
            >
            {/* Left provider rail — star filters favorites, icons filter by provider */}
            <div className="flex w-11 shrink-0 flex-col items-center gap-1 border-r border-line py-2">
              <button
                type="button"
                title="Favorites"
                aria-label="Show favorites"
                aria-pressed={rail === 'favorites'}
                onClick={() => setRail((current) => (current === 'favorites' ? 'all' : 'favorites'))}
                className={cn(
                  'grid size-7 cursor-pointer place-items-center rounded-md transition-all duration-150 ease-out hover:scale-105 active:scale-95',
                  rail === 'favorites' ? 'bg-wash-strong text-cream' : 'text-dim hover:bg-wash hover:text-cream',
                )}
              >
                <Star size={14} className={rail === 'favorites' ? 'fill-current' : undefined} />
              </button>
              <span className="h-px w-5 bg-line" aria-hidden />
              {providers.map((provider) => {
                const selected = rail === provider.id
                return (
                  <button
                    key={provider.id}
                    type="button"
                    title={provider.label}
                    aria-label={`Filter by ${provider.label}`}
                    aria-pressed={selected}
                    onClick={() => setRail((current) => (current === provider.id ? 'all' : provider.id))}
                    className={cn(
                      'grid size-7 cursor-pointer place-items-center rounded-md border text-[11px] font-semibold transition-all duration-150 ease-out hover:scale-105 active:scale-95',
                      selected
                        ? 'border-line-strong bg-wash-strong text-cream'
                        : 'border-transparent text-dim hover:bg-wash hover:text-cream',
                    )}
                  >
                    {providerInitial(provider.label)}
                  </button>
                )
              })}
            </div>

            {/* Main column */}
            <div className="flex min-w-0 flex-1 flex-col">
              <label className="group flex h-10 shrink-0 items-center gap-2 border-b border-line px-3 transition-colors focus-within:border-line-strong">
                <Search size={14} className="shrink-0 text-dim transition-colors group-focus-within:text-mute" />
                <input
                  ref={searchInput}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search models…"
                  className="w-full bg-transparent text-[13px] text-cream outline-none placeholder:text-dim"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Clear search"
                    onClick={() => setQuery('')}
                    className="grid size-5 shrink-0 cursor-pointer place-items-center rounded-full bg-wash text-dim transition-all duration-150 hover:scale-105 hover:text-cream active:scale-95"
                  >
                    <X size={11} />
                  </button>
                )}
              </label>

              <div ref={listRef} className="max-h-[340px] min-h-[120px] overflow-y-auto p-1.5 scroll-thin">
                {visible.length === 0 && (
                  <div className="px-2 py-8 text-center text-[12px] text-dim">
                    {rail === 'favorites' && !query
                      ? 'No favorites yet. Hover a model and click the star.'
                      : 'No matching models.'}
                  </div>
                )}
                {visible.map((model, index) => {
                  const provider = providers.find((item) => item.models.some((m) => m.id === model.id))
                  const label = profileLabel(model)
                  return (
                    <ModelRow
                      key={model.id}
                      model={model}
                      label={label}
                      sublabel={modelSublabel(model, provider?.label ?? '')}
                      providerGlyph={providerInitial(provider?.label ?? model.provider_label ?? model.model)}
                      index={index}
                      selected={model.id === activeModel.id}
                      highlighted={index === highlight}
                      favorite={favoriteSet.has(model.id)}
                      animateIn={animateIn}
                      reduce={!!reduce}
                      onHighlight={highlightFromMouse}
                      onChoose={choose}
                      onFavorite={toggleFavorite}
                      registerRow={(id, node) => {
                        if (node) rowRefs.current.set(id, node)
                        else rowRefs.current.delete(id)
                      }}
                    />
                  )
                })}
              </div>
            </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </div>
  )
}
