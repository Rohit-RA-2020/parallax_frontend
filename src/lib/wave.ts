export function waveform(seed: number, bars: number): number[] {
  const out: number[] = []
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  for (let i = 0; i < bars; i++) {
    s = (s * 16807) % 2147483647
    const env = Math.sin((i / Math.max(bars - 1, 1)) * Math.PI) ** 0.55
    const n = (s % 1000) / 1000
    out.push(0.12 + env * (0.22 + n * 0.66))
  }
  return out
}
