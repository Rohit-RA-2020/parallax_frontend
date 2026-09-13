import { useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, SendHorizonal } from 'lucide-react'
import type { ClarifyingQuestion, QuestionSheet } from '../types'
import { cn } from '../lib/cn'

type Props = {
  sheet: QuestionSheet
  disabled?: boolean
  onSubmit: (answers: { questionId: string; selected: string[]; custom?: string }[]) => void
  onSkip?: () => void
}

export function QASheet({ sheet, disabled, onSubmit, onSkip }: Props) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<Record<string, string[]>>(() => sheet.answers ?? {})
  const [custom, setCustom] = useState<Record<string, string>>({})
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({})

  const total = sheet.questions.length
  const current = sheet.questions[Math.min(index, total - 1)]

  const answeredCount = useMemo(() => {
    return sheet.questions.filter((q) => {
      const picked = selected[q.id] ?? []
      const text = (custom[q.id] ?? '').trim()
      return picked.length > 0 || (q.allow_custom && text.length > 0)
    }).length
  }, [sheet.questions, selected, custom])

  const complete = answeredCount === total

  function isCurrentAnswered(q: ClarifyingQuestion) {
    const picked = selected[q.id] ?? []
    const text = (custom[q.id] ?? '').trim()
    return picked.length > 0 || (q.allow_custom && text.length > 0)
  }

  function toggle(question: ClarifyingQuestion, optionId: string) {
    if (disabled || sheet.answered) return
    setSelected((prev) => {
      const currentPicked = prev[question.id] ?? []
      if (question.multi_select) {
        return {
          ...prev,
          [question.id]: currentPicked.includes(optionId)
            ? currentPicked.filter((id) => id !== optionId)
            : [...currentPicked, optionId],
        }
      }
      const next = currentPicked.includes(optionId) ? [] : [optionId]
      return { ...prev, [question.id]: next }
    })
    // Single-select: auto-advance once an option is picked.
    if (!question.multi_select) {
      const alreadyPicked = (selected[question.id] ?? []).includes(optionId)
      if (!alreadyPicked && index < total - 1) {
        window.setTimeout(() => setIndex((i) => Math.min(i + 1, total - 1)), 180)
      }
    }
  }

  function submit() {
    if (!complete || disabled || sheet.answered) return
    onSubmit(
      sheet.questions.map((q) => ({
        questionId: q.id,
        selected: selected[q.id] ?? [],
        custom: (custom[q.id] ?? '').trim() || undefined,
      })),
    )
  }

  if (!current) return null
  const picked = selected[current.id] ?? []
  const isCustomOpen = customOpen[current.id] ?? false
  const currentDone = isCurrentAnswered(current)
  const isLast = index === total - 1

  return (
    <div className="w-full max-w-full rounded-[18px] border border-line-strong bg-lift p-3 shadow-[0_10px_28px_rgb(0_0_0_/_0.07)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-wide text-dim">
            Question {index + 1} of {total}
          </span>
          {total > 1 && (
            <span className="flex items-center gap-1" aria-hidden>
              {sheet.questions.map((q, i) => (
                <span
                  key={q.id}
                  className={cn(
                    'h-1.5 rounded-full transition-colors',
                    i === index ? 'w-4 bg-cream' : (selected[q.id]?.length || (custom[q.id] ?? '').trim()) ? 'w-1.5 bg-cream/60' : 'w-1.5 bg-line-strong',
                  )}
                />
              ))}
            </span>
          )}
        </div>
        {!sheet.answered && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            disabled={disabled}
            className="shrink-0 text-[11px] text-dim hover:text-cream disabled:opacity-40"
          >
            Skip all
          </button>
        )}
      </div>

      <div className="mb-2 text-[13px] leading-snug text-cream">
        {current.question}
        {current.multi_select && <span className="ml-1.5 text-[10px] text-dim">(pick any)</span>}
      </div>

      <div className="flex flex-col items-stretch gap-1.5">
        {current.options.map((opt) => {
          const active = picked.includes(opt.id)
          return (
            <button
              key={opt.id}
              type="button"
              disabled={disabled || sheet.answered}
              onClick={() => toggle(current, opt.id)}
              aria-pressed={active}
              className={cn(
                'flex items-center gap-2 rounded-lg border px-2.5 py-2 text-left text-[12px] transition-colors',
                active
                  ? 'border-cream/60 bg-cream text-ink'
                  : 'border-line bg-wash/40 text-mute hover:border-line-strong hover:text-cream',
                (disabled || sheet.answered) && 'opacity-60',
              )}
            >
              {current.multi_select ? (
                <span
                  className={cn(
                    'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                    active ? 'border-ink bg-ink text-cream' : 'border-line-strong',
                  )}
                >
                  {active && <Check size={10} strokeWidth={3} />}
                </span>
              ) : (
                <span className={cn('h-2 w-2 shrink-0 rounded-full', active ? 'bg-ink' : 'bg-line-strong')} />
              )}
              <span className="leading-snug">{opt.label}</span>
            </button>
          )
        })}
      </div>

      {current.allow_custom && !sheet.answered && (
        <div className="mt-1.5">
          {!isCustomOpen ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setCustomOpen((p) => ({ ...p, [current.id]: true }))}
              className="text-[11px] text-dim underline-offset-2 hover:text-cream hover:underline disabled:opacity-40"
            >
              + Write my own
            </button>
          ) : (
            <input
              value={custom[current.id] ?? ''}
              disabled={disabled}
              onChange={(e) => setCustom((p) => ({ ...p, [current.id]: e.target.value }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && isCurrentAnswered(current)) {
                  e.preventDefault()
                  if (isLast) submit()
                  else setIndex((i) => Math.min(i + 1, total - 1))
                }
              }}
              placeholder="Type your own answer…"
              className="w-full rounded-lg border border-line bg-ink px-2.5 py-1.5 text-[12px] text-cream outline-none placeholder:text-dim focus:border-line-strong"
            />
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={index === 0 || disabled}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[12px] text-dim hover:text-cream disabled:opacity-30"
        >
          <ArrowLeft size={13} />
          Back
        </button>
        {isLast ? (
          <button
            type="button"
            disabled={!complete || disabled}
            onClick={submit}
            title={complete ? 'Send all answers' : `Answer all ${total} questions to send`}
            className="flex items-center gap-1.5 rounded-lg bg-cream px-3 py-2 text-[12px] font-medium text-ink disabled:opacity-30"
          >
            <SendHorizonal size={13} />
            Send{total > 1 ? ` all (${answeredCount}/${total})` : ''}
          </button>
        ) : (
          <button
            type="button"
            disabled={!currentDone || disabled}
            onClick={() => setIndex((i) => Math.min(i + 1, total - 1))}
            className="flex items-center gap-1 rounded-lg bg-cream px-3 py-2 text-[12px] font-medium text-ink disabled:opacity-30"
          >
            Next
            <ArrowRight size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
