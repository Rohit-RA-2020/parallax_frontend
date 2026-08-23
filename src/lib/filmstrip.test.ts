import { describe, expect, it } from 'vitest'
import { timelineFilmstripFrames } from './filmstrip'

describe('timelineFilmstripFrames', () => {
  const frames = ['0', '1', '2', '3', '4', '5', '6', '7']

  it('keeps only frames inside a trimmed source range', () => {
    expect(timelineFilmstripFrames(frames, 80, 20, 30)).toEqual(['2', '3', '4'])
  })

  it('returns the nearest frame for a trim narrower than the sampling interval', () => {
    expect(timelineFilmstripFrames(frames, 80, 1, 1)).toEqual(['0'])
  })

  it('returns all frames when source duration is unknown', () => {
    expect(timelineFilmstripFrames(frames, undefined, 0, 10)).toEqual(frames)
  })
})
