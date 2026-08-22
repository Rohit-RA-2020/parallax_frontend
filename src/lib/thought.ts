const THOUGHT_TAG = /<\/?(?:thought|think)>/gi

export function stripThoughtTags(text: string) {
  return text.replace(THOUGHT_TAG, '')
}

export function stripThoughtMarkup(text: string) {
  return stripThoughtTags(text).replace(/^\s+/, '')
}

export function thoughtPreview(text: string) {
  const clean = stripThoughtMarkup(text).trim()
  if (!clean) return ''
  const line = clean.split('\n').map((part) => part.trim()).find(Boolean) ?? ''
  return line.replace(/^\*+\s*/, '').replace(/\*+$/, '')
}
