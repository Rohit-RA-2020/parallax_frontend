import { useEffect, useRef } from 'react'
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  NormalBlending,
  PerspectiveCamera,
  Points,
  PointsMaterial,
  Scene,
  WebGLRenderer,
} from 'three'
import { useThemeStore, type Theme } from '../store/theme'

type Props = {
  playing: boolean
}

const COUNT = 120

export function Atmosphere({ playing }: Props) {
  const host = useRef<HTMLDivElement>(null)
  const playingRef = useRef(playing)
  const theme = useThemeStore((s) => s.theme)
  const themeRef = useRef(theme)
  playingRef.current = playing
  themeRef.current = theme

  useEffect(() => {
    const el = host.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const renderer = new WebGLRenderer({
      alpha: true,
      antialias: false,
      powerPreference: 'low-power',
    })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0x000000, 0)
    renderer.domElement.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;'
    el.appendChild(renderer.domElement)

    const scene = new Scene()
    const camera = new PerspectiveCamera(32, 1, 0.1, 24)
    camera.position.z = 6.2

    const positions = new Float32Array(COUNT * 3)
    const speeds = new Float32Array(COUNT)
    const phases = new Float32Array(COUNT)
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 11
      positions[i * 3 + 1] = (Math.random() - 0.5) * 7
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5
      speeds[i] = 0.012 + Math.random() * 0.035
      phases[i] = Math.random() * Math.PI * 2
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new BufferAttribute(positions, 3))

    const sprite = makeSprite()
    const mat = new PointsMaterial({
      map: sprite,
      size: 0.11,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: AdditiveBlending,
      color: 0xf3efe6,
      sizeAttenuation: true,
    })
    const points = new Points(geo, mat)
    scene.add(points)

    const bloomCount = 18
    const bloomPos = new Float32Array(bloomCount * 3)
    const bloomSpeed = new Float32Array(bloomCount)
    for (let i = 0; i < bloomCount; i++) {
      bloomPos[i * 3] = (Math.random() - 0.5) * 10
      bloomPos[i * 3 + 1] = (Math.random() - 0.5) * 6
      bloomPos[i * 3 + 2] = (Math.random() - 0.5) * 3
      bloomSpeed[i] = 0.008 + Math.random() * 0.02
    }
    const bloomGeo = new BufferGeometry()
    bloomGeo.setAttribute('position', new BufferAttribute(bloomPos, 3))
    const bloomMat = new PointsMaterial({
      map: sprite,
      size: 0.28,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: AdditiveBlending,
      color: 0xe8dcc4,
      sizeAttenuation: true,
    })
    const bloom = new Points(bloomGeo, bloomMat)
    scene.add(bloom)
    paintAtmosphere(mat, bloomMat, themeRef.current, playingRef.current)

    const mouse = { x: 0, y: 0 }
    const target = { x: 0, y: 0 }
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect()
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2
      target.y = ((e.clientY - r.top) / r.height - 0.5) * -2
    }
    window.addEventListener('pointermove', onMove, { passive: true })

    const resize = () => {
      const w = el.clientWidth
      const h = el.clientHeight
      if (w < 2 || h < 2) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(el)
    resize()

    let raf = 0
    let last = performance.now()
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (document.hidden) return

      const dt = Math.min(0.033, (now - last) / 1000)
      last = now
      mouse.x += (target.x - mouse.x) * 0.035
      mouse.y += (target.y - mouse.y) * 0.035

      const live = playingRef.current
      const boost = live ? 1.28 : 1
      const attr = geo.getAttribute('position')
      const pos = attr.array as Float32Array
      for (let i = 0; i < COUNT; i++) {
        const ix = i * 3
        pos[ix] += Math.sin(now * 0.00014 + phases[i]) * 0.0018 * boost
        pos[ix + 1] += speeds[i] * dt * 3.6 * boost
        pos[ix + 2] += Math.cos(now * 0.00011 + phases[i]) * 0.0009
        if (pos[ix + 1] > 3.4) pos[ix + 1] = -3.4
      }
      attr.needsUpdate = true

      const bAttr = bloomGeo.getAttribute('position')
      const bPos = bAttr.array as Float32Array
      for (let i = 0; i < bloomCount; i++) {
        const ix = i * 3
        bPos[ix + 1] += bloomSpeed[i] * dt * 2.2 * boost
        if (bPos[ix + 1] > 3.2) bPos[ix + 1] = -3.2
      }
      bAttr.needsUpdate = true

      points.rotation.y = mouse.x * 0.07
      points.rotation.x = mouse.y * 0.045
      bloom.rotation.y = mouse.x * 0.04
      bloom.rotation.x = mouse.y * 0.025
      camera.position.x = mouse.x * 0.16
      camera.position.y = mouse.y * 0.09
      camera.lookAt(0, 0, 0)

      paintAtmosphere(mat, bloomMat, themeRef.current, live)
      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
      geo.dispose()
      mat.dispose()
      bloomGeo.dispose()
      bloomMat.dispose()
      sprite.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={host} className="pointer-events-none absolute inset-0 z-[1]" aria-hidden />
}

function paintAtmosphere(
  mat: PointsMaterial,
  bloomMat: PointsMaterial,
  theme: Theme,
  live: boolean,
) {
  if (theme === 'light') {
    mat.color.setHex(0x2c281f)
    mat.blending = NormalBlending
    mat.opacity = live ? 0.26 : 0.16
    bloomMat.color.setHex(0x3d372c)
    bloomMat.blending = NormalBlending
    bloomMat.opacity = live ? 0.1 : 0.055
  } else {
    mat.color.setHex(0xf3efe6)
    mat.blending = AdditiveBlending
    mat.opacity = live ? 0.5 : 0.34
    bloomMat.color.setHex(0xe8dcc4)
    bloomMat.blending = AdditiveBlending
    bloomMat.opacity = live ? 0.16 : 0.1
  }
  mat.needsUpdate = true
  bloomMat.needsUpdate = true
}

function makeSprite() {
  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return new CanvasTexture(canvas)
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.35, 'rgba(243,239,230,0.22)')
  g.addColorStop(1, 'rgba(243,239,230,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  return new CanvasTexture(canvas)
}
