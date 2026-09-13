import { describe, expect, it } from 'vitest'
import { providerIconCandidates } from './providerIcons'

describe('provider icon candidates', () => {
  it('prefers the active theme variant, then the shared icon', () => {
    const candidates = providerIconCandidates('openai', 'OpenAI', {
      icon: '/icons/shared.png',
      iconLight: '/icons/light.png',
      iconDark: '/icons/dark.png',
    }, 'dark')
    expect(candidates.slice(0, 3)).toEqual(['/icons/dark.png', '/icons/shared.png', '/icons/light.png'])
  })

  it('uses a single provided image for both themes', () => {
    for (const theme of ['light', 'dark'] as const) {
      const candidates = providerIconCandidates('groq', 'Groq', { icon: '/icons/groq.png' }, theme)
      expect(candidates[0]).toBe('/icons/groq.png')
    }
  })

  it('falls back to the other theme image before conventional files', () => {
    const candidates = providerIconCandidates('groq', 'Groq', { iconDark: '/icons/dark.png' }, 'light')
    expect(candidates[0]).toBe('/icons/dark.png')
    expect(candidates).toContain('/provider-icons/groq-light.svg')
  })

  it('probes theme-specific conventional files before generic ones', () => {
    const candidates = providerIconCandidates('groq', 'Groq', {}, 'dark')
    expect(candidates).toEqual([
      '/provider-icons/groq-dark.svg',
      '/provider-icons/groq-dark.png',
      '/provider-icons/groq.svg',
      '/provider-icons/groq.png',
    ])
  })
})
