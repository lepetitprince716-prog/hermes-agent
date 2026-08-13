# Hermes Mobile — 照抄 apps/desktop 的 Capacitor 壳

> 技术栈：Vite + React 19 + Tailwind 4 + `apps/shared/JsonRpcGatewayClient` + Capacitor 6
> 协议：与 desktop 完全一致 — `ws(s)://host:9119/api/ws` JSON-RPC，事件 `message.delta / message.complete / tool.*` 等。

## 快速开始

```bash
# 1) 装依赖（已在 apps/mobile 内 npm install 过）
cd apps/mobile
npm run dev        # http://127.0.0.1:5175  — 桌面浏览器直接预览移动端
npm run build      # 打 dist
npm run preview    # 预览 dist

# 2) 连本机 gateway（默认 ws://127.0.0.1:9119/api/ws）
#    先起 dashboard：hermes dashboard
#    再起 mobile dev：npm run dev

# 3) 真机/模拟器（iOS/Android）
npm run cap:add:ios      # 首次：生成 ios/ 工程
npm run cap:add:android  # 首次：生成 android/ 工程
npm run build && npm run cap:sync
npm run cap:open:ios     # Xcode
npm run cap:open:android # Android Studio
```

## 核心目录

- `src/lib/gateway.ts` — 复用 `shared/JsonRpcGatewayClient`，事件分发到 nanostores
- `src/store/app.ts` — sessions / messages / gatewayState
- `src/pages/{ChatPage,SessionsPage,SettingsPage}.tsx`
- `src/lib/gateway-url.ts` — wsUrl 归一化（支持填 `https://host` 自动转 `wss://host/api/ws`）

## 手机连电脑

同一 Wi-Fi 下，把 Settings 里的 WS URL 改成 `ws://<电脑IP>:9119/api/ws`（可在电脑 `ifconfig | grep inet` 查 IP）。用 Tailscale 就填 `wss://<tailnet-host>:9119/api/ws`。

## 与 desktop 的对应关系

| desktop | mobile |
|---------|--------|
| `apps/desktop/electron` | 砍掉，用 Capacitor |
| `apps/desktop/src/hermes.ts + store/gateway.ts` | `src/lib/gateway.ts`（同 shared client） |
| `apps/desktop/src/store/session.ts` | `src/store/app.ts` |
| `chat/composer + message-stream` | `ChatPage.tsx` Composer + 流式 |
| `apps/desktop/src/themes` | `src/themes/index.ts`（先 system/light/dark，预设后续补） |

首版刻意最小可用：后续按 desktop 增量补搜索、主题预设、文件/终端 pane、插件面板、鉴权票据等。
