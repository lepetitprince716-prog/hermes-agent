import { useCallback, useEffect, useState } from 'react'

import {
  addComment, createTask, getTask, KANBAN_COLUMN_LABELS, type KanbanStatus,
  type TaskDetailResponse, updateTask,
} from '@/lib/kanban'
import { cn, formatRelativeTime } from '@/lib/utils'

/**
 * PATCH /tasks/:id 可设的状态（plugin_api.py update_task）：
 * - running 只能由 dispatcher claim，手动设会 400
 * - review 是只读列（worker 完成时进入），手动设会 400
 * - archived 走独立入口，移动端 v1 不提供
 */
const MOVABLE_STATUSES: KanbanStatus[] = ['triage', 'todo', 'scheduled', 'ready', 'blocked', 'done']

/** 底部弹出层容器（移动端 sheet 模式） */
function Sheet({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title: string }) {
  return (
    <div aria-modal="true" className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="safe-bottom relative flex max-h-[85dvh] flex-col rounded-t-2xl border-t bg-card shadow-xl">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-[14px] font-semibold">{title}</h2>
          <button className="rounded-full bg-muted px-3 py-1 text-xs font-medium" onClick={onClose}>关闭</button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// 任务详情 sheet：完整 body / 状态移动 / 摘要 / 评论
// ---------------------------------------------------------------------------

export function KanbanTaskSheet({
  taskId, boardSlug, onClose, onChanged,
}: {
  taskId: string
  boardSlug: string | null
  onClose: () => void
  onChanged: () => void
}) {
  const [detail, setDetail] = useState<TaskDetailResponse | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [moving, setMoving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')
  const [saving, setSaving] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commenting, setCommenting] = useState(false)

  const load = useCallback(async () => {
    try {
      setDetail(await getTask(taskId, boardSlug ?? undefined))
      setErr(null)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    }
  }, [taskId, boardSlug])

  useEffect(() => { void load() }, [load])

  const moveTo = useCallback(async (status: KanbanStatus) => {
    if (!detail || status === detail.task.status) {return}
    setMoving(true)

    try {
      await updateTask(taskId, { status }, boardSlug ?? undefined)
      await load()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setMoving(false)
    }
  }, [detail, taskId, boardSlug, load, onChanged])

  const startEdit = useCallback(() => {
    if (!detail) {return}
    setEditTitle(detail.task.title)
    setEditBody(detail.task.body ?? '')
    setEditing(true)
  }, [detail])

  const saveEdit = useCallback(async () => {
    if (!editTitle.trim() || saving) {return}
    setSaving(true)
    setErr(null)

    try {
      await updateTask(taskId, { body: editBody, title: editTitle.trim() }, boardSlug ?? undefined)
      setEditing(false)
      await load()
      onChanged()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }, [editTitle, editBody, saving, taskId, boardSlug, load, onChanged])

  const sendComment = useCallback(async () => {
    const body = commentText.trim()

    if (!body || commenting) {return}
    setCommenting(true)
    setErr(null)

    try {
      await addComment(taskId, body, boardSlug ?? undefined)
      setCommentText('')
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setCommenting(false)
    }
  }, [commentText, commenting, taskId, boardSlug, load])

  const t = detail?.task

  return (
    <Sheet onClose={onClose} title={t ? t.title : '任务详情'}>
      {err ? <div className="mb-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div> : null}
      {!t ? (
        <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>
      ) : (
        <div className="space-y-4">
          {/* 元信息 + 编辑入口 */}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded bg-muted px-1.5 py-0.5 font-mono">{t.id}</span>
            {t.assignee ? <span>@{t.assignee}</span> : <span>未指派</span>}
            {t.created_at ? <span>· 创建于 {formatRelativeTime(t.created_at)}</span> : null}
            {t.priority > 0 ? <span className="font-semibold text-amber-600">· P{t.priority}</span> : null}
            {!editing ? (
              <button
                className="ml-auto rounded-full border bg-muted px-2.5 py-0.5 text-[10px] font-medium"
                onClick={startEdit}
              >
                编辑
              </button>
            ) : null}
          </div>

          {/* 编辑表单（标题/描述） */}
          {editing ? (
            <div className="space-y-2 rounded-lg border bg-background p-3">
              <input
                className="w-full rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
                onChange={e => setEditTitle(e.target.value)}
                placeholder="标题"
                value={editTitle}
              />
              <textarea
                className="w-full resize-none rounded-lg border bg-card px-3 py-2 text-[13px] outline-none focus:border-primary"
                onChange={e => setEditBody(e.target.value)}
                placeholder="描述"
                rows={5}
                value={editBody}
              />
              <div className="flex gap-2">
                <button
                  className="flex-1 rounded-lg bg-primary py-2 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
                  disabled={!editTitle.trim() || saving}
                  onClick={() => void saveEdit()}
                >
                  {saving ? '保存中…' : '保存'}
                </button>
                <button
                  className="rounded-lg border bg-muted px-4 py-2 text-[13px] font-medium"
                  onClick={() => setEditing(false)}
                >
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {/* 状态移动 chips */}
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">移动到</div>
            <div className="flex flex-wrap gap-1.5">
              {MOVABLE_STATUSES.map(s => (
                <button
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium',
                    s === t.status
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'bg-muted active:bg-muted/60',
                  )}
                  disabled={moving || s === t.status}
                  key={s}
                  onClick={() => void moveTo(s)}
                >
                  {KANBAN_COLUMN_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {/* 正文（编辑模式下隐藏，由上方表单接管） */}
          {t.body && !editing ? (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">描述</div>
              <div className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-[13px] leading-relaxed">
                {t.body}
              </div>
            </div>
          ) : null}

          {/* 阻塞原因 / 结果 */}
          {t.block_reason ? (
            <div className="rounded-lg bg-red-500/10 p-3 text-[13px] text-red-600 dark:text-red-400">
              阻塞：{t.block_reason}
            </div>
          ) : null}
          {t.latest_summary ? (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">最新摘要</div>
              <div className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-[13px] leading-relaxed">
                {t.latest_summary}
              </div>
            </div>
          ) : null}
          {t.result ? (
            <div>
              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">结果</div>
              <div className="whitespace-pre-wrap rounded-lg border bg-background p-3 text-[13px] leading-relaxed">
                {t.result}
              </div>
            </div>
          ) : null}

          {/* 评论 + 输入 */}
          <div>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              评论{detail && detail.comments.length > 0 ? ` · ${detail.comments.length}` : ''}
            </div>
            {detail && detail.comments.length > 0 ? (
              <div className="mb-2 space-y-2">
                {detail.comments.map(c => (
                  <div className="rounded-lg border bg-background p-2.5" key={c.id}>
                    <div className="mb-1 text-[10px] text-muted-foreground">
                      {c.author} · {formatRelativeTime(c.created_at)}
                    </div>
                    <div className="whitespace-pre-wrap text-[13px]">{c.body}</div>
                  </div>
                ))}
              </div>
            ) : null}
            <div className="flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border bg-background px-3 py-2 text-[13px] outline-none focus:border-primary"
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') {void sendComment()} }}
                placeholder="写评论…"
                value={commentText}
              />
              <button
                className="shrink-0 rounded-lg bg-primary px-4 text-[13px] font-semibold text-primary-foreground disabled:opacity-40"
                disabled={!commentText.trim() || commenting}
                onClick={() => void sendComment()}
              >
                {commenting ? '…' : '发送'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// 新建任务 sheet
// ---------------------------------------------------------------------------

export function KanbanNewTaskSheet({
  boardSlug, onClose, onCreated,
}: {
  boardSlug: string | null
  onClose: () => void
  onCreated: () => void
}) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [priority, setPriority] = useState(0)
  const [triage, setTriage] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const submit = useCallback(async () => {
    if (!title.trim() || busy) {return}
    setBusy(true)
    setErr(null)

    try {
      await createTask(
        { title: title.trim(), body: body.trim() || undefined, priority, triage },
        boardSlug ?? undefined,
      )
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }, [title, body, priority, triage, busy, boardSlug, onCreated])

  return (
    <Sheet onClose={onClose} title="新任务">
      <div className="space-y-3">
        {err ? <div className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div> : null}
        <input
          autoFocus
          className="w-full rounded-lg border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
          onChange={e => setTitle(e.target.value)}
          placeholder="标题（必填）"
          value={title}
        />
        <textarea
          className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 text-[14px] outline-none focus:border-primary"
          onChange={e => setBody(e.target.value)}
          placeholder="描述（可选）"
          rows={4}
          value={body}
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">优先级</span>
          {[0, 1, 2, 3].map(p => (
            <button
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium',
                priority === p ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted',
              )}
              key={p}
              onClick={() => setPriority(p)}
            >
              P{p}
            </button>
          ))}
          <button
            className={cn(
              'ml-auto rounded-full border px-3 py-1 text-xs font-medium',
              triage ? 'border-primary bg-primary text-primary-foreground' : 'bg-muted',
            )}
            onClick={() => setTriage(v => !v)}
          >
            需分诊
          </button>
        </div>
        <button
          className="w-full rounded-lg bg-primary py-2.5 text-[14px] font-semibold text-primary-foreground disabled:opacity-40"
          disabled={!title.trim() || busy}
          onClick={() => void submit()}
        >
          {busy ? '创建中…' : '创建任务'}
        </button>
      </div>
    </Sheet>
  )
}
