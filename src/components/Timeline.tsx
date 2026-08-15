import { useRef, useState, type DragEvent, type PointerEvent } from 'react'
import { Eye, Type, Volume2, X } from 'lucide-react'
import type { Clip, MediaAsset, Track } from '../types'
import { PROJECT_FPS, markers, tracks } from '../data/project'
import { formatClock } from '../lib/time'
import { waveform } from '../lib/wave'
import { cn } from '../lib/cn'
import { getDraggingAsset, parseAssetTransfer, trackAccepts } from '../lib/edit'

const LANE: Record<Track['kind'], number> = {
  video: 56,
  title: 36,
  audio: 42,
}
const HEADER = 72
const RULER = 28

type DropGhost = {
  track: string
  time: number
  duration: number
}

type Props = {
  clips: Clip[]
  selectedId: string | null
  currentTime: number
  duration: number
  pxPerSecond: number
  onSelect: (id: string | null) => void
  onSeek: (time: number) => void
  onZoom: (px: number) => void
  onTrim: (id: string, start: number, duration: number) => void
  onMove: (id: string, start: number, track: string) => void
  onRemove: (id: string) => void
  onDropAsset: (asset: MediaAsset, start: number, track: string) => void
}

export function Timeline({
  clips,
  selectedId,
  currentTime,
  duration,
  pxPerSecond,
  onSelect,
  onSeek,
  onZoom,
  onTrim,
  onMove,
  onRemove,
  onDropAsset,
}: Props) {
  const scroller = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [ghost, setGhost] = useState<DropGhost | null>(null)

  const contentW = Math.max(duration * pxPerSecond + 80, 640)
  const playX = HEADER + currentTime * pxPerSecond
  const ticks = buildTicks(duration, pxPerSecond)

  function timeFromClientX(clientX: number) {
    const el = scroller.current
    if (!el) return 0
    const x = clientX - el.getBoundingClientRect().left + el.scrollLeft - HEADER
    return Math.max(0, x / pxPerSecond)
  }

  function startScrub(e: PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('[data-clip]')) return
    dragging.current = true
    capturePointer(e)
    onSeek(timeFromClientX(e.clientX))
  }

  function moveScrub(e: PointerEvent<HTMLDivElement>) {
    if (!dragging.current || (e.buttons & 1) === 0) return
    onSeek(timeFromClientX(e.clientX))
  }

  function endScrub() {
    dragging.current = false
  }

  function onDragOverLane(e: DragEvent, track: Track) {
    const asset = peekAsset()
    if (!asset || !trackAccepts(track.id, asset.kind)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setGhost({
      track: track.id,
      time: timeFromClientX(e.clientX),
      duration: asset.duration,
    })
  }

  function onDropLane(e: DragEvent, track: Track) {
    e.preventDefault()
    setGhost(null)
    const asset = parseAssetTransfer(e.dataTransfer)
    if (!asset || !trackAccepts(track.id, asset.kind)) return
    onDropAsset(asset, timeFromClientX(e.clientX), track.id)
  }

  return (
    <div className="flex h-[248px] shrink-0 flex-col border-t border-line bg-panel">
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-line px-3">
        <span className="text-[10px] font-medium tracking-[0.16em] text-mute uppercase">Timeline</span>
        <div className="flex items-center gap-3">
          <span className="hidden text-[10px] text-dim sm:inline">
            Click or drag from the bin · Del removes
          </span>
          <label className="flex items-center gap-2 text-[10px] text-dim">
            Zoom
            <input
              type="range"
              min={18}
              max={72}
              value={pxPerSecond}
              onChange={(e) => onZoom(Number(e.target.value))}
              className="w-24 accent-cream"
            />
          </label>
        </div>
      </div>

      <div
        ref={scroller}
        className="relative min-h-0 flex-1 overflow-auto scroll-thin select-none"
        onPointerDown={startScrub}
        onPointerMove={moveScrub}
        onPointerUp={endScrub}
        onPointerCancel={endScrub}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node)) setGhost(null)
        }}
        onDrop={() => setGhost(null)}
      >
        <div className="relative" style={{ width: HEADER + contentW, minHeight: '100%' }}>
          <div
            className="sticky top-0 z-20 border-b border-line bg-panel"
            style={{ height: RULER }}
          >
            <div className="absolute inset-y-0 left-0 flex w-[72px] items-center px-3 text-[9px] tracking-wider text-dim uppercase">
              TC
            </div>
            {ticks.map((t) => (
              <div
                key={t.time}
                className="absolute top-0 bottom-0"
                style={{ left: HEADER + t.time * pxPerSecond }}
              >
                <div className={cn('w-px bg-white/10', t.major ? 'h-3' : 'h-1.5')} />
                {t.major && (
                  <div className="mt-0.5 font-mono text-[9px] text-dim">{formatClock(t.time)}</div>
                )}
              </div>
            ))}
            {markers
              .filter((m) => m.time <= duration)
              .map((m) => (
                <div
                  key={m.label}
                  className="absolute top-1 font-mono text-[8px] tracking-wider text-mark"
                  style={{ left: HEADER + m.time * pxPerSecond + 4 }}
                >
                  {m.label}
                </div>
              ))}
          </div>

          {tracks.map((track) => (
            <TrackLane
              key={track.id}
              track={track}
              clips={clips.filter((c) => c.track === track.id)}
              selectedId={selectedId}
              pxPerSecond={pxPerSecond}
              ghost={ghost?.track === track.id ? ghost : null}
              onSelect={onSelect}
              onTrim={onTrim}
              onMove={onMove}
              onRemove={onRemove}
              onDragOver={(e) => onDragOverLane(e, track)}
              onDrop={(e) => onDropLane(e, track)}
            />
          ))}

          <div
            className="pointer-events-none absolute top-0 bottom-0 z-30"
            style={{ left: playX }}
          >
            <div className="playhead-head absolute -top-0 -left-[5px] h-2 w-2.5 bg-mark" />
            <div className="h-full w-px bg-mark shadow-[0_0_8px_#ff4336]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function TrackLane({
  track,
  clips,
  selectedId,
  pxPerSecond,
  ghost,
  onSelect,
  onTrim,
  onMove,
  onRemove,
  onDragOver,
  onDrop,
}: {
  track: Track
  clips: Clip[]
  selectedId: string | null
  pxPerSecond: number
  ghost: DropGhost | null
  onSelect: (id: string) => void
  onTrim: (id: string, start: number, duration: number) => void
  onMove: (id: string, start: number, track: string) => void
  onRemove: (id: string) => void
  onDragOver: (e: DragEvent) => void
  onDrop: (e: DragEvent) => void
}) {
  return (
    <div
      data-lane={track.id}
      className="relative border-b border-line"
      style={{ height: LANE[track.kind] }}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="sticky left-0 z-10 flex h-full w-[72px] items-center gap-1.5 border-r border-line bg-panel px-2">
        <span className="w-6 font-mono text-[10px] text-mute">{track.label}</span>
        <span className="text-dim">
          {track.kind === 'audio' ? (
            <Volume2 size={10} />
          ) : track.kind === 'title' ? (
            <Type size={10} />
          ) : (
            <Eye size={10} />
          )}
        </span>
      </div>

      {ghost && (
        <div
          className="pointer-events-none absolute top-1.5 bottom-1.5 rounded-[4px] border border-dashed border-cream/40 bg-cream/10"
          style={{
            left: HEADER + ghost.time * pxPerSecond,
            width: Math.max(ghost.duration * pxPerSecond, 8),
          }}
        />
      )}

      {clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          selected={selectedId === clip.id}
          pxPerSecond={pxPerSecond}
          onSelect={onSelect}
          onTrim={onTrim}
          onMove={onMove}
          onRemove={onRemove}
        />
      ))}
    </div>
  )
}

