import { defaultDashboardUrl, fetchSessionToken } from '@/lib/gateway-url'

/**
 * Kanban REST client — talks to the dashboard plugin API at
 * `{dashboard}/api/plugins/kanban/*`.
 *
 * Auth: loopback dashboards inject a per-process session token into the SPA
 * HTML; we scrape it once (same trick as the gateway WS connect) and echo it
 * back via `X-Hermes-Session-Token`. On 401 the cached token is dropped and
 * refreshed once (dashboard restart rotates the token).
 */

// ---------------------------------------------------------------------------
// Types — mirror plugins/kanban/dashboard/plugin_api.py serializers
// ---------------------------------------------------------------------------

export type KanbanStatus =
  | 'triage' | 'todo' | 'scheduled' | 'ready'
  | 'running' | 'blocked' | 'review' | 'done' | 'archived'

export const KANBAN_COLUMNS: KanbanStatus[] = [
  'triage', 'todo', 'scheduled', 'ready', 'running', 'blocked', 'review', 'done',
]

export const KANBAN_COLUMN_LABELS: Record<KanbanStatus, string> = {
  triage: '分诊',
  todo: '待办',
  scheduled: '计划',
  ready: '就绪',
  running: '运行中',
  blocked: '阻塞',
  review: '评审',
  done: '完成',
  archived: '归档',
}

export interface KanbanTaskAge {
  created_age_seconds?: number | null
  started_age_seconds?: number | null
  time_to_complete_seconds?: number | null
}

export interface KanbanWarnings {
  count: number
  kinds: Record<string, number>
  latest_at: number
  highest_severity?: string | null
}

export interface KanbanTask {
  id: string
  title: string
  body?: string | null
  status: KanbanStatus
  priority: number
  assignee?: string | null
  tenant?: string | null
  created_by?: string | null
  created_at?: number | null
  started_at?: number | null
  completed_at?: number | null
  result?: string | null
  block_reason?: string | null
  latest_summary?: string | null
  age?: KanbanTaskAge
  link_counts?: { parents: number; children: number }
  comment_count?: number
  progress?: { done: number; total: number } | null
  warnings?: KanbanWarnings | null
   
  [k: string]: any
}

export interface KanbanColumn {
  name: KanbanStatus
  tasks: KanbanTask[]
}

export interface BoardResponse {
  columns: KanbanColumn[]
  tenants: string[]
  assignees: string[]
  latest_event_id: number
  now: number
}

export interface BoardInfo {
  slug: string
  name: string
  description?: string
  icon?: string
  color?: string
  is_current?: boolean
  total?: number
  counts?: Record<string, number>
  project_name?: string | null
}

export interface BoardsResponse {
  boards: BoardInfo[]
  current: string
}

export interface KanbanComment {
  id: number
  task_id: string
  author: string
  body: string
  created_at: number
}

export interface TaskDetailResponse {
  task: KanbanTask
  comments: KanbanComment[]
  events: { id: number; kind: string; created_at: number; payload?: unknown }[]
  links: { parents: string[]; children: string[] }
}

// ---------------------------------------------------------------------------
// HTTP plumbing
// ---------------------------------------------------------------------------

let cachedToken: string | null = null
let cachedTokenFor: string | null = null

async function sessionToken(dashboardUrl: string, forceRefresh = false): Promise<string> {
  if (!forceRefresh && cachedToken && cachedTokenFor === dashboardUrl) {return cachedToken}
  const token = await fetchSessionToken(dashboardUrl)
  cachedToken = token
  cachedTokenFor = dashboardUrl

  return token
}

export class KanbanApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
    this.name = 'KanbanApiError'
  }
}

async function kanbanFetch<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const base = defaultDashboardUrl()
  const token = await sessionToken(base)

  const res = await fetch(`${base}/api/plugins/kanban${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Hermes-Session-Token': token,
      ...(init.headers ?? {}),
    },
  })

  if (res.status === 401 && retry) {
    // Token rotated (dashboard restart) — refresh once and retry.
    cachedToken = null

    return kanbanFetch<T>(path, init, false)
  }

  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`

    try {
      const body = await res.json()

      if (body?.detail) {detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)}
    } catch { /* 保留默认 detail 文案 */ }

    throw new KanbanApiError(detail, res.status)
  }

  return (await res.json()) as T
}

