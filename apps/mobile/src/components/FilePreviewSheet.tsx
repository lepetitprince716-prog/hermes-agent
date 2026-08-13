import { useEffect, useRef, useState } from 'react'

import { readFileDataUrl, readFileText, writeFileText } from '@/lib/projects'

type View =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'binary'; byteSize?: number; dataUrl?: string; mimeType?: string }
  | { kind: 'text'; text: string; language?: string; byteSize?: number; truncated?: boolean }

interface FilePreviewSheetProps {
  path: string
  onClose: () => void
  onSaved?: () => void
}

export function FilePreviewSheet({ path, onClose, onSaved }: FilePreviewSheetProps) {
  const [view, setView] = useState<View>({ kind: 'loading' })
  const [draft, setDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const flashTimer = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setView({ kind: 'loading' })
    setDraft('')
    setSaveError(null)
    setSavedFlash(false)
    ;(async () => {
      try {
        const res = await readFileText(path)
        if (cancelled) return
        if (res.binary) {
          let dataUrl: string | undefined
          if (res.mimeType?.startsWith('image/')) {
            dataUrl = await readFileDataUrl(path)
            if (cancelled) return
          }
          setView({ kind: 'binary', byteSize: res.byteSize, dataUrl, mimeType: res.mimeType })
        } else {
          setDraft(res.text)
          setView({
            kind: 'text',
            text: res.text,
            language: res.language,
            byteSize: res.byteSize,
            truncated: res.truncated,
          })
        }
      } catch (e) {
        if (!cancelled) setView({ kind: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    })()
    return () => {
      cancelled = true
    }
  }, [path])

  useEffect(
    () => () => {
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
    },
    [],
  )

  const save = async () => {
    if (saving || view.kind !== 'text' || view.truncated) return
    setSaving(true)
    setSaveError(null)
    setSavedFlash(false)
    try {
      await writeFileText(path, draft)
      setSavedFlash(true)
      if (flashTimer.current !== null) window.clearTimeout(flashTimer.current)
      flashTimer.current = window.setTimeout(() => setSavedFlash(false), 2500)
      onSaved?.()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  const name = path.split('/').filter(Boolean).pop() ?? path

  const meta =
    view.kind === 'text'
      ? [view.language, view.byteSize != null ? `${view.byteSize} 字节` : null].filter(Boolean).join(' · ')
      : view.kind === 'binary' && view.byteSize != null
        ? `${view.byteSize} 字节`
        : ''

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="safe-bottom relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-card shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{name}</h2>
            <div className="truncate text-[11px] text-muted-foreground">
              {path}
              {meta ? ` · ${meta}` : ''}
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full bg-muted px-3 py-1 text-xs font-medium"
          >
            关闭
          </button>
        </div>

        {view.kind === 'loading' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            加载中…
          </div>
        ) : null}

        {view.kind === 'error' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-red-500">
            {view.message}
          </div>
        ) : null}

        {view.kind === 'binary' ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-background p-2">
            {view.dataUrl ? (
              <img src={view.dataUrl} alt={name} className="max-h-full max-w-full object-contain" />
            ) : (
              <p className="px-6 text-center text-sm text-muted-foreground">
                二进制文件
                {view.byteSize != null ? `（${view.byteSize} 字节）` : ''}，暂不支持预览
              </p>
            )}
          </div>
        ) : null}

        {view.kind === 'text' ? (
          <>
            {view.truncated ? (
              <div className="border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-600">
                ⚠️ 文件过大已截断，保存将丢失未加载部分
              </div>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                spellCheck={false}
                className="min-h-0 w-full flex-1 resize-none bg-background p-4 font-mono text-xs leading-relaxed outline-none"
              />
            </div>
            <div className="border-t px-4 py-3">
              {saveError ? (
                <div className="mb-2 text-xs text-red-500">{saveError}</div>
              ) : savedFlash ? (
                <div className="mb-2 text-xs text-emerald-500">已保存 ✓</div>
              ) : null}
              <button
                onClick={() => void save()}
                disabled={saving || view.truncated}
                className="w-full rounded-xl bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"
              >
                {saving ? '保存中…' : '保存'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
