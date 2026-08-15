import { Moon, Sun } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useThemeStore, type Theme } from '../store/theme'
import { cn } from '../lib/cn'
import { softSpring } from '../lib/motion'

const options: { id: Theme; label: string; icon: typeof Moon }[] = [
  { id: 'dark', label: 'Dark theme', icon: Moon },
  { id: 'light', label: 'Light theme', icon: Sun },
]

export function ThemeToggle() {
  const theme = useThemeStore((s) => s.theme)
  const setTheme = useThemeStore((s) => s.setTheme)
  const reduce = useReducedMotion()

  return (
    <div
      role="group"
      aria-label="Color theme"
      className="flex h-8 items-center rounded-md border border-line bg-well p-0.5"
    >
      {options.map(({ id, label, icon: Icon }) => {
        const active = theme === id
        return (
          <button
            key={id}
            type="button"
            aria-label={label}
            aria-pressed={active}
            onClick={() => setTheme(id)}
            className={cn(
              'relative grid size-7 place-items-center rounded-[5px] transition-colors',
              'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cream/35',
              active ? 'text-cream' : 'text-dim hover:text-mute',
            )}
          >
            {active && (
              <motion.span
                layoutId="theme-active"
                className="absolute inset-0 rounded-[5px] bg-lift shadow-[0_1px_0_var(--color-line)]"
                transition={reduce ? { duration: 0 } : softSpring}
              />
            )}
            <Icon size={13} strokeWidth={1.75} className="relative z-10" />
          </button>
        )
      })}
    </div>
  )
}
