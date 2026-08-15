import { useLayoutEffect } from 'react'
import { Editor } from './components/Editor'
import { applyTheme, useThemeStore } from './store/theme'

export default function App() {
  const theme = useThemeStore((s) => s.theme)

  useLayoutEffect(() => {
    applyTheme(theme)
  }, [theme])

  return <Editor />
}
