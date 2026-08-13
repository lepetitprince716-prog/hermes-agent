import { useStore } from '@nanostores/react'
import { useEffect, useMemo, useState } from 'react'
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
  const [open, setOpen] = useState<'model' | 'effort' | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModelChoice>(() => loadSavedModel())
  const [draftEffort, setDraftEffort] = useState<Effort>(() => loadSavedEffort())

  const selected = useMemo(
    () => findModel(liveProvider, liveModel) ?? draft,
    [draft, liveModel, liveProvider],
  )
  const effort = liveEffort ? normalizeEffort(liveEffort) : draftEffort

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) setOpen(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [busy, open])

  const pickModel = async (choice: ModelChoice) => {
    setDraft(choice)
    saveModelPick(choice)
    $currentModel.set(choice.model)
    $currentProvider.set(choice.provider)
    setErr(null)
    if (!sessionId) {
      setOpen(null)
      return
    }
    setBusy(true)
    try {
      await applySessionModel(sessionId, choice.provider, choice.model)
      setOpen(null)
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
      setOpen(null)
      return
    }
    setBusy(true)
    try {
      await applySessionEffort(sessionId, next)
      setOpen(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const chipClass = variant === 'inline'
    ? 'inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-0.5 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.97]'
    : 'max-w-[42vw] truncate rounded-full border bg-muted px-3 py-1.5 text-xs font-medium'

  const sheet = open ? (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setOpen(null)} />
      <div className="safe-bottom relative mx-auto flex w-full max-h-[85dvh] max-w-[560px] flex-col rounded-t-2xl border-t bg-card shadow-xl md:mb-8 md:max-h-[70vh] md:rounded-2xl md:border">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{open === 'model' ? '选择模型' : '思考深度'}</div>
            <div className="text-[11px] text-muted-foreground">仅对当前会话生效</div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(null)}
            disabled={busy}
            className="rounded-full bg-muted px-3 py-1 text-xs active:scale-[0.97]"
          >
            关闭
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {open === 'effort' ? (
            <div className="overflow-hidden rounded-2xl border">
              {EFFORTS.map(row => (
                <button
                  key={row}
                  type="button"
                  disabled={busy}
                  onClick={() => void pickEffort(row)}
                  className={cn(
                    'flex w-full items-center justify-between border-b px-4 py-3 text-left last:border-b-0 disabled:opacity-50',
                    row === effort ? 'bg-primary/10' : 'bg-card hover:bg-muted/60',
                  )}
                >
                  <div>
                    <div className="text-sm font-medium">{EFFORT_LABELS[row]}</div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">{EFFORT_HINTS[row]}</div>
                  </div>
                  {row === effort ? <IconCheck className="text-primary" /> : null}
                </button>
              ))}
            </div>
          ) : (
            MODEL_GROUPS.map(group => {
              const rows = MOBILE_MODELS.filter(m => m.group === group.id)
              return (
                <section key={group.id} className="mb-4 last:mb-0">
                  <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title}
                  </div>
                  <div className="overflow-hidden rounded-2xl border">
                    {rows.map(row => {
                      const active = modelKey(row) === modelKey(selected)
                      return (
                        <button
                          key={modelKey(row)}
                          type="button"
                          disabled={busy}
                          onClick={() => void pickModel(row)}
                          className={cn(
                            'flex w-full items-center justify-between border-b px-4 py-3 text-left last:border-b-0 disabled:opacity-50',
                            active ? 'bg-primary/10' : 'bg-card hover:bg-muted/60',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium">{row.label}</div>
                            <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.hint}</div>
                          </div>
                          {active ? <IconCheck className="ml-3 shrink-0 text-primary" /> : null}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )
            })
          )}
        </div>
        {err ? <div className="border-t px-4 py-2 text-xs text-red-500">{err}</div> : null}
        {busy ? <div className="border-t px-4 py-2 text-xs text-muted-foreground">切换中…</div> : null}
      </div>
    </div>
  ) : null

  return (
    <>
      <div className={cn('flex min-w-0 items-center', variant === 'inline' ? 'gap-0.5' : 'gap-2')}>
        <button
          type="button"
          data-testid="model-chip"
          onClick={() => setOpen('model')}
          className={chipClass}
          title={`${selected.label} · ${selected.hint}`}
        >
          <span className="truncate">{selected.label}</span>
          <IconChevronDown className="shrink-0 opacity-50" />
        </button>
        <button
          type="button"
          data-testid="effort-chip"
          onClick={() => setOpen('effort')}
          className={chipClass}
          title={`思考 ${EFFORT_LABELS[effort]}`}
        >
          {EFFORT_LABELS[effort]}
          <IconChevronDown className="shrink-0 opacity-50" />
        </button>
      </div>
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </>
  )
}
