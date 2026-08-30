import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowUpRight, FolderOpen, Loader2, LogOut, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { motion, useReducedMotion } from 'framer-motion'
import { useAuth } from '../auth/AuthProvider'
import { createProject, deleteProject, listProjects, type ProjectRecord } from '../lib/api'
import { softSpring } from '../lib/motion'
import { ThemeToggle } from './ThemeToggle'
import { Logo } from './ui'

type Props = {
  onOpenProject: (id: string) => void
}

export function ProjectDashboard({ onOpenProject }: Props) {
  const reduce = useReducedMotion()
  const { signOut, user } = useAuth()
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [deletingID, setDeletingID] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [error, setError] = useState('')

  const loadProjects = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    try {
      setProjects(await listProjects())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load projects')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { void loadProjects() }, [loadProjects])

  async function createNewProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || creating) return
    setCreating(true)
    setError('')
    try {
      const project = await createProject(trimmed)
      setName('')
      onOpenProject(project.id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create project')
    } finally {
      setCreating(false)
    }
  }

  async function removeProject(project: ProjectRecord) {
    if (deletingID || !window.confirm(`Delete “${project.name}” and all of its media? This cannot be undone.`)) return
    setDeletingID(project.id)
    setError('')
    try {
      await deleteProject(project.id)
      setProjects((current) => current.filter((item) => item.id !== project.id))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete project')
    } finally {
      setDeletingID(null)
    }
  }

  return (
    <main className="min-h-full overflow-auto bg-ink px-5 py-6 text-cream sm:px-8 sm:py-9">
      <div className="mx-auto max-w-6xl">
        <header className="flex items-center justify-between gap-4 border-b border-line pb-5">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              type="button"
              title={`Sign out${user?.email ? ` ${user.email}` : ''}`}
              onClick={() => void signOut()}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-mute transition-colors hover:border-line-strong hover:text-cream"
            >
              <LogOut size={14} />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        <section className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] text-mark uppercase">Workspace</p>
            <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Your projects</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-dim">Choose a project to continue editing, or start a new one.</p>
          </div>
          <button
            type="button"
            onClick={() => void loadProjects(true)}
            disabled={refreshing || loading}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-line px-3 text-xs text-mute transition-colors hover:border-line-strong hover:text-cream disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </section>

        <form onSubmit={(event) => void createNewProject(event)} className="mt-8 flex max-w-xl gap-2">
          <label className="sr-only" htmlFor="project-name">New project name</label>
          <input
            id="project-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New project name"
            maxLength={120}
            className="h-10 min-w-0 flex-1 rounded-md border border-line bg-panel px-3 text-sm outline-none placeholder:text-dim focus:border-line-strong"
          />
          <motion.button
            type="submit"
            disabled={!name.trim() || creating}
            whileHover={reduce || creating ? undefined : { y: -1 }}
            whileTap={reduce || creating ? undefined : { scale: 0.97 }}
            transition={softSpring}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-cream px-3.5 text-sm font-medium text-ink disabled:opacity-45"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Create project
          </motion.button>
        </form>

        {error && <p role="alert" className="mt-4 rounded-md border border-mark/40 bg-mark/10 px-3 py-2 text-sm text-cream">{error}</p>}

        {loading ? (
          <div className="mt-12 flex items-center gap-3 text-sm text-dim"><Loader2 size={18} className="animate-spin" /> Loading projects…</div>
        ) : projects.length === 0 ? (
          <section className="mt-8 grid min-h-72 place-items-center rounded-xl border border-dashed border-line-strong bg-panel/40 p-8 text-center">
            <div>
              <FolderOpen className="mx-auto text-dim" size={28} />
              <h2 className="mt-4 text-lg font-medium">No projects yet</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-dim">Create a project above to organize your media, timeline, and AI editing sessions.</p>
            </div>
          </section>
        ) : (
          <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Projects">
            {projects.map((project) => (
              <article key={project.id} className="group rounded-xl border border-line bg-panel p-4 transition-colors hover:border-line-strong">
                <button type="button" onClick={() => onOpenProject(project.id)} className="block w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <span className="grid size-9 place-items-center rounded-lg bg-wash text-mark"><FolderOpen size={18} /></span>
                    <ArrowUpRight size={16} className="mt-1 text-dim transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-cream" />
                  </div>
                  <h2 className="mt-8 truncate text-base font-medium">{project.name}</h2>
                  <p className="mt-1 text-xs text-dim">{project.media_count} {project.media_count === 1 ? 'media item' : 'media items'} · Updated {formatDate(project.updated_at)}</p>
                </button>
                <div className="mt-4 flex justify-end border-t border-line pt-3">
                  <button
                    type="button"
                    onClick={() => void removeProject(project)}
                    disabled={deletingID === project.id}
                    className="inline-flex items-center gap-1.5 text-xs text-dim transition-colors hover:text-mark disabled:opacity-50"
                  >
                    {deletingID === project.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'recently'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}
