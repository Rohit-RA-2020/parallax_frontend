import { describe, expect, it } from 'vitest'
import { visibleTimelineThumbnailTiles } from './timelineThumbnails'

describe('visibleTimelineThumbnailTiles', () => {
  it('samples visible tiles near their actual timeline positions', () => {
    const tiles = visibleTimelineThumbnailTiles({
      clipStart: 0,
      clipDuration: 2 * 60 * 60,
      sourceDuration: 2 * 60 * 60,
      pxPerSecond: 24,
      visibleStart: 60 * 79 + 30,
      visibleEnd: 60 * 80 + 10,
    })
    expect(tiles.length).toBeLessThan(15)
    for (const tile of tiles) {
      expect(Math.abs(tile.timelineTime - tile.sourceTime)).toBeLessThan(0.001)
      expect(tile.timelineTime).toBeGreaterThan(60 * 79 + 20)
      expect(tile.timelineTime).toBeLessThan(60 * 80 + 20)
    }
  })

  it('maps trimmed and retimed clips back to source time', () => {
    const [tile] = visibleTimelineThumbnailTiles({
      clipStart: 100,
      clipDuration: 20,
      sourceIn: 40,
      sourceDuration: 200,
      rate: 2,
      pxPerSecond: 20,
      visibleStart: 100,
      visibleEnd: 105,
    })
    expect(tile.sourceTime).toBeCloseTo(40 + (tile.timelineTime - 100) * 2)
  })

  it('does not create tiles for clips outside the viewport', () => {
    expect(visibleTimelineThumbnailTiles({
      clipStart: 100,
      clipDuration: 20,
      pxPerSecond: 20,
      visibleStart: 0,
      visibleEnd: 50,
    })).toEqual([])
  })
})
