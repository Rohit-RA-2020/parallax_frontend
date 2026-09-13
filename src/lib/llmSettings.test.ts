import { describe, expect, it } from 'vitest'
import type { LLMProfile } from './api'
import { groupLLMProfiles } from './llmSettings'

describe('LLM provider grouping', () => {
  it('groups models that share provider metadata', () => {
    const profiles: LLMProfile[] = [
      {
        id: 'openai:gpt-4.1',
        label: 'OpenAI · gpt-4.1',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4.1',
        api_key_set: true,
      },
      {
        id: 'openai:gpt-4o',
        label: 'OpenAI · gpt-4o',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        api_key_set: true,
      },
      {
        id: 'groq:llama',
        provider_id: 'groq',
        provider_label: 'Groq',
        base_url: 'https://api.groq.com/openai/v1',
        model: 'llama',
        api_key_set: true,
      },
    ]

    const providers = groupLLMProfiles(profiles)
    expect(providers.map((provider) => provider.label)).toEqual(['OpenAI', 'Groq'])
    expect(providers[0].models.map((model) => model.model)).toEqual(['gpt-4.1', 'gpt-4o'])
    expect(providers[1].models.map((model) => model.model)).toEqual(['llama'])
  })

  it('keeps legacy profiles as separate providers', () => {
    const profiles: LLMProfile[] = [{
      id: 'legacy',
      label: 'Legacy provider',
      base_url: 'https://example.com/v1',
      model: 'legacy-model',
      api_key_set: true,
    }]

    expect(groupLLMProfiles(profiles)[0]).toMatchObject({
      id: 'legacy',
      label: 'Legacy provider',
      models: [{ model: 'legacy-model' }],
    })
  })

  it('ignores profiles without a selectable id', () => {
    const profiles = [{
      id: '',
      provider_id: 'broken',
      base_url: 'https://example.com/v1',
      model: 'broken-model',
      api_key_set: true,
    }] satisfies LLMProfile[]

    expect(groupLLMProfiles(profiles)).toEqual([])
  })

  it('carries the provider icon onto the grouped provider', () => {
    const profiles: LLMProfile[] = [
      {
        id: 'openai:gpt-4.1',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        provider_icon: '/provider-icons/openai.png',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4.1',
        api_key_set: true,
      },
      {
        id: 'openai:gpt-4o',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        provider_icon: '/provider-icons/openai.png',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        api_key_set: true,
      },
    ]

    expect(groupLLMProfiles(profiles)[0].icon).toBe('/provider-icons/openai.png')
  })

  it('carries light/dark provider icons onto the grouped provider', () => {
    const profiles: LLMProfile[] = [
      {
        id: 'openai:gpt-4.1',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        provider_icon: '/provider-icons/openai.png',
        provider_icon_light: '/provider-icons/openai-light.png',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4.1',
        api_key_set: true,
      },
      {
        id: 'openai:gpt-4o',
        provider_id: 'openai',
        provider_label: 'OpenAI',
        provider_icon_dark: '/provider-icons/openai-dark.png',
        base_url: 'https://api.openai.com/v1',
        model: 'gpt-4o',
        api_key_set: true,
      },
    ]

    expect(groupLLMProfiles(profiles)[0]).toMatchObject({
      icon: '/provider-icons/openai.png',
      iconLight: '/provider-icons/openai-light.png',
      iconDark: '/provider-icons/openai-dark.png',
    })
  })
})
