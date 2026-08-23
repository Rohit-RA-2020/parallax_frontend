export type VideoFrameRenderer = {
  kind: 'webgpu' | 'bitmap'
  present(frame: VideoFrame): Promise<void>
  dispose(): void
}

export async function createVideoFrameRenderer(canvas: HTMLCanvasElement): Promise<VideoFrameRenderer> {
  if ('gpu' in navigator) {
    try {
      return await WebGpuVideoFrameRenderer.create(canvas)
    } catch {
      // A GPU adapter can be advertised but unavailable (driver policy, remote
      // desktop, or device loss). Bitmap rendering remains broadly supported.
    }
  }
  return new BitmapVideoFrameRenderer(canvas)
}

class BitmapVideoFrameRenderer implements VideoFrameRenderer {
  readonly kind = 'bitmap' as const
  private readonly bitmap: ImageBitmapRenderingContext | null
  private readonly context: CanvasRenderingContext2D | null
  private readonly canvas: HTMLCanvasElement

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.bitmap = canvas.getContext('bitmaprenderer')
    this.context = this.bitmap ? null : canvas.getContext('2d')
  }

  async present(frame: VideoFrame) {
    resizeCanvas(this.canvas, frame.displayWidth, frame.displayHeight)
    try {
      if (this.bitmap) {
        const image = await createImageBitmap(frame)
        this.bitmap.transferFromImageBitmap(image)
      } else {
        this.context?.drawImage(frame, 0, 0, this.canvas.width, this.canvas.height)
      }
    } finally {
      frame.close()
    }
  }

  dispose() {}
}

class WebGpuVideoFrameRenderer implements VideoFrameRenderer {
  readonly kind = 'webgpu' as const
  private readonly canvas: HTMLCanvasElement
  private readonly device: GPUDevice
  private readonly context: GPUCanvasContext
  private readonly pipeline: GPURenderPipeline
  private readonly sampler: GPUSampler

  private constructor(
    canvas: HTMLCanvasElement,
    device: GPUDevice,
    context: GPUCanvasContext,
    pipeline: GPURenderPipeline,
    sampler: GPUSampler,
  ) {
    this.canvas = canvas
    this.device = device
    this.context = context
    this.pipeline = pipeline
    this.sampler = sampler
  }

  static async create(canvas: HTMLCanvasElement) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' })
    if (!adapter) throw new Error('No WebGPU adapter')
    const device = await adapter.requestDevice()
    const context = canvas.getContext('webgpu')
    if (!context) throw new Error('No WebGPU canvas context')
    const format = navigator.gpu.getPreferredCanvasFormat()
    context.configure({ device, format, alphaMode: 'premultiplied' })
    const shader = device.createShaderModule({ code: VIDEO_SHADER })
    const pipeline = device.createRenderPipeline({
      layout: 'auto',
      vertex: { module: shader, entryPoint: 'vertexMain' },
      fragment: { module: shader, entryPoint: 'fragmentMain', targets: [{ format }] },
      primitive: { topology: 'triangle-list' },
    })
    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' })
    return new WebGpuVideoFrameRenderer(canvas, device, context, pipeline, sampler)
  }

  async present(frame: VideoFrame) {
    resizeCanvas(this.canvas, frame.displayWidth, frame.displayHeight)
    try {
      const texture = this.device.importExternalTexture({ source: frame })
      const bindGroup = this.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: this.sampler },
          { binding: 1, resource: texture },
        ],
      })
      const encoder = this.device.createCommandEncoder()
      const pass = encoder.beginRenderPass({
        colorAttachments: [{
          view: this.context.getCurrentTexture().createView(),
          clearValue: { r: 0, g: 0, b: 0, a: 1 },
          loadOp: 'clear',
          storeOp: 'store',
        }],
      })
      pass.setPipeline(this.pipeline)
      pass.setBindGroup(0, bindGroup)
      pass.draw(6)
      pass.end()
      this.device.queue.submit([encoder.finish()])
    } finally {
      frame.close()
    }
  }

  dispose() {
    this.context.unconfigure()
  }
}

function resizeCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const safeWidth = Math.max(1, width)
  const safeHeight = Math.max(1, height)
  if (canvas.width !== safeWidth) canvas.width = safeWidth
  if (canvas.height !== safeHeight) canvas.height = safeHeight
}

const VIDEO_SHADER = /* wgsl */ `
struct VertexOutput {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@vertex
fn vertexMain(@builtin(vertex_index) index: u32) -> VertexOutput {
  var positions = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  var uvs = array<vec2f, 6>(
    vec2f(0.0, 1.0), vec2f(1.0, 1.0), vec2f(0.0, 0.0),
    vec2f(0.0, 0.0), vec2f(1.0, 1.0), vec2f(1.0, 0.0),
  );
  var output: VertexOutput;
  output.position = vec4f(positions[index], 0.0, 1.0);
  output.uv = uvs[index];
  return output;
}

@group(0) @binding(0) var videoSampler: sampler;
@group(0) @binding(1) var videoTexture: texture_external;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
  return textureSampleBaseClampToEdge(videoTexture, videoSampler, input.uv);
}
`
