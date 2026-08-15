import { Fragment, type ReactNode } from 'react'

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }

export function MarkdownText({ children }: { children: string }) {
  const blocks = parseBlocks(children)
  return (
    <div className="space-y-2.5">
      {blocks.map((block, index) => {
        if (block.type === 'heading') {
          return (
            <div key={index} className="pt-1 text-[12px] font-semibold tracking-wide text-cream">
              {inline(block.text)}
            </div>
          )
        }
        if (block.type === 'list') {
          const Tag = block.ordered ? 'ol' : 'ul'
          return (
            <Tag
              key={index}
              className={block.ordered ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'}
            >
              {block.items.map((item, itemIndex) => <li key={itemIndex}>{inline(item)}</li>)}
            </Tag>
          )
        }
        return <p key={index}>{inline(block.text)}</p>
      })}
    </div>
  )
}

function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let paragraph: string[] = []

  const flushParagraph = () => {
    const text = paragraph.join(' ').trim()
    if (text) blocks.push({ type: 'paragraph', text })
    paragraph = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      flushParagraph()
      continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      flushParagraph()
      blocks.push({ type: 'heading', level: heading[1].length, text: heading[2] })
      continue
    }
    const bullet = /^[-*]\s+(.+)$/.exec(line)
    const numbered = /^\d+[.)]\s+(.+)$/.exec(line)
    if (bullet || numbered) {
      flushParagraph()
      const ordered = !!numbered
      const items: string[] = []
      for (; i < lines.length; i++) {
        const candidate = lines[i].trim()
        const match = ordered ? /^\d+[.)]\s+(.+)$/.exec(candidate) : /^[-*]\s+(.+)$/.exec(candidate)
        if (!match) {
          i--
          break
        }
        items.push(match[1])
      }
      blocks.push({ type: 'list', ordered, items })
      continue
    }
    paragraph.push(line)
  }
  flushParagraph()
  return blocks
}

function inline(text: string): ReactNode[] {
  return text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean).map((part, index) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={index} className="rounded bg-wash-strong px-1 py-0.5 font-mono text-[0.92em] text-cream">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={index} className="font-semibold text-cream">{part.slice(2, -2)}</strong>
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}
