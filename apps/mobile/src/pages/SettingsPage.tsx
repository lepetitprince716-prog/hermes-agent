import { useState } from 'react'
import { useStore } from '@nanostores/react'
import { $gatewayState } from '@/store/app'
import { connectGateway, disconnectGateway } from '@/lib/gateway'
import { defaultDashboardUrl, normalizeDashboardUrl } from '@/lib/gateway-url'
import { $theme, $themeMode, setTheme, setThemeMode, THEME_LIST } from '@/themes'

export default function SettingsPage() {
  const gatewayState = useStore($gatewayState)
  const theme = useStore($theme)
  const themeMode = useStore($themeMode)
  const [wsInput, setWsInput] = useState(() => localStorage.getItem('hermes-mobile-dashboard-url') ?? defaultDashboardUrl())
  const [connecting, setConnecting] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const onConnect = async () => {
    const url = normalizeDashboardUrl(wsInput)
    setWsInput(url)
    setConnecting(true); setMsg(null)
    try {
      await connectGateway(url)
      setMsg('已连接')
    } catch (e) { setMsg(e instanceof Error ? e.message : String(e)) }
    finally { setConnecting(false) }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Gateway 连接</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          照抄 desktop 的 <code className="rounded bg-muted px-1">/api/ws</code> JSON-RPC。手机与电脑在同一 Wi-Fi 时填电脑的 <code className="rounded bg-muted px-1">http://&lt;电脑IP&gt;:9119</code>（自动获取会话 token 并连 WS）；用 Tailscale/内网穿透就填对应 https 地址。
        </p>
        <div className="mt-3 flex gap-2">
          <input
            value={wsInput}
            onChange={e => setWsInput(e.target.value)}
            placeholder="http://host:9119"
            className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button onClick={() => void onConnect()} disabled={connecting} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40">
            {connecting ? '连接中…' : '连接'}
          </button>
          <button onClick={() => { disconnectGateway(); setMsg('已断开') }} className="rounded-full border bg-muted px-4 py-2 text-sm font-medium">
            断开
          </button>
          <span className="text-xs text-muted-foreground">状态：{gatewayState}</span>
        </div>
        {msg ? <div className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs">{msg}</div> : null}
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border bg-muted px-2.5 py-1">默认: {defaultDashboardUrl()}</span>
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">主题</h2>
        <p className="mt-1 text-xs text-muted-foreground">与 desktop 的 Nous 主题对齐，light/dark 随系统或手动。</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {THEME_LIST.map(t => (
            <button
              key={t.name}
              onClick={() => setTheme(t.name)}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${theme.name === t.name ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          {(['system','light','dark'] as const).map(m => (
            <button
              key={m}
              onClick={() => setThemeMode(m)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium ${themeMode === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              {m === 'system' ? '跟随系统' : m === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">关于</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Hermes Mobile v0.2 · 复用 <code>apps/shared</code> 的 <code>JsonRpcGatewayClient</code>，与 desktop 同一 gateway 同一协议。已有：聊天/流式/停止、会话、项目与文件、看板、tokenstats、Nous 主题。真机走页面同源 <code>/_dash</code> 代理，不必手填 9119。后续增量：终端 pane、插件、推送。
        </p>
      </section>
    </div>
  )
}
