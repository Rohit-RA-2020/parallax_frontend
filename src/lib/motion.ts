export const easeOut = [0.22, 1, 0.36, 1] as const

export const fade = {
  duration: 0.28,
  ease: easeOut,
}

export const fadeSlow = {
  duration: 0.45,
  ease: easeOut,
}

export const softSpring = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 34,
  mass: 0.7,
}

export const panelTransition = {
  duration: 0.3,
  ease: easeOut,
}
