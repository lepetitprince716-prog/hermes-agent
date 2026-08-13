import { useStore } from '@nanostores/react'
import { useMemo, useState } from 'react'

import { applySessionModel } from '@/lib/gateway'
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
import { $currentModel, $currentProvider } from '@/store/app'

export function usePickedModel(): ModelChoice {
  const liveModel = useStore($currentModel)
  const liveProvider = useStore($currentProvider)
  return findModel(liveProvider, liveModel) ?? loadSavedModel()
}

export function ModelPicker({ sessionId }: { sessionId: string | null }) {
  const liveModel = useStore($currentModel)
  const liveProvider = useStore($currentProvider)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [draft, setDraft] = useState<ModelChoice>(() => loadSavedModel())

  const selected = useMemo(
    () => findModel(liveProvider, liveModel) ?? draft,
    [draft, liveModel, liveProvider],
  )

  const pick = async (choice: ModelChoice) => {
    setDraft(choice)
    saveModelPick(choice)
    $currentModel.set(choice.model)
    $currentProvider.set(choice.provider)
    setErr(null)
    if (!sessionId) {
      setOpen(false)
      return
    }
    setBusy(true)
    try {
      await applySessionModel(sessionId, choice.provider, choice.model)
      setOpen(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="max-w-[42vw] truncate rounded-full border bg-muted px-3 py-1.5 text-xs font-medium"
        title={`${selected.label} · ${selected.hint}`}
      >
        {selected.label}
      </button>
      {open ? (
        <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => !busy && setOpen(false)} />
          <div className="safe-bottom relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-card shadow-xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div>
                <div className="text-sm font-semibold">选择模型</div>
                <div className="text-[11px] text-muted-foreground">初版精选。不写全局默认，只改这一局。</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={busy}
                className="rounded-full bg-muted px-3 py-1 text-xs"
              >
                关闭
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
              {MODEL_GROUPS.map(group => {
                const rows = MOBILE_MODELS.filter(m => m.group === group.id)
                return (
                  <section key={group.id} className="mb-4 last:mb-0">
                    <div className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {group.title}
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {rows.map(row => {
                        const active = modelKey(row) === modelKey(selected)
                        return (
                          <button
                            key={modelKey(row)}
                            type="button"
                            disabled={busy}
                            onClick={() => void pick(row)}
                            className={cn(
                              'rounded-xl border px-3 py-2.5 text-left disabled:opacity-50',
                              active ? 'border-primary bg-primary/10' : 'bg-background',
                            )}
                          >
                            <div className="text-sm font-medium">{row.label}</div>
                            <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                              {row.hint} · {row.model}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                )
              })}
            </div>
            {err ? <div className="border-t px-4 py-2 text-xs text-red-500">{err}</div> : null}
            {busy ? <div className="border-t px-4 py-2 text-xs text-muted-foreground">切换中…</div> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}
