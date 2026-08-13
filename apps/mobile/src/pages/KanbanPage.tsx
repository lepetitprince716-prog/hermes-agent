import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useRef, useState } from 'react'

import { KanbanNewTaskSheet, KanbanTaskSheet } from '@/components/KanbanSheets'
import {
  getBoard, KANBAN_COLUMN_LABELS, type KanbanStatus, type KanbanTask, listBoards,
  subscribeKanbanEvents, switchBoard,
} from '@/lib/kanban'
import { cn, formatRelativeTime } from '@/lib/utils'
import {
  $kanbanBoards, $kanbanColumns, $kanbanCurrentBoard, $kanbanError, $kanbanLoading, $kanbanRefreshedAt,
} from '@/store/kanban'

/** 列头颜色（跟 desktop 看板语义一致） */
const COLUMN_ACCENT: Record<KanbanStatus, string> = {
  triage: 'bg-zinc-400',
  todo: 'bg-sky-500',
  scheduled: 'bg-violet-500',
  ready: 'bg-cyan-500',
  running: 'bg-amber-500',
  blocked: 'bg-red-500',
  review: 'bg-indigo-500',
  done: 'bg-emerald-500',
  archived: 'bg-zinc-300',
}

export default function KanbanPage() {
  const boards = useStore($kanbanBoards)
  const current = useStore($kanbanCurrentBoard)
  const columns = useStore($kanbanColumns)
  const loading = useStore($kanbanLoading)
  const err = useStore($kanbanError)
  const [selectedTask, setSelectedTask] = useState<KanbanTask | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [activeCol, setActiveCol] = useState(0)
  const columnsRef = useRef<HTMLDivElement | null>(null)
  const chipsRef = useRef<HTMLDivElement | null>(null)
  const scrollRaf = useRef(0)
  const didInitialScroll = useRef(false)

  /** 滑动列区域 → 反推当前列索引，同步 chips 高亮 */
  const onColumnsScroll = useCallback(() => {
    cancelAnimationFrame(scrollRaf.current)
    scrollRaf.current = requestAnimationFrame(() => {
      const c = columnsRef.current

      if (!c) {return}
      const center = c.scrollLeft + c.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      Array.from(c.children).forEach((el, i) => {
        const h = el as HTMLElement
        const d = Math.abs(h.offsetLeft + h.offsetWidth / 2 - center)

        if (d < bestDist) { bestDist = d; best = i }
      })
      setActiveCol(best)
    })
  }, [])

  /** 点 chip → 平滑滚到对应列 */
  const scrollToColumn = useCallback((i: number) => {
    const c = columnsRef.current
    const target = c?.children[i] as HTMLElement | undefined

    if (!c || !target) {return}
    c.scrollTo({ left: target.offsetLeft - (c.clientWidth - target.offsetWidth) / 2, behavior: 'smooth' })
    setActiveCol(i)
  }, [])

  // 滑动时让高亮 chip 保持在可见区域
  useEffect(() => {
    const chip = chipsRef.current?.children[activeCol] as HTMLElement | undefined
    chip?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [activeCol])

  // 首次加载后滚到第一个非空列（看板默认停在 triage，有任务的列常在最右）
  useEffect(() => {
    if (didInitialScroll.current || columns.length === 0) {return}
    const firstNonEmpty = columns.findIndex(c => c.tasks.length > 0)

    if (firstNonEmpty <= 0) {return}
    didInitialScroll.current = true
    const container = columnsRef.current
    const target = container?.children[firstNonEmpty] as HTMLElement | undefined

    if (container && target) {
      container.scrollTo({ left: target.offsetLeft - (container.clientWidth - target.offsetWidth) / 2 })
    }

    setActiveCol(firstNonEmpty)
  }, [columns])

  const refresh = useCallback(async (boardSlug?: string | null) => {
    $kanbanLoading.set(true)
    $kanbanError.set(null)

    try {
      const slug = boardSlug !== undefined ? boardSlug : $kanbanCurrentBoard.get()
      const data = await getBoard(slug ?? undefined)
      $kanbanColumns.set(data.columns)
      $kanbanRefreshedAt.set(Math.floor(Date.now() / 1000))
    } catch (e) {
      $kanbanError.set(e instanceof Error ? e.message : String(e))
    } finally {
      $kanbanLoading.set(false)
    }
  }, [])

  const refreshBoards = useCallback(async () => {
    try {
      const data = await listBoards()
      $kanbanBoards.set(data.boards)
      $kanbanCurrentBoard.set(data.current)

      return data.current
    } catch (e) {
      $kanbanError.set(e instanceof Error ? e.message : String(e))

      return null
    }
  }, [])

  // 首次加载：先拿 boards 再拉当前看板
  useEffect(() => {
    void (async () => {
      const cur = await refreshBoards()
      await refresh(cur)
    })()
  }, [refresh, refreshBoards])

  // 实时事件流（替换轮询）：看板有变动时 600ms 防抖刷新；断线自动重连（cursor 续传）
  useEffect(() => {
    if (!current) {return}
    let refreshTimer: ReturnType<typeof setTimeout> | null = null

    const unsub = subscribeKanbanEvents({
      board: current,
      onOpen: () => void refresh(),
      onEvents: () => {
        if (refreshTimer) {return}
        refreshTimer = setTimeout(() => { refreshTimer = null; void refresh() }, 600)
      },
    })

    return () => {
      if (refreshTimer) {clearTimeout(refreshTimer)}
      unsub()
    }
  }, [current, refresh])

  const onSwitchBoard = useCallback(async (slug: string) => {
    if (slug === current) {return}
    $kanbanCurrentBoard.set(slug)
    void refresh(slug)
    // 异步把 dashboard 侧的 current 也切过去（失败不影响本地视图）
    switchBoard(slug).catch(() => {})
  }, [current, refresh])

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* 工具栏：board chips + 操作 */}
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <div className="flex flex-1 items-center gap-1.5 overflow-x-auto scrollbar-none">
          {boards.length === 0 ? (
            <span className="text-xs text-muted-foreground">{loading ? '加载中…' : '无看板'}</span>
          ) : boards.map(b => (
            <button
              className={cn(
                'shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium',
                b.slug === current
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
              key={b.slug}
              onClick={() => void onSwitchBoard(b.slug)}
            >
              {b.name || b.slug}{typeof b.total === 'number' ? ` · ${b.total}` : ''}
            </button>
          ))}
        </div>
        <button
          className="shrink-0 rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40"
          disabled={loading}
          onClick={() => { void refreshBoards().then(cur => refresh(cur)) }}
        >
          {loading ? '…' : '刷新'}
        </button>
        <button
          className="shrink-0 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
          onClick={() => setShowNew(true)}
        >
          ＋
        </button>
      </div>

      {err ? (
        <div className="border-b bg-red-500/10 px-3 py-2 text-xs text-red-500">{err}</div>
      ) : null}

      {/* 状态 chips：一屏看全 8 列计数，点按直达（与下方滑动双向同步） */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b bg-card px-3 py-2 scrollbar-none" ref={chipsRef}>
        {columns.map((col, i) => (
          <button
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11px] font-medium',
              i === activeCol
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground',
            )}
            key={col.name}
            onClick={() => scrollToColumn(i)}
          >
            <span className={cn('size-1.5 rounded-full', COLUMN_ACCENT[col.name], col.name === 'running' && col.tasks.length > 0 && 'animate-pulse')} />
            {KANBAN_COLUMN_LABELS[col.name] ?? col.name}
            <span className={cn('font-semibold', i === activeCol ? 'text-primary-foreground' : 'text-foreground')}>
              {col.tasks.length}
            </span>
          </button>
        ))}
      </div>

      {/* 整宽单列视图：左右滑动切换列（snap 定位） */}
      <div
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto"
        onScroll={onColumnsScroll}
        ref={columnsRef}
      >
        {columns.map(col => (
          <section
            className="flex w-full shrink-0 snap-center flex-col"
            key={col.name}
          >
            <div className="flex-1 space-y-2 overflow-y-auto p-3">
              {col.tasks.length === 0 ? (
                <div className="py-10 text-center text-[11px] text-muted-foreground/60">空</div>
              ) : col.tasks.map(t => (
                <TaskCard key={t.id} onOpen={() => setSelectedTask(t)} task={t} />
              ))}
            </div>
          </section>
        ))}
        {columns.length === 0 && !loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            {err ? '加载失败，点刷新重试' : '暂无数据'}
          </div>
        ) : null}
      </div>

      {selectedTask ? (
        <KanbanTaskSheet
          boardSlug={current}
          onChanged={() => void refresh()}
          onClose={() => setSelectedTask(null)}
          taskId={selectedTask.id}
        />
      ) : null}
      {showNew ? (
        <KanbanNewTaskSheet
          boardSlug={current}
          onClose={() => setShowNew(false)}
          onCreated={() => { setShowNew(false); void refresh() }}
        />
      ) : null}
    </div>
  )
}

