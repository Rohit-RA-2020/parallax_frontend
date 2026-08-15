const NAMED: [number, number][] = [
  [16, 9],
  [9, 16],
  [4, 3],
  [3, 4],
  [1, 1],
  [21, 9],
  [9, 21],
  [4, 5],
  [5, 4],
  [3, 2],
  [2, 3],
  [2, 1],
  [1, 2],
]

export const DEFAULT_FRAME = { width: 16, height: 9 }

export function fitContain(
  boxW: number,
  boxH: number,
  mediaW: number,
  mediaH: number,
): { width: number; height: number } {
  if (boxW < 2 || boxH < 2 || mediaW < 1 || mediaH < 1) {
    return { width: 0, height: 0 }
  }
  const scale = Math.min(boxW / mediaW, boxH / mediaH)
  return {
    width: Math.max(1, Math.round(mediaW * scale)),
    height: Math.max(1, Math.round(mediaH * scale)),
  }
}

export function aspectLabel(width: number, height: number): string {
  if (width < 1 || height < 1) return ''
  const ratio = width / height
  for (const [a, b] of NAMED) {
    if (Math.abs(ratio - a / b) <= 0.025) return `${a}:${b}`
  }
  const g = gcd(Math.round(width), Math.round(height))
  return `${Math.round(width / g)}:${Math.round(height / g)}`
}

export function resolutionLabel(width: number, height: number): string {
  if (width < 1 || height < 1) return ''
  const aspect = aspectLabel(width, height)
  return aspect ? `${width}×${height} · ${aspect}` : `${width}×${height}`
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x || 1
}
