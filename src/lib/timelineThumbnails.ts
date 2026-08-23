export const TIMELINE_THUMBNAIL_WIDTH = 96

export type TimelineThumbnailTile = {
  index: number
  left: number
  width: number
  timelineTime: number
  sourceTime: number
}

export function visibleTimelineThumbnailTiles(input: {
  clipStart: number
  clipDuration: number
  sourceIn?: number
  sourceDuration?: number
  rate?: number
  pxPerSecond: number
  visibleStart: number
  visibleEnd: number
}): TimelineThumbnailTile[] {
  const { clipStart, clipDuration, pxPerSecond } = input
  if (clipDuration <= 0 || pxPerSecond <= 0 || input.visibleEnd <= clipStart || input.visibleStart >= clipStart + clipDuration) {
    return []
  }
  const pixelWidth = clipDuration * pxPerSecond
  const localVisibleStart = Math.max(0, input.visibleStart - clipStart)
  const localVisibleEnd = Math.min(clipDuration, input.visibleEnd - clipStart)
  const tileCount = Math.ceil(pixelWidth / TIMELINE_THUMBNAIL_WIDTH)
  const first = Math.max(0, Math.floor(localVisibleStart * pxPerSecond / TIMELINE_THUMBNAIL_WIDTH) - 1)
  const last = Math.min(tileCount - 1, Math.ceil(localVisibleEnd * pxPerSecond / TIMELINE_THUMBNAIL_WIDTH))
  const sourceIn = Math.max(0, input.sourceIn ?? 0)
  const rate = input.rate ?? 1
  const tiles: TimelineThumbnailTile[] = []
  for (let index = first; index <= last; index++) {
    const left = index * TIMELINE_THUMBNAIL_WIDTH
    const width = Math.min(TIMELINE_THUMBNAIL_WIDTH, pixelWidth - left)
    const localTime = Math.min(clipDuration, (left + width / 2) / pxPerSecond)
    let sourceTime = sourceIn + localTime * rate
    if (input.sourceDuration && input.sourceDuration > 0) {
      sourceTime = Math.min(sourceTime, Math.max(0, input.sourceDuration - 0.001))
    }
    tiles.push({ index, left, width, timelineTime: clipStart + localTime, sourceTime })
  }
  return tiles
}
