import { Check, GitBranch, RotateCcw } from 'lucide-react'
import type { ProjectHistory } from '../lib/api'

type Props = {
  width: number
  history: ProjectHistory | null
  loading: boolean
  onRestore: (revision: number) => void
  onCheckpoint: () => void
}

export function HistoryPanel({ width, history, loading, onRestore, onCheckpoint }: Props) {
  const revisions = [...(history?.revisions ?? [])].sort((a, b) => b.id - a.id)
  return (
    <aside className="chrome flex h-full w-full shrink-0 flex-col border-r border-line bg-well" style={{ width }}>
      <div className="flex h-11 items-center justify-between border-b border-line px-3">
        <h2 className="text-[11px] font-medium tracking-[0.16em] text-mute uppercase">History</h2>
        <button type="button" onClick={onCheckpoint} disabled={!history} className="rounded border border-line px-2 py-1 text-[10px] text-mute hover:text-cream disabled:opacity-40">Checkpoint</button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2 scroll-thin">
        {loading && <div className="px-2 py-6 text-center text-[11px] text-dim">Loading history…</div>}
        {!loading && revisions.map((revision) => {
          const current = revision.id === history?.head
          return (
            <button
              key={revision.id}
              type="button"
              onClick={() => !current && onRestore(revision.id)}
              className="mb-1 flex w-full gap-2 rounded-md border border-transparent px-2 py-2 text-left hover:border-line hover:bg-lift"
            >
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-wash text-dim">
                {current ? <Check size={11} /> : revision.children && revision.children.length > 1 ? <GitBranch size={11} /> : <RotateCcw size={11} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] text-cream">{revision.summary}</span>
                <span className="mt-0.5 block text-[9px] text-dim">r{revision.id} · {revision.actor} · {new Date(revision.created_at).toLocaleString()}</span>
                {!!revision.checkpoints?.length && <span className="mt-1 block text-[9px] text-mark">{revision.checkpoints.join(', ')}</span>}
              </span>
            </button>
          )
        })}
      </div>
    </aside>
  )
}
