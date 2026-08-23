import { Input, MP4, QTFF, UrlSource, VideoSampleSink, WEBM } from 'mediabunny'

type InitRequest = { type: 'init'; src: string; generation: number }
type SeekRequest = { type: 'seek'; time: number; requestId: number; generation: number }
type DisposeRequest = { type: 'dispose'; generation: number }
type DecoderRequest = InitRequest | SeekRequest | DisposeRequest

type WorkerPort = {
  postMessage(message: unknown, transfer?: Transferable[]): void
}

const port = globalThis as unknown as WorkerPort
let input: Input<UrlSource> | null = null
let sink: VideoSampleSink | null = null
let generation = 0
let latestSeek: SeekRequest | null = null
let seeking = false

globalThis.addEventListener('message', (event: MessageEvent<DecoderRequest>) => {
  const message = event.data
  if (message.type === 'init') {
    void initialize(message)
    return
  }
  if (message.type === 'dispose') {
    if (message.generation >= generation) dispose()
    return
  }
  if (message.generation !== generation || !sink) return
  latestSeek = message
  void drainSeeks()
})

async function initialize(message: InitRequest) {
  dispose()
  generation = message.generation
  try {
    if (typeof VideoDecoder === 'undefined') throw new Error('WebCodecs is unavailable')
    const nextInput = new Input({
      source: new UrlSource(message.src, { maxCacheSize: 24 << 20, parallelism: 2 }),
      formats: [MP4, QTFF, WEBM],
    })
    input = nextInput
    const track = await nextInput.getPrimaryVideoTrack()
    if (generation !== message.generation || input !== nextInput) {
      nextInput.dispose()
      return
    }
    if (!track || !(await track.canDecode())) throw new Error('The browser cannot decode this preview codec')
    sink = new VideoSampleSink(track, {
      hardwareAcceleration: 'prefer-hardware',
      optimizeForLatency: true,
    })
    const [width, height] = await Promise.all([track.getDisplayWidth(), track.getDisplayHeight()])
    port.postMessage({ type: 'ready', generation, width, height })
  } catch (error) {
    if (generation === message.generation) {
      port.postMessage({ type: 'error', generation, message: errorMessage(error) })
      disposeInput()
    }
  }
}

async function drainSeeks() {
  if (seeking || !sink) return
  seeking = true
  try {
    while (latestSeek && sink) {
      const request = latestSeek
      latestSeek = null
      const activeSink: VideoSampleSink = sink
      const sample = await activeSink.getSample(Math.max(0, request.time))
      if (!sample) continue
      if (request.generation !== generation || activeSink !== sink || latestSeek) {
        sample.close()
        continue
      }
      const frame = sample.toVideoFrame()
      sample.close()
      port.postMessage({
        type: 'frame',
        generation,
        requestId: request.requestId,
        width: frame.displayWidth,
        height: frame.displayHeight,
        frame,
      }, [frame])
    }
  } catch (error) {
    port.postMessage({ type: 'error', generation, message: errorMessage(error) })
  } finally {
    seeking = false
    if (latestSeek) void drainSeeks()
  }
}

function disposeInput() {
  sink = null
  input?.dispose()
  input = null
}

function dispose() {
  latestSeek = null
  disposeInput()
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}
