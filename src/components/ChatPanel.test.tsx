import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TranscriptParts } from './ChatPanel'
import type { ChatPart } from '../types'

vi.mock('./MarkdownText', () => ({ MarkdownText: ({ children }: { children: string }) => <p>{children}</p> }))

const parts: ChatPart[] = [
  { id: 'plan', kind: 'text', text: 'I will create the scene.' },
  { id: 'render', kind: 'activity', activity: { id: 'render', kind: 'tool', name: 'blender_render', title: 'Rendering scene', status: 'success' } },
  { id: 'result', kind: 'text', text: 'The scene is ready.' },
]

const render = (pending: boolean) => renderToStaticMarkup(
  <TranscriptParts parts={parts} pending={pending} startedAt={null} reduce streaming={pending} />,
)

describe('Director activity transcript', () => {
  it('streams a text-only answer normally below the working indicator', () => {
    const html = renderToStaticMarkup(
      <TranscriptParts parts={[{ id: 'answer', kind: 'text', text: 'I am Parallax Director.' }]} pending startedAt={null} reduce streaming />,
    )
    expect(html).toContain('Working')
    expect(html.indexOf('Working')).toBeLessThan(html.indexOf('I am Parallax Director.'))
    expect(html).not.toContain('activity-timeline')
    expect(html).not.toContain('stream-text-shimmer')
  })

  it('shows full narration and tools in order while running', () => {
    const html = render(true)
    expect(html).toContain('I will create the scene.')
    expect(html).toContain('Rendering scene')
    expect(html.indexOf('I will create')).toBeLessThan(html.indexOf('Rendering scene'))
    expect(html.indexOf('Rendering scene')).toBeLessThan(html.indexOf('The scene is ready.'))
    expect(html).not.toContain('stream-text-shimmer')
  })

  it('collapses preceding activity and leaves the final response visible on completion', () => {
    const html = render(false)
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('I will create the scene.')
    expect(html).not.toContain('Rendering scene')
    expect(html).toContain('The scene is ready.')
  })
})
