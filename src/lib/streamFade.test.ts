import { describe, expect, it } from 'vitest'
import { STREAM_FADE_MS, updateStreamFade } from './streamFade'

describe('stream chunk fades', () => {
  it('starts each new chunk while preserving the previous animation clock', () => {
    const first = updateStreamFade({ text: '', births: [] }, 'Hello', 100)
    const next = updateStreamFade(first, 'Hello world', 150)
    expect(next.births.slice(0, 5)).toEqual(Array(5).fill(100))
    expect(next.births.slice(5)).toEqual(Array(6).fill(150))
    expect(next.births[5] - first.births[0]).toBeLessThan(STREAM_FADE_MS)
  })
  it('preserves surviving text when markdown delimiters disappear', () => {
    const first = updateStreamFade({ text: '', births: [] }, '**Hello', 100)
    expect(updateStreamFade(first, 'Hello', 200).births).toEqual(Array(5).fill(100))
  })
  it('does not restart unchanged text on rerender', () => {
    const first = updateStreamFade({ text: '', births: [] }, 'Hello', 100)
    expect(updateStreamFade(first, 'Hello', 300)).toEqual(first)
  })
})
