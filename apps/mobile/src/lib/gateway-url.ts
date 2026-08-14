import { findInstance, loadInstanceToken, loadSavedInstance, type HermesInstance } from '@/lib/instances'

export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface GatewayConn {
  wsUrl: string
  authMode?: string | null
  profile?: string | null
}

const PROXY_PREFIX = '/_dash'
const BASE_KEY = 'hermes-mobile-dash-base'
const URL_KEY = 'hermes-mobile-dashboard-url'
const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__="([^"]+)"/

export function defaultDashboardUrl(): string {
  const stored = localStorage.getItem(URL_KEY)
  if (stored) return stored
  const host = location.hostname || '127.0.0.1'
  const resolvedHost = host === 'localhost' ? '127.0.0.1' : host
  return `http://${resolvedHost}:9119`
}

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
  } catch { /* fall through */ }
  return raw.match(/^[a-zA-Z0-9.-]+:\d+$/) ? `http://${raw}` : raw
}

function instanceForBase(base: string): HermesInstance {
  const saved = loadSavedInstance()
  if (normalizeDashboardUrl(saved.base) === normalizeDashboardUrl(base) || saved.base === base) return saved
  return findInstance(undefined)
}

async function scrapeHtmlToken(base: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    const html = await res.text()
    if (html.includes('__HERMES_AUTH_REQUIRED__=true') && !TOKEN_RE.exec(html)) return null
    return TOKEN_RE.exec(html)?.[1] ?? null
  } catch {
    return null
  }
}

/** Reachable if we can scrape a token, or the instance already has a saved token. */
export async function probeBase(base: string, timeoutMs = 2500): Promise<string | null> {
  const inst = instanceForBase(base)
  const scraped = await scrapeHtmlToken(base, timeoutMs)
  if (scraped) return scraped
  const saved = loadInstanceToken(inst.id)
  if (saved) {
    try {
      const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(timeoutMs) })
      if (res.ok || res.status === 401 || res.status === 403 || res.status === 404) return saved
    } catch {
      return null
    }
  }
  return null
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
 * Resolve dashboard base.
 * Pinned instance (Settings) wins. Auto-detect only when the user has not
 * chosen a remote instance — vite/tunnel still prefer `/_dash` for this Mac.
 */
export async function resolveDashboardBase(preferred?: string): Promise<string> {
  const pinned = loadSavedInstance()
  const explicit = preferred?.trim() ? normalizeDashboardUrl(preferred) : undefined

  if (explicit && explicit !== defaultDashboardUrl() && explicit !== PROXY_PREFIX) {
    const token = await probeBase(explicit)
    if (token) {
      localStorage.setItem(BASE_KEY, explicit)
      return explicit
    }
    throw new Error(`无法连接 ${explicit}`)
  }

  if (pinned.id !== 'mac') {
    const token = await probeBase(pinned.base)
    if (token) {
      localStorage.setItem(BASE_KEY, pinned.base)
      return pinned.base
    }
    throw new Error(
      pinned.id === 'z3'
        ? '无法连接 Z3。确认本机 19119 隧道已通，并在设置里填写会话令牌。'
        : `无法连接 ${pinned.label}（${pinned.base}）`,
    )
  }

  const stored = localStorage.getItem(BASE_KEY)
  const preferProxy = shouldUseProxy()
  const candidates = dedupe([
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
    '无法连接本机 dashboard。确认 `hermes dashboard` 在运行；若处于 gated (OAuth) 模式，移动端暂不支持',
  )
}

let _tokenCache: { base: string; token: string } | null = null

export function clearSessionTokenCache(): void {
  _tokenCache = null
}

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
  throw new Error('无法获取会话令牌。本机应能自动刮取；Z3 请在设置里粘贴 HERMES_DASHBOARD_SESSION_TOKEN')
}

export function currentDashboardBase(): string {
  return localStorage.getItem(BASE_KEY)
    ?? loadSavedInstance().base
    ?? defaultDashboardUrl()
}

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
