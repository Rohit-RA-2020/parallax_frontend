import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'
import { useEffect, useMemo, useRef } from 'react'

let mermaidSequence = 0

export function MarkdownText({ children, fadeTail = 0 }: { children: string; fadeTail?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(children), [children])

  useEffect(() => {
    let cancelled = false
    const root = host.current
    if (!root) return

    const placeholders = Array.from(root.querySelectorAll<HTMLElement>('[data-mermaid-code][data-mermaid-status="pending"]'))
    for (const placeholder of placeholders) {
      const encoded = placeholder.dataset.mermaidCode
      if (!encoded) continue
      placeholder.dataset.mermaidStatus = 'rendering'
      let source = ''
      try {
        source = normalizeMermaidSource(decodeURIComponent(encoded))
      } catch {
        placeholder.textContent = 'Unable to decode Mermaid diagram.'
        placeholder.dataset.mermaidStatus = 'error'
        continue
      }

      void renderMermaidWithTimeout(source).then((svg) => {
        if (cancelled || !placeholder.isConnected) return
        placeholder.innerHTML = svg
        placeholder.removeAttribute('data-mermaid-code')
        placeholder.removeAttribute('data-mermaid-status')
        placeholder.className = 'markdown-mermaid'
      }).catch(() => {
        if (cancelled || !placeholder.isConnected) return
        placeholder.textContent = source
        placeholder.removeAttribute('data-mermaid-code')
        placeholder.removeAttribute('data-mermaid-status')
        placeholder.className = 'markdown-code-fallback'
      })
    }

    return () => {
      cancelled = true
    }
  }, [html])

  return (
    <div
      ref={host}
      className={`markdown-text space-y-2.5${fadeTail > 0 ? ' markdown-streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

function renderMarkdown(source: string) {
  const renderer = new Renderer()
  renderer.code = ({ text, lang }) => {
    if (lang?.trim().toLowerCase() === 'mermaid') {
      const encoded = encodeURIComponent(text)
      return `<div class="markdown-mermaid-placeholder" data-mermaid-code="${encoded}" data-mermaid-status="pending"><div class="markdown-diagram-label">Mermaid diagram</div><pre class="markdown-diagram-source"><code>${escapeHtml(text)}</code></pre></div>`
    }
    const language = lang?.trim().replace(/[^a-z0-9+#.-]/gi, '')
    const className = language ? ` class="language-${language}"` : ''
    return `<pre><code${className}>${escapeHtml(text)}</code></pre>`
  }

  const raw = marked.parse(source.replace(/\r\n?/g, '\n'), {
    gfm: true,
    breaks: true,
    renderer,
    async: false,
  })
  return DOMPurify.sanitize(raw, {
    ADD_ATTR: ['data-mermaid-code', 'data-mermaid-status', 'target', 'rel'],
  })
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function normalizeMermaidSource(source: string) {
  return source
    .replace(/^\s*```(?:mermaid)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim()
    .slice(0, 50000)
}

async function renderMermaidWithTimeout(source: string) {
  // Keep this local and synchronous-but-bounded. The full Mermaid parser can
  // block the editor's main thread on malformed model output; this renderer
  // only supports the common flowchart subset and always returns promptly.
  return renderFlowchartSvg(source)
}

type DiagramNode = {
  id: string
  label: string
  shape: 'rect' | 'round' | 'diamond' | 'ellipse' | 'cylinder'
}

type DiagramEdge = {
  from: string
  to: string
  label: string
  dashed: boolean
}

function renderFlowchartSvg(source: string) {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean)
  const header = lines.find((line) => /^(flowchart|graph)\s+/i.test(line))
  if (!header) throw new Error('Only Mermaid flowcharts are supported.')

  const direction = header.match(/^(?:flowchart|graph)\s+(LR|RL|TB|TD|BT)\b/i)?.[1]?.toUpperCase() ?? 'TB'
  const nodes = new Map<string, DiagramNode>()
  const edges: DiagramEdge[] = []

  for (const line of lines.slice(1)) {
    if (line.startsWith('%%') || /^subgraph\b|^end$/i.test(line)) continue
    const edgeMatch = line.match(/^\s*([\w:-]+)(?:\s*([^\s|]+))?\s*(-->|-.->|==>|---|===|--)(?:\|([^|]*)\|)?\s*([\w:-]+)(?:\s*([^\s|]+))?/)
    if (edgeMatch) {
      const [, fromId, fromShape, marker, edgeLabel, toId, toShape] = edgeMatch
      const from = ensureDiagramNode(nodes, fromId, fromShape)
      const to = ensureDiagramNode(nodes, toId, toShape)
      edges.push({ from: from.id, to: to.id, label: edgeLabel?.trim() ?? '', dashed: marker === '-.->' })
      continue
    }

    const declaration = parseNodeDeclaration(line)
    if (declaration) nodes.set(declaration.id, declaration)
  }

  if (!nodes.size) throw new Error('No flowchart nodes found.')

  const nodeList = Array.from(nodes.values())
  const columns = direction === 'LR' || direction === 'RL' ? Math.min(5, Math.max(2, Math.ceil(Math.sqrt(nodeList.length)))) : Math.min(4, Math.max(2, Math.ceil(Math.sqrt(nodeList.length))))
  const nodeWidth = 190
  const nodeHeight = 58
  const gapX = 54
  const gapY = 50
  const padding = 28
  const rows = Math.ceil(nodeList.length / columns)
  const width = padding * 2 + columns * nodeWidth + (columns - 1) * gapX
  const height = padding * 2 + rows * nodeHeight + (rows - 1) * gapY
  const positions = new Map<string, { x: number; y: number }>()

  nodeList.forEach((node, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    positions.set(node.id, {
      x: padding + column * (nodeWidth + gapX),
      y: padding + row * (nodeHeight + gapY),
    })
  })

  const markerId = `parallax-arrow-${mermaidSequence++}`
  const edgeSvg = edges.map((edge) => {
    const from = positions.get(edge.from)
    const to = positions.get(edge.to)
    if (!from || !to) return ''
    const start = edgePoint(from, to, nodeWidth, nodeHeight)
    const end = edgePoint(to, from, nodeWidth, nodeHeight)
    const x = (start.x + end.x) / 2
    const y = (start.y + end.y) / 2 - 5
    const label = edge.label ? `<g class="diagram-edge-label"><rect x="${x - Math.max(24, edge.label.length * 3.6)}" y="${y - 12}" width="${Math.max(48, edge.label.length * 7.2)}" height="20" rx="10"/><text x="${x}" y="${y + 2}" text-anchor="middle">${escapeXml(edge.label)}</text></g>` : ''
    return `<path class="diagram-edge${edge.dashed ? ' diagram-edge-dashed' : ''}" d="M ${start.x} ${start.y} L ${end.x} ${end.y}" marker-end="url(#${markerId})"/>${label}`
  }).join('')

  const nodeSvg = nodeList.map((node) => {
    const position = positions.get(node.id)
    if (!position) return ''
    const shape = diagramShape(node.shape, position.x, position.y, nodeWidth, nodeHeight)
    const lines = wrapDiagramLabel(node.label, 25)
    const text = lines.map((line, index) => `<tspan x="${position.x + nodeWidth / 2}" dy="${index === 0 ? 0 : 17}">${escapeXml(line)}</tspan>`).join('')
    const textY = position.y + nodeHeight / 2 - ((lines.length - 1) * 17) / 2 + 5
    return `<g class="diagram-node">${shape}<text x="${position.x + nodeWidth / 2}" y="${textY}" text-anchor="middle">${text}</text></g>`
  }).join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Mermaid flowchart"><defs><marker id="${markerId}" markerWidth="9" markerHeight="7" refX="8" refY="3.5" orient="auto"><path d="M 0 0 L 9 3.5 L 0 7 z"/></marker><style>.diagram-edge{fill:none;stroke:#8ca8a4;stroke-width:1.8}.diagram-edge-dashed{stroke-dasharray:6 5}.diagram-edge-label rect{fill:#222b2b;stroke:#526c68;stroke-width:1}.diagram-edge-label text{fill:#c5d4d0;font:11px Inter,system-ui,sans-serif}.diagram-node rect,.diagram-node path,.diagram-node ellipse{fill:#263130;stroke:#84aaa2;stroke-width:1.5}.diagram-node text{fill:#f2eee4;font:13px Inter,system-ui,sans-serif}</style></defs><g>${edgeSvg}${nodeSvg}</g></svg>`
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })
}

