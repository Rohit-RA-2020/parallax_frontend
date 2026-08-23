import { afterEach, describe, expect, it, vi } from 'vitest'
import { canUseWebCodecsPreview, previewCapabilities } from './previewCapabilities'

describe('accelerated preview capabilities', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('stays disabled during server rendering', () => {
    vi.stubGlobal('window', undefined)
    expect(previewCapabilities()).toEqual({ webCodecs: false, webGpu: false, worker: false })
  })

  it('detects the worker, WebCodecs, and WebGPU surfaces independently', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { gpu: {} })
    vi.stubGlobal('Worker', class FakeWorker {})
    vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {})
    vi.stubGlobal('VideoFrame', class FakeVideoFrame {})
    expect(previewCapabilities()).toEqual({ webCodecs: true, webGpu: true, worker: true })
    expect(canUseWebCodecsPreview()).toBe(true)
  })

  it('requires WebCodecs even when WebGPU is available', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', { gpu: {} })
    vi.stubGlobal('Worker', class FakeWorker {})
    vi.stubGlobal('VideoDecoder', undefined)
    vi.stubGlobal('VideoFrame', undefined)
    expect(canUseWebCodecsPreview()).toBe(false)
  })

  it('supports an environment kill switch for deployment rollback', () => {
    vi.stubGlobal('window', {})
    vi.stubGlobal('navigator', {})
    vi.stubGlobal('Worker', class FakeWorker {})
    vi.stubGlobal('VideoDecoder', class FakeVideoDecoder {})
    vi.stubGlobal('VideoFrame', class FakeVideoFrame {})
    vi.stubEnv('VITE_ACCELERATED_PREVIEW', '0')
    expect(canUseWebCodecsPreview()).toBe(false)
  })
})
