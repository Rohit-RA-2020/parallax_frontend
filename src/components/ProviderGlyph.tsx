import { useEffect, useMemo, useState } from 'react'
import { cn } from '../lib/cn'
import { providerIconCandidates, providerInitial, type ProviderIconSet } from '../lib/providerIcons'
import { useThemeStore } from '../store/theme'

type Props = {
  providerId: string
  label: string
  boxClassName?: string
  glyphClassName?: string
} & ProviderIconSet

export function ProviderGlyph({ providerId, label, icon, iconLight, iconDark, boxClassName, glyphClassName }: Props) {
  const theme = useThemeStore((state) => state.theme)
  const candidates = useMemo(
    () => providerIconCandidates(providerId, label, { icon, iconLight, iconDark }, theme),
    [providerId, label, icon, iconLight, iconDark, theme],
  )
  const [failed, setFailed] = useState(0)

  useEffect(() => {
    setFailed(0)
  }, [providerId, label, icon, iconLight, iconDark, theme])

  const box = cn(
    'grid shrink-0 place-items-center overflow-hidden border border-line bg-lift',
    boxClassName,
  )

  if (failed < candidates.length) {
    return (
      <span className={box} aria-hidden>
        <img
          src={candidates[failed]}
          alt=""
          draggable={false}
          onError={() => setFailed((n) => n + 1)}
          className="size-full object-contain"
        />
      </span>
    )
  }

  return (
    <span className={box} aria-hidden>
      <span className={cn('font-semibold text-cream', glyphClassName)}>
        {providerInitial(label)}
      </span>
    </span>
  )
}
