import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

import { applySessionEffort, applySessionModel } from '@/lib/gateway'
import { EFFORT_HINTS, EFFORT_LABELS, EFFORTS, loadSavedEffort, normalizeEffort, saveEffort, type Effort } from '@/lib/effort'
import {
  findModel,
  loadSavedModel,
  MOBILE_MODELS,
  MODEL_GROUPS,
  modelKey,
  saveModelPick,
  type ModelChoice,
} from '@/lib/models'
import { cn } from '@/lib/utils'
import { $currentEffort, $currentModel, $currentProvider } from '@/store/app'
import { IconCheck, IconChevronDown } from '@/components/icons'

export function usePickedModel(): ModelChoice {
  const liveModel = useStore($currentModel)
  const liveProvider = useStore($currentProvider)
  return findModel(liveProvider, liveModel) ?? loadSavedModel()
}

export function usePickedEffort(): Effort {
  const live = useStore($currentEffort)
  return live ? normalizeEffort(live) : loadSavedEffort()
}

function useMd() {
  const [md, setMd] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const q = window.matchMedia('(min-width: 768px)')
    const on = () => setMd(q.matches)
    q.addEventListener('change', on)
    return () => q.removeEventListener('change', on)
  }, [])
  return md
}

export function ModelPicker({
  sessionId,
  variant = 'chip',
}: {
  sessionId: string | null
  variant?: 'chip' | 'inline'
}) {
  const liveModel = useStore($currentModel)
  const liveProvider = useStore($currentProvider)
  const liveEffort = useStore($currentEffort)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModelChoice>(() => loadSavedModel())
  const [draftEffort, setDraftEffort] = useState<Effort>(() => loadSavedEffort())
  const rootRef = useRef<HTMLDivElement>(null)
  const desktop = useMd()

  const selected = useMemo(
    () => findModel(liveProvider, liveModel) ?? draft,
    [draft, liveModel, liveProvider],
  )
  const effort = liveEffort ? normalizeEffort(liveEffort) : draftEffort

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setOpen(false)
    }
    const onDown = (e: MouseEvent) => {
      if (!desktop) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [busy, desktop, open])

  const pickModel = async (choice: ModelChoice) => {
    setDraft(choice)
    saveModelPick(choice)
    $currentModel.set(choice.model)
    $currentProvider.set(choice.provider)
    setErr(null)
    if (!sessionId) return
    setBusy(true)
    try {
      await applySessionModel(sessionId, choice.provider, choice.model)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const pickEffort = async (next: Effort) => {
    setDraftEffort(next)
    saveEffort(next)
    $currentEffort.set(next)
    setErr(null)
    if (!sessionId) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      await applySessionEffort(sessionId, next)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const menuBody = (
    <div className="max-h-[min(420px,60dvh)] overflow-y-auto py-1">
      {MODEL_GROUPS.map(group => {
        const rows = MOBILE_MODELS.filter(m => m.group === group.id)
        return (
          <section key={group.id}>
            <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">{group.title}</div>
            {rows.map(row => {
              const active = modelKey(row) === modelKey(selected)
              return (
                <button
                  key={modelKey(row)}
                  type="button"
                  disabled={busy}
                  onClick={() => void pickModel(row)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{row.label}</div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">{row.hint}</div>
                  </div>
                  {active ? <IconCheck className="mt-0.5 shrink-0 text-primary" /> : null}
                </button>
              )
            })}
          </section>
        )
      })}
      <div className="my-1 border-t" />
      <div className="px-3 pb-1 pt-2 text-[11px] font-medium text-muted-foreground">思考深度</div>
      {EFFORTS.map(row => (
        <button
          key={row}
          type="button"
          disabled={busy}
          onClick={() => void pickEffort(row)}
          className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-muted disabled:opacity-50"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{EFFORT_LABELS[row]}</div>
            <div className="mt-0.5 text-xs text-muted-foreground">{EFFORT_HINTS[row]}</div>
          </div>
          {row === effort ? <IconCheck className="mt-0.5 shrink-0 text-primary" /> : null}
        </button>
      ))}
    </div>
  )

  const popover = open && desktop ? (
    <div
      role="menu"
      className="absolute bottom-[calc(100%+8px)] right-0 z-[80] w-[280px] overflow-hidden rounded-xl border bg-card py-1 shadow-[0_8px_30px_rgba(15,23,42,0.12)]"
    >
      {menuBody}
      {err ? <div className="px-3 py-2 text-xs text-red-500">{err}</div> : null}
    </div>
  ) : null

  const sheet = open && !desktop ? (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/20" onClick={() => !busy && setOpen(false)} />
      <div className="safe-bottom relative mx-auto w-full max-h-[80dvh] max-w-[560px] overflow-hidden rounded-t-3xl border-t bg-card shadow-[0_-8px_40px_rgba(15,23,42,0.08)]">
        <div className="mx-auto my-2 h-1 w-9 rounded-full bg-muted-foreground/30" />
        <div className="px-4 pb-1 text-[13px] font-semibold text-muted-foreground">模型和思考</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{menuBody}</div>
        {err ? <div className="px-4 py-2 text-xs text-red-500">{err}</div> : null}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="model-chip"
        onClick={() => setOpen(v => !v)}
        className={cn(
          variant === 'inline'
            ? 'inline-flex h-8 max-w-[16rem] shrink-0 items-center gap-1.5 rounded-full bg-muted px-3 text-xs font-medium text-foreground/80 hover:bg-muted/80 active:scale-[0.97]'
            : 'max-w-[42vw] truncate rounded-full bg-muted px-3 py-1.5 text-xs font-medium',
        )}
        title={`${selected.label} · ${EFFORT_LABELS[effort]}`}
      >
        <span className="max-w-[9.5rem] truncate">{selected.label}</span>
        <span className="text-muted-foreground">·</span>
        <span data-testid="effort-chip" className="shrink-0 text-muted-foreground">{EFFORT_LABELS[effort]}</span>
        <IconChevronDown className="shrink-0 opacity-50" />
      </button>
      {popover}
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </div>
  )
}
