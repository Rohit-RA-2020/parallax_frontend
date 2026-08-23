export function timelineFilmstripFrames(
  frames: string[] | undefined,
  sourceDuration: number | undefined,
  sourceIn: number | undefined,
  clipDuration: number,
  rate = 1,
): string[] {
  const available = frames ?? []
  if (available.length < 2 || !sourceDuration || sourceDuration <= 0) return available
  const sourceStart = Math.max(0, sourceIn ?? 0)
  const sourceEnd = Math.min(sourceDuration, sourceStart + clipDuration * rate)
  const selected = available.filter((_, index) => {
    const time = sourceDuration * (index + 0.5) / available.length
    return time >= sourceStart && time <= sourceEnd
  })
  if (selected.length > 0) return selected
  const midpoint = Math.min(sourceDuration, sourceStart + Math.max(0, sourceEnd - sourceStart) / 2)
  const nearest = Math.min(
    available.length - 1,
    Math.max(0, Math.floor(midpoint / sourceDuration * available.length)),
  )
  return [available[nearest]]
}
