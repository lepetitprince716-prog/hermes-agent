export type ConnectionState = 'idle' | 'connecting' | 'open' | 'closed' | 'error'

export interface GatewayConn {
  wsUrl: string
  authMode?: string | null
  profile?: string | null
}

/** 默认 dashboard 地址（http origin，不含路径） */
export function defaultDashboardUrl(): string {
  const stored = localStorage.getItem('hermes-mobile-dashboard-url')
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
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' || u.protocol === 'https:') {
      return `${u.protocol}//${u.host}`
    }
    if (u.protocol === 'ws:' || u.protocol === 'wss:') {
      const httpProto = u.protocol === 'wss:' ? 'https' : 'http'
      return `${httpProto}://${u.host}`
    }
  } catch {}
  // bare host:port
  return raw.match(/^[a-zA-Z0-9.-]+:\d+$/) ? `http://${raw}` : raw
}

/**
 * 从 dashboard 首页 HTML 提取 `__HERMES_SESSION_TOKEN__`。
 * loopback（非 gated）模式才注入；gated 模式需走 OAuth ticket（首版不支持，报错提示）。
 */
export async function fetchSessionToken(dashboardUrl: string): Promise<string> {
  const res = await fetch(`${dashboardUrl}/`)
  if (!res.ok) throw new Error(`dashboard ${res.status} ${res.statusText}`)
  const html = await res.text()
  const m = html.match(/window\.__HERMES_SESSION_TOKEN__="([^"]+)"/)
  if (!m?.[1]) {
    if (html.includes('__HERMES_AUTH_REQUIRED__=true')) {
      throw new Error('dashboard 处于 gated (OAuth) 模式，移动端首版暂不支持，请用 hermes dashboard 本地 loopback 模式')
    }
    throw new Error('无法从 dashboard 获取会话 token')
  }
  return m[1]
}

/**
 * 解析完整 WS URL：先拿 token 再拼 `ws://host:port/api/ws?token=xxx`。
 * 兼容已带完整 ws 地址（直接用）或 http origin（自动取 token）。
 */
export async function resolveGatewayWsUrl(input: string): Promise<string> {
  const raw = input.trim()
  // 已带 token 或用户给了完整 ws 地址 → 直接用
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    return raw
  }
  const dashboardUrl = normalizeDashboardUrl(raw)
  const token = await fetchSessionToken(dashboardUrl)
  const u = new URL(dashboardUrl)
  const wsProto = u.protocol === 'https:' ? 'wss' : 'ws'
  return `${wsProto}://${u.host}/api/ws?token=${encodeURIComponent(token)}`
}
