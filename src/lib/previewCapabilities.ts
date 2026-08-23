export type PreviewCapabilities = {
  webCodecs: boolean
  webGpu: boolean
  worker: boolean
}

export function previewCapabilities(): PreviewCapabilities {
  if (typeof window === 'undefined') {
    return { webCodecs: false, webGpu: false, worker: false }
  }
  return {
    webCodecs: typeof VideoDecoder !== 'undefined' && typeof VideoFrame !== 'undefined',
    webGpu: 'gpu' in navigator,
    worker: typeof Worker !== 'undefined',
  }
}

export function canUseWebCodecsPreview() {
  if (import.meta.env.VITE_ACCELERATED_PREVIEW === '0') return false
  const capabilities = previewCapabilities()
  return capabilities.webCodecs && capabilities.worker
}
