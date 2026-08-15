import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { cn } from '../lib/cn'
import { softSpring } from '../lib/motion'

export function Logo({ className }: { className?: string }) {
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={cn('inline-flex items-center gap-2.5', className)}
      initial="rest"
      whileHover={reduce ? undefined : 'hover'}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <motion.rect
          x="0.7"
          y="3.2"
          width="11.2"
          height="7.4"
          rx="1"
          stroke="currentColor"
          strokeWidth="1.2"
          variants={{ hover: { x: -0.5, y: -0.35 } }}
          transition={softSpring}
        />
        <motion.rect
          x="5.6"
          y="7.4"
          width="11.2"
          height="7.4"
          rx="1"
          stroke="var(--color-mark)"
          strokeWidth="1.2"
          variants={{ hover: { x: 0.5, y: 0.35 } }}
          transition={softSpring}
        />
      </svg>
      <span className="text-[13px] font-semibold tracking-[0.18em]">PARALLAX</span>
    </motion.span>
  )
}

type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd'
> & {
  label: string
  active?: boolean
}

export function IconButton({
  label,
  active,
  className,
  children,
  ...props
}: IconButtonProps) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      whileHover={reduce ? undefined : { scale: 1.06 }}
      whileTap={reduce ? undefined : { scale: 0.92 }}
      transition={softSpring}
      className={cn(
        'grid size-8 place-items-center rounded-md text-mute transition-colors hover:bg-wash hover:text-cream disabled:opacity-35 disabled:hover:bg-transparent disabled:hover:text-mute',
        active && 'bg-wash-strong text-cream',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function Pill({
  children,
  tone = 'mute',
}: {
  children: ReactNode
  tone?: 'mute' | 'live' | 'mark'
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase',
        tone === 'mute' && 'text-mute',
        tone === 'live' && 'border-live/30 text-live',
        tone === 'mark' && 'border-mark/40 text-mark',
      )}
    >
      {children}
    </span>
  )
}
