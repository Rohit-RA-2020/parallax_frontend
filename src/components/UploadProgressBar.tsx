import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Upload } from 'lucide-react'
import { formatBytes, type UploadProgress } from '../lib/api'
import { fade } from '../lib/motion'
import { cn } from '../lib/cn'

export type UploadStatus = UploadProgress & {
  phase: 'uploading' | 'saving'
  startedAt: number
}

export function UploadProgressBar({ status }: { status: UploadStatus | null }) {
  const reduce = useReducedMotion()
  const pct = status ? percentOf(status) : 0
  const saving = status?.phase === 'saving'
  const rate = status ? transferRate(status) : 0
  const remaining = status && !saving ? etaSeconds(status, rate) : null

  return (
    <AnimatePresence>
      {status && (
        <motion.div
          key={`${status.file}-${status.fileIndex}`}
          role="status"
          aria-live="polite"
          aria-label={saving
            ? `Saving ${status.file} on the server`
            : `Uploading ${status.file}, ${pct} percent`}
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? undefined : { height: 0, opacity: 0 }}
          transition={fade}
          className="shrink-0 overflow-hidden border-b border-line bg-well"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Upload size={13} className="shrink-0 text-live" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-[12px] text-cream">
                  {saving ? 'Saving on server' : 'Uploading'}
                  <span className="text-mute"> · {status.file}</span>
                  {status.fileCount > 1 && (
                    <span className="text-dim"> · {status.fileIndex + 1} of {status.fileCount}</span>
                  )}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-cream">
                  {saving ? '—' : `${pct}%`}
                </span>
              </div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-wash-strong">
                <div
                  className={cn(
                    'h-full rounded-full bg-live',
                    saving && 'w-full animate-pulse',
                  )}
                  style={saving ? undefined : { width: `${pct}%`, transition: reduce ? undefined : 'width 160ms linear' }}
                />
              </div>
              <p className="mt-1 font-mono text-[10px] text-dim">
                {formatBytes(Math.min(status.sent, status.total || status.sent))}
                {status.total > 0 ? ` / ${formatBytes(status.total)}` : ''}
                {!saving && rate > 0 && (
                  <>
                    {' · '}
                    {formatBytes(rate)}/s
                    {remaining != null && remaining > 0 ? ` · ${formatEta(remaining)} left` : ''}
                  </>
                )}
                {saving && ' · writing history and starting index'}
              </p>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function percentOf(status: UploadProgress) {
  if (!(status.total > 0)) return 0
  return Math.min(100, Math.round((status.sent / status.total) * 100))
}

function transferRate(status: UploadStatus) {
  const elapsed = (Date.now() - status.startedAt) / 1000
  if (elapsed < 0.4 || status.sent <= 0) return 0
  return status.sent / elapsed
}

function etaSeconds(status: UploadStatus, bytesPerSecond: number) {
  if (!(bytesPerSecond > 0) || !(status.total > status.sent)) return null
  return (status.total - status.sent) / bytesPerSecond
}

function formatEta(seconds: number) {
  if (seconds < 5) return 'a few seconds'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}
