export const STREAM_FADE_MS = 360

export type StreamFadeState = { text: string; births: number[] }

// Keep surviving text's original start times even when Markdown completes a
// delimiter and changes the rendered text around the newest chunk.
export function updateStreamFade(previous: StreamFadeState, text: string, now: number): StreamFadeState {
  let prefix = 0
  while (prefix < previous.text.length && prefix < text.length && previous.text[prefix] === text[prefix]) prefix++
  let suffix = 0
  while (suffix < previous.text.length - prefix && suffix < text.length - prefix
    && previous.text[previous.text.length - 1 - suffix] === text[text.length - 1 - suffix]) suffix++
  const births = Array<number>(text.length).fill(now)
  for (let i = 0; i < prefix; i++) births[i] = previous.births[i]
  for (let i = 0; i < suffix; i++) births[text.length - 1 - i] = previous.births[previous.text.length - 1 - i]
  return { text, births }
}
