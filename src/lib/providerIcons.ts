import type { Theme } from '../store/theme'

/**
 * Per-provider logo resolution for the model picker.
 *
 * Each provider can supply two images — one for the light theme, one for
 * dark. A single shared image is used for both themes when only one side
 * is provided.
 *
 * Resolution order for the active theme:
 *   1. Theme-specific explicit icon (`provider_icon_light` / `provider_icon_dark`,
 *      backend `LLM_<ID>_PROVIDER_ICON_LIGHT` / `_DARK`, `LLM_PROFILES` JSON).
 *   2. Shared explicit icon (`provider_icon` / `LLM_<ID>_PROVIDER_ICON`).
 *   3. The other theme's explicit icon (better than a letter).
 *   4. Zero-config convention — files in backend `provider-icons/` (served
 *      at `/provider-icons/`, proxied by the frontend) named after the
 *      provider id: `provider-icons/openai-dark.svg` (preferred),
 *      `provider-icons/openai-dark.png`, then the theme-agnostic
 *      `provider-icons/openai.svg` / `.png`. No config needed.
 *   5. Initial-letter fallback (previous behaviour).
 */

export type ProviderIconOverride =
  | string
  | { light?: string; dark?: string; both?: string }

export const PROVIDER_ICON_OVERRIDES: Record<string, ProviderIconOverride> = {
  // Examples (local-only, no backend change needed):
  // openai: '/provider-icons/openai.png',                       // both themes
  // openai: { light: '/provider-icons/openai-light.png', dark: '/provider-icons/openai-dark.png' },
}

export type ProviderIconSet = {
  icon?: string
  iconLight?: string
  iconDark?: string
}

function overrideSet(providerId: string): ProviderIconSet {
  const override = PROVIDER_ICON_OVERRIDES[providerId]
  if (!override) return {}
  if (typeof override === 'string') return { icon: override }
  return { icon: override.both, iconLight: override.light, iconDark: override.dark }
}

export function providerIconSlug(id: string, label: string) {
  const slug = (id || label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug || 'provider'
}

/** Ordered image candidates for the active theme (deduped, blanks removed). */
export function providerIconCandidates(
  providerId: string,
  label: string,
  set: ProviderIconSet,
  theme: Theme,
): string[] {
  const override = overrideSet(providerId)
  const light = set.iconLight?.trim() || override.iconLight?.trim() || ''
  const dark = set.iconDark?.trim() || override.iconDark?.trim() || ''
  const generic = set.icon?.trim() || override.icon?.trim() || ''
  const preferred = theme === 'light' ? light : dark
  const other = theme === 'light' ? dark : light
  const slug = providerIconSlug(providerId, label)
  const out: string[] = []
  for (const src of [
    preferred,
    generic,
    other,
    `/provider-icons/${slug}-${theme}.svg`,
    `/provider-icons/${slug}-${theme}.png`,
    `/provider-icons/${slug}.svg`,
    `/provider-icons/${slug}.png`,
  ]) {
    if (src && !out.includes(src)) out.push(src)
  }
  return out
}

export function providerInitial(label: string) {
  const trimmed = label.trim()
  if (!trimmed) return '·'
  return trimmed.charAt(0).toUpperCase()
}