// ---------------------------------------------------------------------------
// API surface (mobile v1 subset of plugin_api.py)
// ---------------------------------------------------------------------------

export function listBoards(): Promise<BoardsResponse> {
  return kanbanFetch<BoardsResponse>('/boards')
}

export function getBoard(boardSlug?: string): Promise<BoardResponse> {
  const q = boardSlug ? `?board=${encodeURIComponent(boardSlug)}` : ''

  return kanbanFetch<BoardResponse>(`/board${q}`)
}

export function switchBoard(slug: string): Promise<{ current: string }> {
  return kanbanFetch<{ current: string }>(`/boards/${encodeURIComponent(slug)}/switch`, { method: 'POST' })
}

export function getTask(taskId: string, boardSlug?: string): Promise<TaskDetailResponse> {
  const q = boardSlug ? `?board=${encodeURIComponent(boardSlug)}` : ''

  return kanbanFetch<TaskDetailResponse>(`/tasks/${encodeURIComponent(taskId)}${q}`)
}

export function createTask(
  payload: { title: string; body?: string; priority?: number; triage?: boolean; assignee?: string },
  boardSlug?: string,
): Promise<{ task: KanbanTask | null; warning?: string }> {
  const q = boardSlug ? `?board=${encodeURIComponent(boardSlug)}` : ''

  return kanbanFetch(`/tasks${q}`, { method: 'POST', body: JSON.stringify(payload) })
}

export function updateTask(
  taskId: string,
  payload: Partial<Pick<KanbanTask, 'status' | 'title' | 'body' | 'priority' | 'assignee' | 'block_reason'>>,
  boardSlug?: string,
): Promise<{ task: KanbanTask | null }> {
  const q = boardSlug ? `?board=${encodeURIComponent(boardSlug)}` : ''

  return kanbanFetch(`/tasks/${encodeURIComponent(taskId)}${q}`, { method: 'PATCH', body: JSON.stringify(payload) })
}

// ---------------------------------------------------------------------------
// WS /events — 实时任务事件流（替换轮询）
// 契约（plugin_api.py stream_events）：
//   ws://host/api/plugins/kanban/events?token=<session>&since=<cursor>&board=<slug?>
//   消息 {"events": [...], "cursor": n}；board 在握手时钉死，切板要重连
// ---------------------------------------------------------------------------

export interface KanbanEvent {
  id: number
  task_id: string
  run_id?: number | null
  kind: string
  created_at: number
}

export function subscribeKanbanEvents(opts: {
  board?: string | null
  onEvents: (events: KanbanEvent[]) => void
  onOpen?: () => void
}): () => void {
  let ws: WebSocket | null = null
  let closed = false
  let cursor = 0
  let attempt = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  const retry = () => {
    if (closed || timer) {return}
    const delay = [2000, 5000, 15000, 30_000][Math.min(attempt++, 3)]
    timer = setTimeout(() => { timer = null; void connect() }, delay)
  }

  const connect = async () => {
    if (closed) {return}

    try {
      const base = defaultDashboardUrl()
      const token = await sessionToken(base)
      const u = new URL(base)
      const proto = u.protocol === 'https:' ? 'wss' : 'ws'
      const q = new URLSearchParams({ token, since: String(cursor) })

      if (opts.board) {q.set('board', opts.board)}
      ws = new WebSocket(`${proto}://${u.host}/api/plugins/kanban/events?${q.toString()}`)

      ws.onopen = () => { attempt = 0; opts.onOpen?.() }

      ws.onmessage = m => {
        try {
          const data = JSON.parse(String(m.data)) as { events?: KanbanEvent[]; cursor?: number }

          if (typeof data.cursor === 'number') {cursor = data.cursor}

          if (Array.isArray(data.events) && data.events.length) {opts.onEvents(data.events)}
        } catch { /* 忽略坏帧 */ }
      }

      ws.onclose = () => { ws = null;

 if (!closed) {retry()} }

      ws.onerror = () => { try { ws?.close() } catch { /* 忽略关闭异常 */ } }
    } catch {
      retry()
    }
  }

  void connect()

  return () => {
    closed = true

    if (timer) {clearTimeout(timer)}

    try { ws?.close() } catch { /* 忽略关闭异常 */ }
  }
}