function ClipBlock({
  clip,
  selected,
  pxPerSecond,
  onSelect,
  onTrim,
  onMove,
  onRemove,
}: {
  clip: Clip
  selected: boolean
  pxPerSecond: number
  onSelect: (id: string) => void
  onTrim: (id: string, start: number, duration: number) => void
  onMove: (id: string, start: number, track: string) => void
  onRemove: (id: string) => void
}) {
  const bars = waveform(clip.waveSeed ?? 1, Math.max(12, Math.floor(clip.duration * 6)))
  const session = useRef<{
    kind: 'move' | 'in' | 'out'
    pointerId: number
    x: number
    start: number
    duration: number
    armed: boolean
  } | null>(null)

  function begin(kind: 'move' | 'in' | 'out', e: PointerEvent<Element>) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    onSelect(clip.id)
    session.current = {
      kind,
      pointerId: e.pointerId,
      x: e.clientX,
      start: clip.start,
      duration: clip.duration,
      armed: kind !== 'move',
    }
    capturePointer(e)
    ;(e.currentTarget as HTMLElement).focus?.()
  }

  function drag(e: PointerEvent<Element>) {
    const s = session.current
    if (!s || s.pointerId !== e.pointerId) return
    if ((e.buttons & 1) === 0) return

    const dt = (e.clientX - s.x) / pxPerSecond
    if (s.kind === 'move') {
      if (!s.armed) {
        if (Math.abs(e.clientX - s.x) < 6) return
        s.armed = true
      }
      onMove(clip.id, Math.max(0, s.start + dt), clip.track)
      return
    }
    if (s.kind === 'in') {
      const start = Math.min(
        s.start + s.duration - 1 / PROJECT_FPS,
        Math.max(0, s.start + dt),
      )
      onTrim(clip.id, start, s.duration - (start - s.start))
      return
    }
    onTrim(clip.id, s.start, Math.max(1 / PROJECT_FPS, s.duration + dt))
  }

  function end(e: PointerEvent<Element>) {
    if (!session.current || session.current.pointerId !== e.pointerId) return
    session.current = null
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      data-clip
      onPointerDown={(e) => begin('move', e)}
      onPointerMove={drag}
      onPointerUp={end}
      onPointerCancel={end}
      onKeyDown={(e) => {
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          e.stopPropagation()
          onRemove(clip.id)
        }
      }}
      className={cn(
        'absolute top-1.5 bottom-1.5 overflow-hidden rounded-[4px] text-left',
        selected ? 'z-10 cursor-grab ring-1 ring-cream active:cursor-grabbing' : 'ring-1 ring-white/10',
      )}
      style={{
        left: HEADER + clip.start * pxPerSecond,
        width: Math.max(clip.duration * pxPerSecond, 8),
        background: clip.thumb
          ? `linear-gradient(180deg, rgb(0 0 0 / 0.15), rgb(0 0 0 / 0.45)), url(${clip.thumb}) center/cover`
          : clip.kind === 'audio'
            ? 'linear-gradient(180deg, #16352c, #10241f)'
            : 'linear-gradient(180deg, #2a2418, #1b1710)',
      }}
    >
      {clip.kind === 'audio' && (
        <div className="absolute inset-x-1 inset-y-1 flex items-end gap-px">
          {bars.map((h, i) => (
            <span
              key={i}
              className="min-w-px flex-1 rounded-sm bg-audio/80"
              style={{ height: `${h * 100}%` }}
            />
          ))}
        </div>
      )}
      <span className="relative z-10 truncate pr-5 pl-1.5 pt-0.5 text-[10px] font-medium text-cream drop-shadow">
        {clip.name}
      </span>
      {selected && (
        <>
          <button
            type="button"
            data-clip
            aria-label={`Remove ${clip.name}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              onRemove(clip.id)
            }}
            className="absolute top-0.5 right-0.5 z-20 grid size-4 place-items-center rounded-sm bg-black/55 text-cream/80 hover:bg-mark hover:text-cream"
          >
            <X size={9} />
          </button>
          <span
            data-clip
            onPointerDown={(e) => begin('in', e)}
            onPointerMove={drag}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute inset-y-0 left-0 z-20 w-1.5 cursor-ew-resize bg-cream/80"
          />
          <span
            data-clip
            onPointerDown={(e) => begin('out', e)}
            onPointerMove={drag}
            onPointerUp={end}
            onPointerCancel={end}
            className="absolute inset-y-0 right-0 z-20 w-1.5 cursor-ew-resize bg-cream/80"
          />
        </>
      )}
    </div>
  )
}

function capturePointer(e: PointerEvent<Element>) {
  try {
    e.currentTarget.setPointerCapture(e.pointerId)
  } catch {
    // synthetic or already-released pointers
  }
}

function peekAsset() {
  return getDraggingAsset()
}

function buildTicks(duration: number, pxPerSecond: number) {
  const step = pxPerSecond >= 48 ? 1 : pxPerSecond >= 28 ? 2 : 5
  const ticks: { time: number; major: boolean }[] = []
  const last = Math.ceil(duration)
  for (let t = 0; t <= last; t += 1) {
    ticks.push({ time: t, major: t % step === 0 })
  }
  return ticks
}
