import { useStore } from '@nanostores/react'
import { useState } from 'react'

import { connectGateway, disconnectGateway } from '@/lib/gateway'
import { defaultDashboardUrl, normalizeDashboardUrl } from '@/lib/gateway-url'
import { $gatewayState } from '@/store/app'
import { $theme, applyTheme } from '@/themes'

export default function SettingsPage() {
  const gatewayState = useStore($gatewayState)
  const theme = useStore($theme)
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
            className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            onChange={e => setWsInput(e.target.value)}
            placeholder="ws://host:9119/api/ws 或 https://host"
            value={wsInput}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40" disabled={connecting} onClick={() => void onConnect()}>
            {connecting ? '连接中…' : '连接'}
          </button>
          <button className="rounded-full border bg-muted px-4 py-2 text-sm font-medium" onClick={() => { disconnectGateway(); setMsg('已断开') }}>
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
        <h2 className="text-sm font-semibold">外观</h2>
        <div className="mt-3 flex gap-2">
          {(['system','light','dark'] as const).map(m => (
            <button
              className={`rounded-full border px-4 py-2 text-sm font-medium ${theme === m ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
              key={m}
              onClick={() => applyTheme(m)}
            >
              {m === 'system' ? '跟随系统' : m === 'light' ? '浅色' : '深色'}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">关于</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          Hermes Mobile v0.1.0 · 复用 <code>apps/shared</code> 的 <code>JsonRpcGatewayClient</code>，与 desktop 同一 gateway 同一协议。首版聚焦：连接设置 + 会话列表 + 聊天/流式 + 抽屉式会话切换。后续按 desktop 增量补：主题预设、搜索、文件/终端 pane、插件。
        </p>
      </section>
    </div>
  )
}