function parseNodeDeclaration(line: string): DiagramNode | null {
  const match = line.match(/^([\w:-]+)\s*(\[\[(.*?)\]\]|\[\((.*?)\)\]|\(\((.*?)\)\)|\{(.*?)\}|\((.*?)\)|\[(.*?)\])\s*$/)
  if (!match) return null
  const [, id, token, cylinder, roundedRect, ellipse, diamond, round, rect] = match
  const rawLabel = cylinder ?? roundedRect ?? ellipse ?? diamond ?? round ?? rect ?? id
  const shape: DiagramNode['shape'] = token.startsWith('[[') ? 'cylinder' : token.startsWith('[(') ? 'cylinder' : token.startsWith('((') ? 'ellipse' : token.startsWith('{') ? 'diamond' : token.startsWith('(') ? 'round' : 'rect'
  return { id, label: cleanDiagramLabel(rawLabel), shape }
}

function ensureDiagramNode(nodes: Map<string, DiagramNode>, id: string, token?: string) {
  const parsed = token ? parseNodeDeclaration(`${id}${token}`) : null
  const existing = nodes.get(id)
  if (existing) return existing
  const node = parsed ?? { id, label: id, shape: 'rect' as const }
  nodes.set(id, node)
  return node
}

function cleanDiagramLabel(value: string) {
  return value.trim().replace(/^['"]|['"]$/g, '').replace(/\\n/g, ' ')
}

function wrapDiagramLabel(value: string, maxLength: number) {
  const words = value.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    if (current && `${current} ${word}`.length > maxLength) {
      lines.push(current)
      current = word
    } else {
      current = current ? `${current} ${word}` : word
    }
  }
  if (current) lines.push(current)
  return lines.slice(0, 4)
}

function edgePoint(position: { x: number; y: number }, other: { x: number; y: number }, width: number, height: number) {
  const centerX = position.x + width / 2
  const centerY = position.y + height / 2
  const dx = other.x + width / 2 - centerX
  const dy = other.y + height / 2 - centerY
  if (Math.abs(dx) > Math.abs(dy)) return { x: centerX + Math.sign(dx || 1) * width / 2, y: centerY }
  return { x: centerX, y: centerY + Math.sign(dy || 1) * height / 2 }
}

function diagramShape(shape: DiagramNode['shape'], x: number, y: number, width: number, height: number) {
  if (shape === 'ellipse') return `<ellipse cx="${x + width / 2}" cy="${y + height / 2}" rx="${width / 2}" ry="${height / 2}"/>`
  if (shape === 'diamond') return `<path d="M ${x + width / 2} ${y} L ${x + width} ${y + height / 2} L ${x + width / 2} ${y + height} L ${x} ${y + height / 2} Z"/>`
  if (shape === 'round') return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="${height / 2}"/>`
  if (shape === 'cylinder') return `<path d="M ${x} ${y + 9} Q ${x + width / 2} ${y - 3} ${x + width} ${y + 9} L ${x + width} ${y + height - 9} Q ${x + width / 2} ${y + height + 3} ${x} ${y + height - 9} Z"/>`
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="9"/>`
}

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}
