import type { LLMProfile } from './api'

export type LLMProvider = {
  id: string
  label: string
  baseURL: string
  icon?: string
  iconLight?: string
  iconDark?: string
  models: LLMProfile[]
}

function firstIcon(models: LLMProfile[], pick: (model: LLMProfile) => string | undefined) {
  for (const model of models) {
    const icon = pick(model)?.trim()
    if (icon) return icon
  }
  return undefined
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
      existing.icon ??= firstIcon([profile], (model) => model.provider_icon)
      existing.iconLight ??= firstIcon([profile], (model) => model.provider_icon_light)
      existing.iconDark ??= firstIcon([profile], (model) => model.provider_icon_dark)
      continue
    }
    providers.set(id, {
      id,
      label: providerLabel(profile),
      baseURL: profile.base_url,
      icon: profile.provider_icon?.trim() || undefined,
      iconLight: profile.provider_icon_light?.trim() || undefined,
      iconDark: profile.provider_icon_dark?.trim() || undefined,
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
