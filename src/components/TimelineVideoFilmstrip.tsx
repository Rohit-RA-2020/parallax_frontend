import { memo, useEffect, useMemo, useRef } from 'react'
import type { Clip } from '../types'
import { visibleTimelineThumbnailTiles } from '../lib/timelineThumbnails'

const cache = new Map<string, ImageBitmap>()
const CACHE_LIMIT = 192

export const TimelineVideoFilmstrip = memo(function TimelineVideoFilmstrip({
  clip,
  pxPerSecond,
  visibleStart,
  visibleEnd,
  isPlaying,
}: {
  clip: Clip
  pxPerSecond: number
  visibleStart: number
  visibleEnd: number
  isPlaying: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRefs = useRef(new Map<number, HTMLCanvasElement>())
  const runRef = useRef(0)
  const tiles = useMemo(() => visibleTimelineThumbnailTiles({
    clipStart: clip.start,
    clipDuration: clip.duration,
    sourceIn: clip.sourceIn,
    sourceDuration: clip.sourceDuration,
    rate: clip.playback?.rate,
    pxPerSecond,
    visibleStart,
    visibleEnd,
  }), [clip.start, clip.duration, clip.sourceIn, clip.sourceDuration, clip.playback?.rate, pxPerSecond, visibleStart, visibleEnd])

  useEffect(() => {
    const video = videoRef.current
    const run = ++runRef.current
    let disposed = false
    if (!video || isPlaying || tiles.length === 0) return
    void fillTiles(video, clip.src ?? '', tiles, canvasRefs.current, () => disposed || runRef.current !== run)
    return () => { disposed = true }
  }, [clip.src, isPlaying, tiles])

  if (!clip.src || tiles.length === 0) return null
  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
      {tiles.map((tile) => (
        <canvas
          key={tile.index}
          ref={(canvas) => {
            if (canvas) {
              canvasRefs.current.set(tile.index, canvas)
              const bitmap = cacheGet(cacheKey(clip.src ?? '', tile.sourceTime))
              if (bitmap) drawCover(canvas, bitmap)
            } else {
              canvasRefs.current.delete(tile.index)
            }
          }}
          width={192}
          height={88}
          className="absolute inset-y-0 h-full object-cover"
          style={{ left: tile.left, width: tile.width }}
        />
      ))}
      <span className="absolute inset-0 bg-linear-to-t from-black/55 to-black/10" />
      <video
        ref={videoRef}
        src={clip.src}
        crossOrigin="anonymous"
        muted
        playsInline
        preload="metadata"
        className="absolute size-px opacity-0"
      />
    </div>
  )
})

async function fillTiles(
  video: HTMLVideoElement,
  src: string,
  tiles: ReturnType<typeof visibleTimelineThumbnailTiles>,
  canvases: Map<number, HTMLCanvasElement>,
  cancelled: () => boolean,
) {
  try {
    await mediaReady(video)
    for (const tile of tiles) {
      if (cancelled()) return
      const key = cacheKey(src, tile.sourceTime)
      let bitmap = cacheGet(key)
      if (!bitmap) {
        await seek(video, tile.sourceTime)
        if (cancelled()) return
        bitmap = await createImageBitmap(video)
        cacheSet(key, bitmap)
      }
      const canvas = canvases.get(tile.index)
      if (canvas) drawCover(canvas, bitmap)
    }
  } catch {
    // The cached backend overview remains visible when a browser cannot safely
    // draw this source into a canvas.
  }
}

function mediaReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_METADATA) return Promise.resolve()
  return eventPromise(video, 'loadedmetadata')
}

async function seek(video: HTMLVideoElement, time: number) {
  const duration = Number.isFinite(video.duration) ? video.duration : 0
  const target = duration > 0 ? Math.min(time, Math.max(0, duration - 0.001)) : Math.max(0, time)
  if (Math.abs(video.currentTime - target) < 1 / 60 && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return
  const ready = eventPromise(video, 'seeked')
  video.currentTime = target
  await ready
}

function eventPromise(media: HTMLMediaElement, name: 'loadedmetadata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => { cleanup(); resolve() }
    const failed = () => { cleanup(); reject(new Error('timeline thumbnail media error')) }
    const cleanup = () => {
      media.removeEventListener(name, done)
      media.removeEventListener('error', failed)
    }
    media.addEventListener(name, done, { once: true })
    media.addEventListener('error', failed, { once: true })
  })
}

function cacheKey(src: string, time: number) {
  return `${src}\n${time.toFixed(3)}`
}

function cacheGet(key: string) {
  const bitmap = cache.get(key)
  if (!bitmap) return undefined
  cache.delete(key)
  cache.set(key, bitmap)
  return bitmap
}

function cacheSet(key: string, bitmap: ImageBitmap) {
  const previous = cache.get(key)
  previous?.close()
  cache.delete(key)
  cache.set(key, bitmap)
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.entries().next().value as [string, ImageBitmap] | undefined
    if (!oldest) break
    oldest[1].close()
    cache.delete(oldest[0])
  }
}

function drawCover(canvas: HTMLCanvasElement, bitmap: ImageBitmap) {
  const context = canvas.getContext('2d')
  if (!context || bitmap.width < 1 || bitmap.height < 1) return
  const sourceRatio = bitmap.width / bitmap.height
  const targetRatio = canvas.width / canvas.height
  let sx = 0
  let sy = 0
  let sw = bitmap.width
  let sh = bitmap.height
  if (sourceRatio > targetRatio) {
    sw = bitmap.height * targetRatio
    sx = (bitmap.width - sw) / 2
  } else {
    sh = bitmap.width / targetRatio
    sy = (bitmap.height - sh) / 2
  }
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
}
