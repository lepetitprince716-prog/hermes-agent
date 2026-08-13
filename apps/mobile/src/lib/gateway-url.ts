export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface GatewayConn {
  wsUrl: string
  authMode?: string | null
  profile?: string | null
}

/**
 * Dashboard base 解析 — 支持两种通道：
 *
 * 1. **直连**：`http://127.0.0.1:9119`（Mac 本机 / 模拟器 / 手动输入）
 * 2. **同源代理**：`/_dash`（vite 把 `/_dash/*` 反代到 loopback dashboard，
 *    真机 / Cloudflare Tunnel 零 CORS、不触发非 loopback 的 OAuth gate）
 *
 * `resolveDashboardBase()` 按序探测（显式输入 → 上次成功 → 默认直连 → 代理），
 * 首个能刮到会话 token 的 base 胜出并持久化。
 */

const PROXY_PREFIX = '/_dash'
const BASE_KEY = 'hermes-mobile-dash-base'
const URL_KEY = 'hermes-mobile-dashboard-url'
const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__="([^"]+)"/

/** 默认 dashboard 直连地址（http origin，不含路径） */
export function defaultDashboardUrl(): string {
  const stored = localStorage.getItem(URL_KEY)
  if (stored) return stored
  const host = location.hostname || '127.0.0.1'
  const resolvedHost = host === 'localhost' ? '127.0.0.1' : host
  return `http://${resolvedHost}:9119`
}

/**
 * 把用户输入归一化为 http(s) dashboard origin。
 * 支持：http(s)://host:port、host:port、ws(s)://host:port/api/ws（反向提取 origin）。
 */
export function normalizeDashboardUrl(input: string): string {
  const raw = input.trim()
  if (!raw) return defaultDashboardUrl()
  if (raw === PROXY_PREFIX || raw.startsWith(`${PROXY_PREFIX}/`)) return PROXY_PREFIX
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `${u.protocol}//${u.host}`
    }
    if (u.protocol === 'ws:' || u.protocol === 'wss:') {
      const httpProto = u.protocol === 'wss:' ? 'https' : 'http'
      return `${httpProto}://${u.host}`
    }
  } catch { /* URL 解析失败 → 走裸 host:port 分支 */ }
  return raw.match(/^[a-zA-Z0-9.-]+:\d+$/) ? `http://${raw}` : raw
}

/** 探测一个 base 是否可用：能拿到 dashboard 首页注入的会话 token 才算通 */
async function probeBase(base: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const html = await res.text()
    if (html.includes('__HERMES_AUTH_REQUIRED__=true') && !TOKEN_RE.exec(html)) {
      return null
    }
    return TOKEN_RE.exec(html)?.[1] ?? null
  } catch {
    return null
  }
}

function dedupe(list: Array<string | null | undefined>): string[] {
  const out: string[] = []
  for (const item of list) {
    if (item && !out.includes(item)) out.push(item)
  }
  return out
}

function shouldUseProxy(): boolean {
  if (typeof location === 'undefined') return false
  if (location.port === '5175' || location.port === '4175') return true
  const host = location.hostname || ''
  if (host.endsWith('.zzzoficial.com') || host.endsWith('.ts.net')) return true
  return false
}

/**
 * 解析可用 dashboard base（origin 字符串或 `/_dash` 代理前缀）。
 * 顺序：显式输入 → 上次成功的 base → 默认直连 → 同源代理。
 * vite / Cloudflare Tunnel 页面强制优先 `/_dash`，避免跨源 preflight 被 live dashboard 401。
 */
export async function resolveDashboardBase(preferred?: string): Promise<string> {
  const stored = localStorage.getItem(BASE_KEY)
  const preferProxy = shouldUseProxy()
  const explicit = preferred?.trim() ? normalizeDashboardUrl(preferred) : undefined
  const candidates = dedupe([
    explicit && explicit !== defaultDashboardUrl() ? explicit : undefined,
    preferProxy ? PROXY_PREFIX : undefined,
    stored && !(preferProxy && stored.includes(':9119')) ? stored : undefined,
    preferProxy ? undefined : defaultDashboardUrl(),
    PROXY_PREFIX,
    defaultDashboardUrl(),
  ])

  for (const base of candidates) {
    if (await probeBase(base)) {
      localStorage.setItem(BASE_KEY, base)
      return base
    }
  }

  throw new Error(
    '无法连接 dashboard：直连与 /_dash 代理均失败。确认 `hermes dashboard` 在运行；'
    + '若 dashboard 处于 gated (OAuth) 模式，移动端暂不支持',
  )
}

let _tokenCache: { base: string; token: string } | null = null

export function clearSessionTokenCache(): void {
  _tokenCache = null
}

/**
 * 获取会话 token。base 失效（网络切换 / dashboard 重启换 token）时自动全量重解析一次。
 */
export async function fetchSessionToken(base?: string, forceRefresh = false): Promise<string> {
  if (forceRefresh) {
    _tokenCache = null
    localStorage.removeItem(BASE_KEY)
  }
  const b = base ?? await resolveDashboardBase()
  if (!forceRefresh && _tokenCache?.base === b) return _tokenCache.token
  const token = await probeBase(b)
  if (token) {
    _tokenCache = { base: b, token }
    return token
  }
  localStorage.removeItem(BASE_KEY)
  _tokenCache = null
  const b2 = await resolveDashboardBase()
  const token2 = await probeBase(b2)
  if (token2) {
    _tokenCache = { base: b2, token: token2 }
    return token2
  }
  throw new Error('无法从 dashboard 获取会话 token')
}

/** 当前生效的 dashboard http base（解析成功后写入；否则默认本机直连） */
export function currentDashboardBase(): string {
  return localStorage.getItem(BASE_KEY)
    ?? localStorage.getItem(URL_KEY)
    ?? defaultDashboardUrl()
}

/**
 * dashboard REST 调用（/api/fs/* 等）：自动带 X-Hermes-Session-Token。
 * 401 时清 token 缓存重取并重试一次（dashboard 重启会轮换 token）。
 */
export async function dashboardApi<T>(path: string, init?: RequestInit): Promise<T> {
  const doFetch = async (base: string, token: string) =>
    fetch(`${base}${path}`, {
      ...init,
      headers: { 'X-Hermes-Session-Token': token, ...(init?.headers ?? {}) },
    })
  let base = await resolveDashboardBase()
  let token = await fetchSessionToken(base)
  let res = await doFetch(base, token)
  if (res.status === 401) {
    token = await fetchSessionToken(base, true)
    base = currentDashboardBase()
    res = await doFetch(base, token)
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`${res.status} ${res.statusText}${detail ? `: ${detail.slice(0, 200)}` : ''}`)
  }
  return (await res.json()) as T
}

/**
 * 解析完整 WS URL：先解析 base 再拿 token。
 * 兼容已带完整 ws 地址（直接用）；代理 base 时按当前页面 origin 拼 ws(s)。
 */
export async function resolveGatewayWsUrl(input: string): Promise<string> {
  const raw = input.trim()
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) return raw

  const base = await resolveDashboardBase(raw || undefined)
  const token = await fetchSessionToken(base)

  if (base.startsWith('/')) {
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws'
    return `${wsProto}://${location.host}${base}/api/ws?token=${encodeURIComponent(token)}`
  }

  const u = new URL(base)
  const wsProto = u.protocol === 'https:' ? 'wss' : 'ws'
  return `${wsProto}://${u.host}/api/ws?token=${encodeURIComponent(token)}`
}
