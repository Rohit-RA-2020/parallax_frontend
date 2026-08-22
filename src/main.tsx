import { Component, StrictMode, type ErrorInfo, type PropsWithChildren } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

type ErrorBoundaryState = { error: Error | null }

class AppErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Parallax UI crashed', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-cream">
        <section className="w-full max-w-lg rounded-lg border border-line bg-panel p-5 shadow-[var(--toast-shadow)]">
          <p className="text-[10px] font-medium tracking-[0.16em] text-mark uppercase">Editor recovered from an error</p>
          <h1 className="mt-2 text-lg font-medium">The timeline needs to be reloaded.</h1>
          <p className="mt-2 text-sm leading-6 text-dim">Your saved project is unchanged. Reload the editor to restore the working view.</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 rounded-md bg-cream px-3 py-2 text-xs font-medium text-ink transition-opacity hover:opacity-85"
          >
            Reload editor
          </button>
        </section>
      </main>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
)
