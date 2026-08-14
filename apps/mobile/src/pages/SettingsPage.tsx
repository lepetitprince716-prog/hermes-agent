import { useState } from 'react'
import { useStore } from '@nanostores/react'
import { $gatewayError, $gatewayState, $messages, $selectedSessionId, $sessions } from '@/store/app'
import { connectGateway, disconnectGateway } from '@/lib/gateway'
import { clearSessionTokenCache } from '@/lib/gateway-url'
import {
  INSTANCES,
  loadInstanceToken,
  loadSavedInstance,
  saveInstance,
  saveInstanceToken,
  type HermesInstance,
} from '@/lib/instances'
import { $theme, $themeMode, setTheme, setThemeMode, THEME_LIST } from '@/themes'
import { cn } from '@/lib/utils'

export default function SettingsPage() {
  const gatewayState = useStore($gatewayState)
  const gatewayError = useStore($gatewayError)
  const theme = useStore($theme)
  const themeMode = useStore($themeMode)
  const [current, setCurrent] = useState<HermesInstance>(() => loadSavedInstance())
  const [token, setToken] = useState(() => loadInstanceToken(loadSavedInstance().id))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const apply = async (next: HermesInstance, nextToken = token) => {
    setBusy(true)
    setMsg(null)
    saveInstance(next.id)
    if (next.auth === 'manual-token') saveInstanceToken(next.id, nextToken)
    clearSessionTokenCache()
    $sessions.set([])
    $messages.set([])
    $selectedSessionId.set(null)
    disconnectGateway()
    try {
      await connectGateway(next.base, { force: true })
      setMsg(`已连接到 ${next.label}`)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-4 p-4">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="text-sm font-semibold">Hermes 实例</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          在本机 Mac 与 Z3 之间切换。切实例会断开当前连接并清空本页会话列表，不会改远端数据。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {INSTANCES.map(inst => (
            <button
              key={inst.id}
              type="button"
              disabled={busy}
              onClick={() => {
                setCurrent(inst)
                setToken(loadInstanceToken(inst.id))
                void apply(inst, loadInstanceToken(inst.id))
              }}
              className={cn(
                'rounded-full border px-4 py-2 text-sm font-medium disabled:opacity-40',
                current.id === inst.id ? 'bg-primary text-primary-foreground' : 'bg-muted',
              )}
            >
              {inst.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{current.hint}</p>
        {current.auth === 'manual-token' ? (
          <div className="mt-3 space-y-2">
            <label className="block text-xs font-medium text-muted-foreground">会话令牌</label>
            <input
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Z3 上 HERMES_DASHBOARD_SESSION_TOKEN 的值"
              autoComplete="off"
              spellCheck={false}
              className="w-full rounded-xl border bg-background px-3 py-2.5 font-mono text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              disabled={busy || !token.trim()}
              onClick={() => void apply(current, token)}
              className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
            >
              {busy ? '连接中…' : '保存并连接'}
            </button>
            <p className="text-[11px] leading-5 text-muted-foreground">
              Z3 跑的是无头 serve，页面刮不到令牌。在 Z3 的 Hermes 环境变量里复制
              {' '}
              <code className="rounded bg-muted px-1">HERMES_DASHBOARD_SESSION_TOKEN</code>
              ，粘到这里。令牌只存在本机浏览器。
            </p>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>状态：{gatewayState}</span>
          {gatewayError ? <span className="text-red-500">{gatewayError}</span> : null}
        </div>
        {msg ? <div className="mt-2 rounded-xl bg-muted px-3 py-2 text-xs">{msg}</div> : null}
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
          {(['system', 'light', 'dark'] as const).map(m => (
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
          Hermes Mobile v0.2 · 可在本机与 Z3 之间切换。本机走同源
          {' '}
          <code>/_dash</code>
          ；Z3 走
          {' '}
          <code>/_z3</code>
          {' '}
          → 127.0.0.1:19119。
        </p>
      </section>
    </div>
  )
}