function TaskCard({ task, onOpen }: { task: KanbanTask; onOpen: () => void }) {
  const warn = task.warnings

  return (
    <button
      className="w-full rounded-lg border bg-background p-2 text-left shadow-sm active:bg-muted/60"
      onClick={onOpen}
    >
      <div className="line-clamp-2 text-[13px] font-medium leading-snug">{task.title}</div>
      {task.latest_summary ? (
        <div className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-muted-foreground">
          {task.latest_summary}
        </div>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
          {task.id}
        </span>
        {task.assignee ? (
          <span className="rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[9px] font-medium text-sky-600 dark:text-sky-400">
            @{task.assignee}
          </span>
        ) : null}
        {task.priority > 0 ? (
          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600 dark:text-amber-400">
            P{task.priority}
          </span>
        ) : null}
        {warn ? (
          <span className={cn(
            'rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
            warn.highest_severity === 'critical' || warn.highest_severity === 'high'
              ? 'bg-red-500/15 text-red-600 dark:text-red-400'
              : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
          )}>
            ⚠ {warn.count}
          </span>
        ) : null}
        {task.progress ? (
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground">
            {task.progress.done}/{task.progress.total}
          </span>
        ) : null}
        {(task.comment_count ?? 0) > 0 ? (
          <span className="text-[9px] text-muted-foreground">💬 {task.comment_count}</span>
        ) : null}
        <span className="ml-auto text-[9px] text-muted-foreground/70">
          {formatRelativeTime(task.created_at)}
        </span>
      </div>
    </button>
  )
}
