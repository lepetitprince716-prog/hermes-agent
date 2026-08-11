export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface GatewayConn {
  authMode?: string | null
  profile?: string | null
  wsUrl: string
}

/**
 * Dashboard base 解析 — 支持两种通道：
 *
 * 1. **直连**：`http://127.0.0.1:9119`（Mac 本机/模拟器/Tailscale 地址手动输入）
 * 2. **同源代理**：`/_dash`（vite dev/preview 把 `/_dash/*` 反代到 loopback dashboard，
 *    真机走热点/局域网时零 CORS、不触发非 loopback 绑定的 OAuth gate）
 *
 * `resolveDashboardBase()` 按序探测（显式输入 → 上次成功 → 默认直连 → 代理），
 * 首个能刮到会话 token 的 base 胜出并持久化到 localStorage。
 */

const PROXY_PREFIX = '/_dash'
const BASE_KEY = 'hermes-mobile-dash-base'
const TOKEN_RE = /window\.__HERMES_SESSION_TOKEN__="([^"]+)"/

/** 默认 dashboard 直连地址（http origin，不含路径） */
export function defaultDashboardUrl(): string {
  const stored = localStorage.getItem('hermes-mobile-dashboard-url')

  if (stored) {return stored}
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

  if (!raw) {return defaultDashboardUrl()}

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

  // bare host:port
  return raw.match(/^[a-zA-Z0-9.-]+:\d+$/) ? `http://${raw}` : raw
}

/** 探测一个 base 是否可用：能拿到 dashboard 首页注入的会话 token 才算通 */
async function probeBase(base: string, timeoutMs = 2500): Promise<string | null> {
  try {
    const res = await fetch(`${base}/`, { signal: AbortSignal.timeout(timeoutMs) })

    if (!res.ok) {return null}
    const html = await res.text()

    return TOKEN_RE.exec(html)?.[1] ?? null
  } catch {
    return null
  }
}

function dedupe(list: (string | null | undefined)[]): string[] {
  const out: string[] = []

  for (const item of list) {
    if (item && !out.includes(item)) {out.push(item)}
  }

  return out
}

/**
 * 解析可用 dashboard base（origin 字符串或 `/_dash` 代理前缀）。
 * 顺序：显式输入 → 上次成功的 base → 默认直连 → 同源代理。
 */
export async function resolveDashboardBase(preferred?: string): Promise<string> {
  const stored = localStorage.getItem(BASE_KEY)

  const candidates = dedupe([
    preferred?.trim() ? normalizeDashboardUrl(preferred) : undefined,
    stored ?? undefined,
    defaultDashboardUrl(),
    PROXY_PREFIX,
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

/**
 * 获取会话 token。base 失效（网络切换/dashboard 重启换 token）时自动全量重解析一次。
 */
export async function fetchSessionToken(base?: string): Promise<string> {
  const b = base ?? await resolveDashboardBase()
  const token = await probeBase(b)

  if (token) {return token}
  // 缓存的 base 失效：清掉重解析
  localStorage.removeItem(BASE_KEY)
  const b2 = await resolveDashboardBase()
  const token2 = await probeBase(b2)

  if (token2) {return token2}
  throw new Error('无法从 dashboard 获取会话 token')
}

/**
 * 解析完整 WS URL：先解析 base 再拿 token。
 * 兼容已带完整 ws 地址（直接用）；代理 base 时按当前页面 origin 拼 ws(s)。
 */
export async function resolveGatewayWsUrl(input: string): Promise<string> {
  const raw = input.trim()

  // 已带 token 或用户给了完整 ws 地址 → 直接用
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw
  }

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
