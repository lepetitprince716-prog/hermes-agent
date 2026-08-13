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
  const [open, setOpen] = useState<'model' | 'effort' | null>(null)
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
      if (e.key === 'Escape' && !busy) setOpen(null)
    }
    const onDown = (e: MouseEvent) => {
      if (!desktop) return
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(null)
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
    ? 'inline-flex h-8 max-w-[11rem] shrink-0 items-center gap-0.5 rounded-full px-2.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-black/[0.04] hover:text-foreground active:scale-[0.97]'
    : 'max-w-[42vw] truncate rounded-full px-3 py-1.5 text-xs font-medium'

  const menuBody = open === 'effort' ? (
    <div className="py-1">
      {EFFORTS.map(row => (
        <button
          key={row}
          type="button"
          disabled={busy}
          onClick={() => void pickEffort(row)}
          className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-black/[0.04] disabled:opacity-50"
        >
          <div className="min-w-0 flex-1">
            <div className="text-[14px] font-medium">{EFFORT_LABELS[row]}</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">{EFFORT_HINTS[row]}</div>
          </div>
          {row === effort ? <IconCheck className="mt-0.5 shrink-0 opacity-70" /> : null}
        </button>
      ))}
    </div>
  ) : (
    <div className="max-h-[60vh] overflow-y-auto py-1">
      {MODEL_GROUPS.map(group => {
        const rows = MOBILE_MODELS.filter(m => m.group === group.id)
        return (
          <section key={group.id} className="pb-1">
            <div className="px-3 pb-1 pt-2 text-[11px] text-muted-foreground">{group.title}</div>
            {rows.map(row => {
              const active = modelKey(row) === modelKey(selected)
              return (
                <button
                  key={modelKey(row)}
                  type="button"
                  disabled={busy}
                  onClick={() => void pickModel(row)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-black/[0.04] disabled:opacity-50"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px] font-medium">{row.label}</div>
                    <div className="mt-0.5 truncate text-[12px] text-muted-foreground">{row.hint}</div>
                  </div>
                  {active ? <IconCheck className="mt-0.5 shrink-0 opacity-70" /> : null}
                </button>
              )
            })}
          </section>
        )
      })}
    </div>
  )

  const popover = open && desktop ? (
    <div
      role="menu"
      className="absolute bottom-[calc(100%+8px)] right-0 z-[80] w-[280px] overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_40px_rgba(0,0,0,0.12)]"
    >
      {menuBody}
      {err ? <div className="px-3 py-2 text-xs text-red-500">{err}</div> : null}
    </div>
  ) : null

  const sheet = open && !desktop ? (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/30" onClick={() => !busy && setOpen(null)} />
      <div className="safe-bottom relative mx-auto w-full max-h-[80dvh] max-w-[560px] overflow-hidden rounded-t-3xl bg-card">
        <div className="px-4 pb-1 pt-3 text-sm font-medium">{open === 'model' ? '选择模型' : '思考深度'}</div>
        <div className="min-h-0 flex-1 overflow-y-auto">{menuBody}</div>
        {err ? <div className="px-4 py-2 text-xs text-red-500">{err}</div> : null}
      </div>
    </div>
  ) : null

  return (
    <div ref={rootRef} className="relative">
      <div className={cn('flex min-w-0 items-center', variant === 'inline' ? 'gap-0.5' : 'gap-2')}>
        <button
          type="button"
          data-testid="model-chip"
          onClick={() => setOpen(open === 'model' ? null : 'model')}
          className={chipClass}
          title={`${selected.label} · ${selected.hint}`}
        >
          <span className="truncate">{selected.label}</span>
          <IconChevronDown className="shrink-0 opacity-50" />
        </button>
        <button
          type="button"
          data-testid="effort-chip"
          onClick={() => setOpen(open === 'effort' ? null : 'effort')}
          className={chipClass}
          title={`思考 ${EFFORT_LABELS[effort]}`}
        >
          {EFFORT_LABELS[effort]}
          <IconChevronDown className="shrink-0 opacity-50" />
        </button>
      </div>
      {popover}
      {sheet && typeof document !== 'undefined' ? createPortal(sheet, document.body) : null}
    </div>
  )
}
