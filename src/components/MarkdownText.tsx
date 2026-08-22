import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'
import { memo, useEffect, useMemo, useRef } from 'react'

let mermaidSequence = 0
let mermaidReady = false
let mermaidRenderTail: Promise<unknown> = Promise.resolve()
const mermaidCache = new Map<string, Promise<string>>()
let mermaidModule: Promise<typeof import('mermaid').default> | null = null

export const MarkdownText = memo(function MarkdownText({ children, fadeTail = 0 }: { children: string; fadeTail?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const html = useMemo(() => renderMarkdown(children), [children])

  useEffect(() => {
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

      void renderMermaidCached(source).then((svg) => {
        // The node itself is the cancellation signal. React Strict Mode runs an
        // effect's setup/cleanup cycle twice without detaching the live DOM node,
        // so a separate `cancelled` flag would discard the only render result.
        // A replaced or unmounted message, on the other hand, is disconnected.
        if (!placeholder.isConnected) return
        placeholder.innerHTML = svg
        placeholder.removeAttribute('data-mermaid-code')
        placeholder.removeAttribute('data-mermaid-status')
        placeholder.className = 'markdown-mermaid'
      }).catch((error: unknown) => {
        if (!placeholder.isConnected) return
        placeholder.textContent = source
        placeholder.dataset.mermaidError = error instanceof Error ? error.message : String(error)
        placeholder.removeAttribute('data-mermaid-code')
        placeholder.removeAttribute('data-mermaid-status')
        placeholder.className = 'markdown-code-fallback'
      })
    }

  }, [html])

  return (
    <div
      ref={host}
      className={`markdown-text space-y-2.5${fadeTail > 0 ? ' markdown-streaming' : ''}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
})

function renderMarkdown(source: string) {
  const renderer = new Renderer()
  renderer.code = ({ text, lang, raw: rawCode }) => {
    if (lang?.trim().toLowerCase() === 'mermaid') {
      if (!hasClosingMermaidFence(rawCode)) {
        return '<div class="markdown-mermaid-placeholder"><div class="markdown-diagram-label">Drawing diagram…</div></div>'
      }
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

function hasClosingMermaidFence(raw: string) {
  const trimmed = raw.replace(/\s+$/, '')
  const lines = trimmed.split('\n')
  return lines.length > 1 && /^ {0,3}`{3,}\s*$/.test(lines[lines.length - 1])
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

async function renderMermaidCached(source: string) {
  const cached = mermaidCache.get(source)
  if (cached) return cached

  const rendering = mermaidRenderTail.then(() => renderMermaid(source))
  mermaidRenderTail = rendering.catch(() => undefined)
  mermaidCache.set(source, rendering)
  if (mermaidCache.size > 30) {
    const oldest = mermaidCache.keys().next().value
    if (oldest) mermaidCache.delete(oldest)
  }
  rendering.catch(() => mermaidCache.delete(source))
  return rendering
}

async function renderMermaid(source: string) {
  if (!mermaidModule) {
    mermaidModule = import('mermaid').then(({ default: value }) => value)
  }
  const mermaid = await mermaidModule
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'base',
      themeVariables: {
        background: '#222b2b',
        primaryColor: '#263130',
        primaryTextColor: '#f2eee4',
        primaryBorderColor: '#84aaa2',
        lineColor: '#8ca8a4',
        secondaryColor: '#2e3a39',
        tertiaryColor: '#1d2525',
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: '13px',
      },
      flowchart: { useMaxWidth: true },
      sequence: { useMaxWidth: true },
    })
    mermaidReady = true
  }
  const id = `parallax-mermaid-${mermaidSequence++}`
  const { svg } = await mermaid.render(id, source)
  return DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true }, ADD_TAGS: ['foreignObject'], ADD_ATTR: ['style'] })
}
