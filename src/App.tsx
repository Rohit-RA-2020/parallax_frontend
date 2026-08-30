import { useLayoutEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Editor } from './components/Editor'
import { ProjectDashboard } from './components/ProjectDashboard'
import { applyTheme, useThemeStore } from './store/theme'

export default function App() {
  const theme = useThemeStore((s) => s.theme)
  const [activeProjectID, setActiveProjectID] = useState<string | null>(null)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  const transition = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: 12, filter: 'blur(3px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' }, exit: { opacity: 0, y: -8, filter: 'blur(2px)' } }

  return (
    <AnimatePresence mode="wait">
      {!activeProjectID ? (
        <motion.div key="projects" className="h-full" transition={{ duration: 0.24, ease: 'easeOut' }} {...transition}>
          <ProjectDashboard onOpenProject={setActiveProjectID} />
        </motion.div>
      ) : (
        <motion.div key="editor" className="h-full" transition={{ duration: 0.24, ease: 'easeOut' }} {...transition}>
          <Editor initialProjectID={activeProjectID} onBackToProjects={() => setActiveProjectID(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
