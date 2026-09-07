import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Download, FolderOpen, LogOut, Moon, Plus, Redo2, Share, Sun, Trash2, Undo2, Upload } from 'lucide-react'
import { motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion'
import { PROJECT_FPS, PROJECT_RES } from '../data/project'
import type { ProjectRecord } from '../lib/api'
import { softSpring } from '../lib/motion'
import { useThemeStore } from '../store/theme'
import { IconButton, Logo, Pill } from './ui'
import { Select, SelectContent, SelectItem, SelectTrigger } from './Select'
import { useAuth } from '../auth/AuthProvider'
import { cn } from '../lib/cn'

type Props = {
  onExport: () => void
  projects: ProjectRecord[]
  projectId: string
  projectName: string
  uploading: boolean
  uploadLabel?: string
  uploadPercent?: number
  exporting?: boolean
  onProject: (id: string) => void
  onCreateProject: () => void
  onDeleteProject: () => void
  onUpload: () => void
  canUndo?: boolean
  canRedo?: boolean
  onUndo?: () => void
  onRedo?: () => void
  onProjects?: () => void
}

function ActionButton({
  children,
  className,
  ...props
}: HTMLMotionProps<'button'>) {
  const reduce = useReducedMotion()
  return (
    <motion.button
      type="button"
      whileHover={reduce || props.disabled ? undefined : { y: -1 }}
      whileTap={reduce || props.disabled ? undefined : { scale: 0.97 }}
      transition={softSpring}
      className={cn(
        'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] transition-colors',
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}

export function TopBar({
  onExport,
  projects,
  projectId,
  projectName,
  uploading,
  uploadLabel,
  uploadPercent,
  exporting,
  onProject,
  onCreateProject,
  onDeleteProject,
  onUpload,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onProjects,
}: Props) {
  const { signOut, user } = useAuth()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    function onPointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  const email = user?.email ?? ''
  const initial = (email.trim()[0] ?? 'P').toUpperCase()
  const activeProject = projects.find((project) => project.id === projectId)?.name ?? projectName

  return (
    <header className="chrome relative z-40 flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      {/* ── Left: navigation + project context ─────────────────── */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Logo className="shrink-0" />

        {onProjects && (
          <>
            <div className="mx-1 hidden h-5 w-px shrink-0 bg-line-strong sm:block" />
            <button
              type="button"
              onClick={onProjects}
              title="All projects"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md px-2 text-[13px] text-dim transition-colors hover:bg-wash hover:text-cream"
            >
              <FolderOpen size={15} />
              <span className="hidden lg:inline">Projects</span>
            </button>
          </>
        )}

        <div className="hidden h-5 w-px shrink-0 bg-line sm:block" />

        <div className="hidden min-w-0 items-center gap-1 sm:flex">
          {projects.length ? (
            <Select value={projectId} onValueChange={onProject}>
              <SelectTrigger
                className="h-9 w-[168px] border-transparent bg-transparent px-2 text-[13px] font-medium text-cream hover:border-line hover:bg-well"
                aria-label="Current project"
              >
                <span className="truncate">{activeProject}</span>
              </SelectTrigger>
              <SelectContent side="bottom" align="start">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id} textValue={project.name}>
                    <span className="truncate">{project.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="truncate px-1 text-[13px] font-medium text-mute">{projectName}</span>
          )}
          <IconButton label="New project" onClick={onCreateProject} className="size-8">
            <Plus size={15} />
          </IconButton>
          <IconButton label="Delete project" disabled={!projectId} onClick={onDeleteProject} className="size-8">
            <Trash2 size={15} />
          </IconButton>
          <span className="ml-1.5 shrink-0">
            <Pill>Draft</Pill>
          </span>
        </div>
      </div>

      {/* ── Center: edit history ───────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-line bg-well p-1">
        <IconButton label="Undo" disabled={!canUndo} onClick={onUndo} className="size-7 hover:bg-lift">
          <Undo2 size={15} />
        </IconButton>
        <div className="h-4 w-px bg-line-strong" />
        <IconButton label="Redo" disabled={!canRedo} onClick={onRedo} className="size-7 hover:bg-lift">
          <Redo2 size={15} />
        </IconButton>
      </div>

      {/* ── Right: share group + utilities ─────────────────────── */}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
        <p className="mr-2 hidden shrink-0 text-[11px] tabular-nums text-dim 2xl:block">
          {PROJECT_FPS} fps&nbsp;&nbsp;·&nbsp;&nbsp;{PROJECT_RES}
        </p>

        <ActionButton
          onClick={onUpload}
          disabled={!projectId || uploading}
          className="relative overflow-hidden border border-line text-mute hover:border-line-strong hover:text-cream disabled:opacity-100 disabled:hover:border-line"
        >
          {uploading && (
            <span
              aria-hidden
              className="absolute inset-y-0 left-0 bg-live/20"
              style={{ width: `${Math.max(4, uploadPercent ?? 0)}%` }}
            />
          )}
          <Upload size={14} className="relative" />
          <span className="relative max-w-[10rem] truncate">
            {uploading ? (uploadLabel || 'Uploading…') : 'Upload'}
          </span>
        </ActionButton>

        <ActionButton className="hidden text-mute hover:bg-wash hover:text-cream md:inline-flex">
          <Share size={14} />
          Share
        </ActionButton>

        <ActionButton
          onClick={onExport}
          disabled={!projectId || exporting}
          className="ml-0.5 bg-cream font-medium text-ink disabled:opacity-40"
        >
          <Download size={14} />
          {exporting ? 'Exporting…' : 'Export'}
        </ActionButton>

        <div className="mx-1 hidden h-5 w-px shrink-0 bg-line sm:block" />

        <IconButton
          label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggleTheme}
          className="size-9 shrink-0 border border-transparent hover:border-line"
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </IconButton>

        <div ref={menuRef} className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={email || 'Account'}
            className={cn(
              'flex h-9 items-center gap-1 rounded-md border border-line pr-1.5 pl-1 transition-colors hover:border-line-strong',
              menuOpen && 'border-line-strong',
            )}
          >
            <span className="grid size-6 place-items-center rounded-full bg-wash-strong text-[11px] font-semibold text-cream">
              {initial}
            </span>
            <ChevronDown size={13} className={cn('text-dim transition-transform', menuOpen && 'rotate-180')} />
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute top-[calc(100%+8px)] right-0 z-50 w-60 overflow-hidden rounded-lg border border-line bg-panel shadow-[var(--toast-shadow)]"
            >
              <div className="border-b border-line px-3 py-2.5">
                <p className="text-[11px] tracking-wide text-dim uppercase">Signed in as</p>
                <p className="mt-0.5 truncate text-[13px] font-medium text-cream" title={email}>
                  {email || 'Unknown user'}
                </p>
              </div>
              <div className="p-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false)
                    void signOut()
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-[13px] text-mute transition-colors hover:bg-wash hover:text-cream"
                >
                  <LogOut size={14} />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
