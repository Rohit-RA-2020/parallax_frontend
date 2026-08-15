import { Download, Redo2, Share, Undo2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { PROJECT_FPS, PROJECT_NAME, PROJECT_RES } from '../data/project'
import { softSpring } from '../lib/motion'
import { ThemeToggle } from './ThemeToggle'
import { IconButton, Logo, Pill } from './ui'

type Props = {
  onExport: () => void
}

export function TopBar({ onExport }: Props) {
  const reduce = useReducedMotion()
  return (
    <header className="chrome flex h-12 shrink-0 items-center justify-between border-b border-line bg-panel px-3">
      <div className="flex min-w-0 items-center gap-5">
        <Logo />
        <div className="hidden h-4 w-px bg-line-strong sm:block" />
        <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
          <span className="truncate text-[13px] font-medium text-cream">{PROJECT_NAME}</span>
          <Pill>Draft</Pill>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <IconButton label="Undo" disabled>
          <Undo2 size={15} />
        </IconButton>
        <IconButton label="Redo" disabled>
          <Redo2 size={15} />
        </IconButton>
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        <div className="mr-1 hidden items-center gap-2 text-[11px] text-mute md:flex">
          <span className="font-mono">{PROJECT_FPS} fps</span>
          <span className="text-dim">/</span>
          <span className="font-mono">{PROJECT_RES}</span>
        </div>
        <motion.button
          type="button"
          whileHover={reduce ? undefined : { y: -1 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={softSpring}
          className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-mute transition-colors hover:bg-wash hover:text-cream sm:inline-flex"
        >
          <Share size={13} />
          Share
        </motion.button>
        <motion.button
          type="button"
          onClick={onExport}
          whileHover={reduce ? undefined : { y: -1 }}
          whileTap={reduce ? undefined : { scale: 0.97 }}
          transition={softSpring}
          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-cream px-3 text-[12px] font-medium text-ink"
        >
          <Download size={13} />
          Export
        </motion.button>
      </div>
    </header>
  )
}
