import {
  Maximize2,
  Pause,
  Play,
  Scan,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from 'lucide-react'
import { useEffect, useRef, type PointerEvent } from 'react'
import { AnimatePresence, motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'framer-motion'
import type { Clip, Grade } from '../types'
import { PROJECT_FPS } from '../data/project'
import { formatRange, formatTimecode } from '../lib/time'
import { fadeSlow, softSpring } from '../lib/motion'
import { Atmosphere } from './Atmosphere'
import { IconButton } from './ui'
import { cn } from '../lib/cn'

type Props = {
  currentTime: number
  isPlaying: boolean
  muted: boolean
  safeArea: boolean
  clip: Clip | undefined
  titleClip: Clip | undefined
  grade: Grade
  duration: number
  onTogglePlay: () => void
  onSeek: (time: number) => void
  onToggleMute: () => void
  onToggleSafe: () => void
}

export function PreviewStage({
  currentTime,
  isPlaying,
  muted,
  safeArea,
  clip,
  titleClip,
  grade,
  duration,
  onTogglePlay,
  onSeek,
  onToggleMute,
  onToggleSafe,
}: Props) {
  const reduce = useReducedMotion()
  const filter = [
    `contrast(${1 + grade.contrast * 0.18})`,
    `saturate(${1 + grade.saturation * 0.2})`,
    `sepia(${Math.max(0, grade.warmth) * 0.22})`,
    `hue-rotate(${grade.warmth * -8}deg)`,
  ].join(' ')

  const progress = duration > 0 ? currentTime / duration : 0
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const spring = { stiffness: 70, damping: 22, mass: 0.8 }
  const rotateX = useSpring(useTransform(py, [-0.5, 0.5], [1.2, -1.2]), spring)
  const rotateY = useSpring(useTransform(px, [-0.5, 0.5], [-1.6, 1.6]), spring)
  const shiftX = useSpring(useTransform(px, [-0.5, 0.5], [-5, 5]), spring)
  const shiftY = useSpring(useTransform(py, [-0.5, 0.5], [-3, 3]), spring)

  function onWellMove(e: PointerEvent<HTMLDivElement>) {
    if (reduce) return
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }

  function onWellLeave() {
    px.set(0)
    py.set(0)
  }

  return (
    <section className="chrome flex min-h-0 min-w-0 flex-1 flex-col bg-void">
      <div className="flex h-10 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2 text-[11px] text-mute">
          <span className="text-cream">{clip?.name ?? 'Gap'}</span>
          <span className="text-dim">·</span>
          <span className="font-mono text-dim">Program</span>
        </div>
        <div className="flex items-center gap-0.5">
          <IconButton label="Safe area" active={safeArea} onClick={onToggleSafe}>
            <Scan size={14} />
          </IconButton>
          <IconButton label="Expand preview">
            <Maximize2 size={14} />
          </IconButton>
        </div>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center px-6 pb-2"
        onPointerMove={onWellMove}
        onPointerLeave={onWellLeave}
        style={{ perspective: 900 }}
      >
        <Atmosphere playing={isPlaying} />
        <motion.div
          className="relative z-10 aspect-video h-full max-h-full w-auto max-w-full overflow-hidden rounded-sm bg-black shadow-[0_0_0_1px_var(--preview-ring),0_30px_80px_var(--preview-glow)]"
          style={
            reduce
              ? undefined
              : {
                  rotateX,
                  rotateY,
                  x: shiftX,
                  y: shiftY,
                  transformPerspective: 900,
                }
          }
        >
          <AnimatePresence initial={false} mode="wait">
            {clip?.mediaType === 'video' && clip.src ? (
              <PreviewVideo
                key={clip.src}
                src={clip.src}
                start={clip.start}
                currentTime={currentTime}
                isPlaying={isPlaying}
                muted={muted}
                filter={filter}
                reduce={!!reduce}
              />
            ) : clip?.thumb ? (
              <motion.img
                key={clip.id}
                src={clip.thumb}
                alt=""
                initial={reduce ? false : { opacity: 0, scale: 1.025 }}
                animate={{ opacity: 1, scale: isPlaying ? 1.035 : 1.012 }}
                exit={reduce ? undefined : { opacity: 0 }}
                transition={{
                  opacity: fadeSlow,
                  scale: { duration: isPlaying ? 10 : 1.4, ease: 'linear' },
                }}
                className="preview-plate absolute inset-0 size-full object-cover"
                style={{ filter, transformOrigin: '60% 40%' }}
              />
            ) : (
              <div className="grid size-full place-items-center text-[12px] text-dim">No clip</div>
            )}
          </AnimatePresence>

          <div className="grain pointer-events-none absolute inset-0" />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/35 via-transparent to-black/10" />

          {safeArea && (
            <div className="pointer-events-none absolute inset-[8%] border border-white/25" />
          )}

          <AnimatePresence>
            {titleClip && (
              <motion.div
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? undefined : { opacity: 0, y: 4 }}
                transition={fadeSlow}
                className="pointer-events-none absolute inset-x-8 bottom-8"
              >
                <div className="text-[10px] tracking-[0.42em] text-plate/70 uppercase">A film</div>
                <div className="mt-1 font-medium tracking-[0.28em] text-plate uppercase">
                  {titleClip.name}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2">
            <motion.span
              className={cn(
                'size-1.5 rounded-full',
                isPlaying ? 'bg-mark shadow-[0_0_8px_#ff4336]' : 'bg-white/40',
              )}
              animate={
                isPlaying && !reduce
                  ? { scale: [1, 1.28, 1], opacity: [1, 0.7, 1] }
                  : { scale: 1, opacity: 1 }
              }
              transition={isPlaying ? { duration: 1.5, repeat: Infinity } : { duration: 0.2 }}
            />
            <span className="font-mono text-[10px] tracking-wider text-white/80">
              {formatTimecode(currentTime, PROJECT_FPS)}
            </span>
          </div>
        </motion.div>
      </div>

      <div className="flex h-14 shrink-0 items-center gap-3 px-4">
        <div className="flex items-center gap-0.5">
          <IconButton label="Back 2s" onClick={() => onSeek(currentTime - 2)}>
            <SkipBack size={15} />
          </IconButton>
          <motion.button
            type="button"
            onClick={onTogglePlay}
            aria-label={isPlaying ? 'Pause' : 'Play'}
            whileHover={reduce ? undefined : { scale: 1.05 }}
            whileTap={reduce ? undefined : { scale: 0.9 }}
            transition={softSpring}
            className="grid size-9 place-items-center rounded-full bg-cream text-ink"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={isPlaying ? 'pause' : 'play'}
                initial={reduce ? false : { opacity: 0, scale: 0.65 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={reduce ? undefined : { opacity: 0, scale: 0.65 }}
                transition={{ duration: 0.14 }}
                className="grid place-items-center"
              >
                {isPlaying ? (
                  <Pause size={15} fill="currentColor" />
                ) : (
                  <Play size={15} fill="currentColor" className="ml-0.5" />
                )}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <IconButton label="Forward 2s" onClick={() => onSeek(currentTime + 2)}>
            <SkipForward size={15} />
          </IconButton>
        </div>

        <div className="min-w-[7.5rem] font-mono text-[12px] text-cream">
          {formatTimecode(currentTime, PROJECT_FPS)}
          <span className="text-dim"> / {formatTimecode(duration, PROJECT_FPS)}</span>
        </div>

        <div className="relative h-1 min-w-0 flex-1 rounded-full bg-wash-strong">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-cream/80"
            style={{ width: `${progress * 100}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration}
            step={1 / PROJECT_FPS}
            value={currentTime}
            onChange={(e) => onSeek(Number(e.target.value))}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label="Scrub program"
          />
        </div>

        <IconButton label={muted ? 'Unmute' : 'Mute'} onClick={onToggleMute}>
          {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}
        </IconButton>
      </div>

      <ClipInspector clip={clip} />
    </section>
  )
}

function PreviewVideo({
  src,
  start,
  currentTime,
  isPlaying,
  muted,
  filter,
  reduce,
}: {
  src: string
  start: number
  currentTime: number
  isPlaying: boolean
  muted: boolean
  filter: string
  reduce: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const currentTimeRef = useRef(currentTime)
  const isPlayingRef = useRef(isPlaying)
  currentTimeRef.current = currentTime
  isPlayingRef.current = isPlaying

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false

    const seekToClock = () => {
      if (cancelled || video.readyState < HTMLMediaElement.HAVE_METADATA) return
      const localTime = Math.max(0, currentTimeRef.current - start)
      const duration = Number.isFinite(video.duration) ? video.duration : 0
      const next = duration > 0 ? Math.min(localTime, Math.max(0, duration - 0.001)) : localTime
      if (Math.abs(video.currentTime - next) > 0.04) {
        video.currentTime = next
      }
    }

    const onReady = () => {
      if (cancelled) return
      seekToClock()
      if (isPlayingRef.current) {
        void video.play().catch(() => undefined)
      } else {
        video.pause()
      }
    }

    const onCanPlay = () => {
      if (cancelled || !isPlayingRef.current || !video.paused) return
      void video.play().catch(() => undefined)
    }

    video.addEventListener('loadedmetadata', onReady)
    video.addEventListener('canplay', onCanPlay)
    video.load()

    return () => {
      cancelled = true
      video.removeEventListener('loadedmetadata', onReady)
      video.removeEventListener('canplay', onCanPlay)
      video.pause()
    }
  }, [src, start])

  useEffect(() => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return
    const localTime = Math.max(0, currentTime - start)
    if (!isPlaying || Math.abs(video.currentTime - localTime) > 0.5) {
      video.currentTime = Math.min(localTime, Number.isFinite(video.duration) ? video.duration : localTime)
    }
  }, [currentTime, isPlaying, start])

  useEffect(() => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return
    if (isPlaying) void video.play().catch(() => undefined)
    else video.pause()
  }, [isPlaying])

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, scale: 1.025 }}
      animate={{ opacity: 1, scale: isPlaying ? 1.018 : 1.006 }}
      exit={reduce ? undefined : { opacity: 0 }}
      transition={{ opacity: fadeSlow, scale: { duration: 1.4, ease: 'linear' } }}
      className="preview-plate absolute inset-0"
    >
      <video
        ref={videoRef}
        src={src}
        muted={muted}
        playsInline
        preload="auto"
        className="size-full object-cover"
        style={{ filter }}
      />
    </motion.div>
  )
}

function ClipInspector({ clip }: { clip: Clip | undefined }) {
  return (
    <div className="chrome flex h-9 shrink-0 items-center gap-5 border-t border-line px-4 text-[11px]">
      <span className="w-28 truncate text-mute">{clip?.name ?? 'No selection under playhead'}</span>
      {clip && (
        <>
          <span className="font-mono text-dim">{formatRange(clip.start, clip.duration)}</span>
          <span className="text-dim">
            In <span className="font-mono text-mute">{formatTimecode(clip.start)}</span>
          </span>
          <span className="text-dim">
            Dur <span className="font-mono text-mute">{formatTimecode(clip.duration)}</span>
          </span>
        </>
      )}
    </div>
  )
}
