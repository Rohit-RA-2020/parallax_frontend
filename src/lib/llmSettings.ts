import type { LLMProfile } from './api'

export type LLMProvider = {
  id: string
  label: string
  baseURL: string
  models: LLMProfile[]
}

export function groupLLMProfiles(profiles: LLMProfile[]): LLMProvider[] {
  const providers = new Map<string, LLMProvider>()
  for (const profile of profiles) {
    const profileID = profile.id?.trim()
    if (!profileID) continue
    const id = profile.provider_id?.trim() || profileID
    const existing = providers.get(id)
    if (existing) {
      existing.models.push(profile)
      continue
    }
    providers.set(id, {
      id,
      label: providerLabel(profile),
      baseURL: profile.base_url,
      models: [profile],
    })
  }
  return [...providers.values()]
}

function providerLabel(profile: LLMProfile) {
  if (profile.provider_label?.trim()) return profile.provider_label.trim()
  if (profile.label?.trim()) return profile.label.trim()
  try {
    return new URL(profile.base_url).host.replace(/^www\./, '')
  } catch {
    return 'Untitled provider'
  }
}
