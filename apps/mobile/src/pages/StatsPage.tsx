import { useStore } from '@nanostores/react'
import { useCallback, useEffect, useState } from 'react'

import { readFileText } from '@/lib/projects'
import { cn } from '@/lib/utils'
import { $gatewayState } from '@/store/app'

/** ~/.tokenstats/summary.json 的读取子集（只取 UI 用的字段） */
interface TokenSummary {
  gen?: string
  today?: string
  today_tokens?: number
  today_cost?: number
  today_by_tool?: Record<string, [number, number]>
  total_tokens?: number
  total_cost?: number
  spark?: number[]
}

function fmtTokens(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n)
}

function fmtCost(n: number): string {
  return `$${n >= 100 ? n.toFixed(0) : n >= 1 ? n.toFixed(2) : n.toFixed(3)}`
}

const TOOL_COLORS: Record<string, string> = {
  'Claude Code': '#D97757',
  Codex: '#10A37F',
  'Grok CLI': '#5B8DEF',
  Hermes: '#0053FD',
  'DeepSeek MCP': '#7C6FF0',
}

export default function StatsPage() {
  const gatewayState = useStore($gatewayState)
  const [data, setData] = useState<TokenSummary | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      // 优先 ~/.tokenstats/summary.json（launchd 每分钟刷新）
      const home = await guessHome()
      const res = await readFileText(`${home}/.tokenstats/summary.json`)
      setData(JSON.parse(res.text) as TokenSummary)
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (gatewayState === 'open') void load()
  }, [gatewayState, load])

  const tools = Object.entries(data?.today_by_tool ?? {}).sort((a, b) => b[1][0] - a[1][0])
  const toolTotal = tools.reduce((s, [, v]) => s + v[0], 0) || 1
  const spark = data?.spark ?? []
  const sparkMax = Math.max(1, ...spark)

  return (
    <div className="flex flex-1 flex-col">
      <div className="flex items-center gap-2 border-b bg-card px-3 py-2">
        <span className="text-xs text-muted-foreground">{data?.today ?? ''}</span>
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground/70">更新 {data?.gen?.slice(11) ?? '—'}</span>
        <button onClick={() => void load()} disabled={loading} className="rounded-full border bg-muted px-3 py-1.5 text-xs font-medium disabled:opacity-40">
          {loading ? '…' : '刷新'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {err ? (
          <div className="rounded-xl border border-red-300 bg-red-500/10 p-4 text-xs text-red-500">
            {err}
            <div className="mt-1 text-muted-foreground">需要 dashboard 的 /api/fs/read-text 能读到 ~/.tokenstats/summary.json</div>
          </div>
        ) : !data ? (
          <div className="p-6 text-center text-sm text-muted-foreground">{loading ? '加载中…' : '无数据'}</div>
        ) : (
          <div className="mx-auto flex max-w-[720px] flex-col gap-3">
            {/* 大数字卡片：今日 */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="今日 TOKENS" value={fmtTokens(data.today_tokens ?? 0)} />
              <MetricCard label="今日成本" value={fmtCost(data.today_cost ?? 0)} accent />
            </div>

            {/* 工具分布 */}
            <div className="rounded-2xl border bg-card p-4">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">按工具</div>
              <div className="space-y-2">
                {tools.map(([name, [tokens, cost]]) => (
                  <div key={name}>
                    <div className="mb-0.5 flex items-baseline justify-between text-xs">
                      <span className="font-medium">{name}</span>
                      <span className="font-mono text-muted-foreground">{fmtTokens(tokens)} · {fmtCost(cost)}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(tokens / toolTotal) * 100}%`, background: TOOL_COLORS[name] ?? 'var(--dt-primary)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 14 天 spark */}
            {spark.length ? (
              <div className="rounded-2xl border bg-card p-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">近 {spark.length} 天</div>
                <div className="flex h-20 items-end gap-1">
                  {spark.map((v, i) => (
                    <div key={i} className="flex-1 rounded-sm bg-primary/80" style={{ height: `${Math.max(3, (v / sparkMax) * 100)}%` }} title={fmtTokens(v)} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* 总计 */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label="累计 TOKENS" value={fmtTokens(data.total_tokens ?? 0)} />
              <MetricCard label="累计成本" value={fmtCost(data.total_cost ?? 0)} accent />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={cn('rounded-2xl border bg-card p-4', accent && 'border-primary/30')}>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn('mt-1 font-mono text-2xl font-semibold tabular-nums', accent && 'text-primary')}>{value}</div>
    </div>
  )
}

/** 从 dashboard 侧拿 home 目录（read-text 用绝对路径；/api/fs/default-cwd 返回 cwd 可推 home） */
async function guessHome(): Promise<string> {
  // mobile 运行在本机 dashboard 场景下，HOME 环境变量在浏览器不存在；
  // 直接用已验证可用的固定路径模式：currentDashboardBase 是本机时，~ 即用户 home。
  // 简化：summary.json 的绝对路径通过 /api/fs/read-text 读取，home 取自 localStorage 缓存或常见 macOS 布局。
  const cached = localStorage.getItem('hermes-mobile-home')
  if (cached) return cached
  // 通过读取 dashboard 状态拿 hermes_home（/api/status loopback 返回 hermes_home）
  const { currentDashboardBase, fetchSessionToken } = await import('@/lib/gateway-url')
  const base = currentDashboardBase()
  const token = await fetchSessionToken(base)
  const res = await fetch(`${base}/api/status`, { headers: { 'X-Hermes-Session-Token': token } })
  const status = (await res.json()) as { hermes_home?: string }
  const home = status.hermes_home?.replace(/\/.hermes$/, '') ?? '/Users/diobrando'
  localStorage.setItem('hermes-mobile-home', home)
  return home
}
