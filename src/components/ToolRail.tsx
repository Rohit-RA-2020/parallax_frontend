import { Clapperboard, Folder, Music2, Sparkles, Type } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import type { ToolId } from '../types'
import { cn } from '../lib/cn'
import { softSpring } from '../lib/motion'

const tools: { id: ToolId; label: string; icon: typeof Folder }[] = [
  { id: 'media', label: 'Media', icon: Folder },
  { id: 'titles', label: 'Titles', icon: Type },
  { id: 'audio', label: 'Audio', icon: Music2 },
  { id: 'effects', label: 'FX', icon: Sparkles },
  { id: 'transitions', label: 'Cuts', icon: Clapperboard },
]

type Props = {
  tool: ToolId
  onChange: (id: ToolId) => void
}

export function ToolRail({ tool, onChange }: Props) {
  const reduce = useReducedMotion()
  return (
    <nav className="chrome flex w-12 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-panel py-2.5">
      {tools.map((t) => {
        const Icon = t.icon
        const active = tool === t.id
        return (
          <motion.button
            key={t.id}
            type="button"
            title={t.label}
            aria-label={t.label}
            onClick={() => onChange(t.id)}
            whileHover={reduce ? undefined : { scale: 1.06 }}
            whileTap={reduce ? undefined : { scale: 0.92 }}
            transition={softSpring}
            className={cn(
              'relative grid size-10 place-items-center rounded-lg transition-colors',
              active ? 'text-cream' : 'text-dim hover:text-mute',
            )}
          >
            {active && (
              <motion.span
                layoutId="tool-active"
                className="absolute inset-0 rounded-lg bg-wash-strong"
                transition={reduce ? { duration: 0 } : softSpring}
              />
            )}
            <Icon size={16} strokeWidth={1.6} className="relative z-10" />
          </motion.button>
        )
      })}
    </nav>
  )
}
