import { motion } from 'framer-motion'
import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react'
import type { PreviewVideoProps } from './PreviewStage'
import { createVideoFrameRenderer, type VideoFrameRenderer } from '../lib/videoFrameRenderer'
import { fadeSlow } from '../lib/motion'

type DecoderEvent =
  | { type: 'ready'; generation: number; width: number; height: number }
  | { type: 'frame'; generation: number; requestId: number; width: number; height: number; frame: VideoFrame }
  | { type: 'error'; generation: number; message: string }

export function WebCodecsVideo({ fallback, ...props }: PreviewVideoProps & { fallback: ReactElement<PreviewVideoProps> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const workerRef = useRef<Worker | null>(null)
  const rendererRef = useRef<VideoFrameRenderer | null>(null)
  const generationRef = useRef(0)
  const requestRef = useRef(0)
  const latestPresentedRef = useRef(0)
  const presentingRef = useRef(false)
  const pendingFrameRef = useRef<{ frame: VideoFrame; requestId: number } | null>(null)
  const seekTimerRef = useRef<number | null>(null)
  const lastSeekAtRef = useRef(0)
  const latestTimeRef = useRef(props.currentTime)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  const onFrameRef = useRef(props.onFrame)
  onFrameRef.current = props.onFrame
  latestTimeRef.current = props.currentTime

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const generation = ++generationRef.current
    setState('loading')
    let disposed = false
    let worker: Worker | null = null

    void createVideoFrameRenderer(canvas).then((renderer) => {
      if (disposed) {
        renderer.dispose()
        return
      }
      rendererRef.current = renderer
      const activeWorker = new Worker(new URL('../workers/videoDecoder.worker.ts', import.meta.url), { type: 'module' })
      worker = activeWorker
      workerRef.current = activeWorker
      activeWorker.onmessage = (event: MessageEvent<DecoderEvent>) => {
        const message = event.data
        if (message.generation !== generationRef.current) {
          if (message.type === 'frame') message.frame.close()
          return
        }
        if (message.type === 'error') {
          setState('failed')
          return
        }
        if (message.type === 'ready') {
          onFrameRef.current?.(message.width, message.height)
          setState('ready')
          requestFrame(activeWorker, generation, latestTimeRef.current, props.start, props.sourceIn, props.rate, requestRef)
          return
        }
        onFrameRef.current?.(message.width, message.height)
        queueFrame(message.frame, message.requestId)
      }
      activeWorker.onerror = () => setState('failed')
      activeWorker.postMessage({ type: 'init', src: props.src, generation })
    }).catch(() => setState('failed'))

    return () => {
      disposed = true
      if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
      seekTimerRef.current = null
      pendingFrameRef.current?.frame.close()
      pendingFrameRef.current = null
      worker?.postMessage({ type: 'dispose', generation })
      worker?.terminate()
      if (workerRef.current === worker) workerRef.current = null
      rendererRef.current?.dispose()
      rendererRef.current = null
    }
  }, [props.src, props.start, props.sourceIn, props.rate])

  useEffect(() => {
    const worker = workerRef.current
    // Random-access decoding is excellent for a paused playhead, but repeatedly
    // seeking for every playback frame is much slower than the browser's
    // sequential video pipeline on long-GOP media. Native video owns playback;
    // WebCodecs only supplies the exact frame while paused/scrubbing.
    if (!worker || state !== 'ready' || props.isPlaying) return
    const interval = 0
    const elapsed = performance.now() - lastSeekAtRef.current
    const send = () => {
      seekTimerRef.current = null
      lastSeekAtRef.current = performance.now()
      requestFrame(worker, generationRef.current, latestTimeRef.current, props.start, props.sourceIn, props.rate, requestRef)
    }
    if (elapsed >= interval) send()
    else {
      if (seekTimerRef.current !== null) window.clearTimeout(seekTimerRef.current)
      seekTimerRef.current = window.setTimeout(send, interval - elapsed)
    }
  }, [props.currentTime, props.isPlaying, props.start, props.sourceIn, props.rate, state])

  function queueFrame(frame: VideoFrame, requestId: number) {
    if (requestId < latestPresentedRef.current) {
      frame.close()
      return
    }
    pendingFrameRef.current?.frame.close()
    pendingFrameRef.current = { frame, requestId }
    if (!presentingRef.current) void presentNext()
  }

  async function presentNext() {
    const renderer = rendererRef.current
    const pending = pendingFrameRef.current
    if (!renderer || !pending) return
    pendingFrameRef.current = null
    presentingRef.current = true
    try {
      await renderer.present(pending.frame)
      latestPresentedRef.current = pending.requestId
    } catch {
      pending.frame.close()
      setState('failed')
    } finally {
      presentingRef.current = false
      if (pendingFrameRef.current) void presentNext()
    }
  }

  if (state === 'failed') return cloneElement(fallback, { active: true })

  return (
    <>
      {cloneElement(fallback, { active: props.isPlaying })}
      <motion.div
        initial={props.reduce ? false : { opacity: 0 }}
        animate={{ opacity: props.isPlaying ? 0 : 1, scale: 1.006 }}
        exit={props.reduce ? undefined : { opacity: 0 }}
        transition={{ opacity: { duration: 0.08 }, scale: { duration: 1.4, ease: 'linear' } }}
        className="preview-plate absolute inset-0"
        style={{ ...props.visualStyle, pointerEvents: props.isPlaying ? 'none' : undefined }}
        aria-hidden={props.isPlaying}
      >
        {props.poster && (
          <img src={props.poster} alt="" className="absolute inset-0 size-full object-contain" style={{ filter: props.filter }} />
        )}
        <canvas
          ref={canvasRef}
          className="relative size-full object-contain"
          style={{ filter: props.filter, opacity: state === 'ready' ? 1 : 0 }}
        />
        {state === 'loading' && !props.isPlaying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...fadeSlow, delay: .15 }}
            className="pointer-events-none absolute bottom-2 right-2 rounded bg-black/55 px-2 py-1 font-mono text-[9px] text-mute"
          >
            Preparing accelerated preview
          </motion.div>
        )}
      </motion.div>
    </>
  )
}

function requestFrame(
  worker: Worker,
  generation: number,
  timelineTime: number,
  start: number,
  sourceIn: number,
  rate: number,
  requestRef: { current: number },
) {
  const time = sourceIn + Math.max(0, timelineTime - start) * rate
  worker.postMessage({ type: 'seek', time, generation, requestId: ++requestRef.current })
}
