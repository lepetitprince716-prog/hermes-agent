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

## iOS 构建（已验证：iPhone 17 模拟器跑通 + WS 连接成功）

```bash
npm run build && npx cap sync ios
# 必须用 .xcworkspace 构建（pod install 后 .xcodeproj 缺 Capacitor 模块）：
cd ios/App && xcodebuild -workspace App.xcworkspace -scheme App \
  -configuration Debug -sdk iphonesimulator \
  -destination 'platform=iOS Simulator,name=iPhone 17' -derivedDataPath build
xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch booted com.nousresearch.hermes
```

**已知坑（2026-08-10 踩过全部）**：

1. **cap CLI 报 `Cannot read properties of undefined (reading 'extract')`**：根 package.json 的
   全局 override `tar: 7.x` 与 @capacitor/cli 需要的 tar@^6 冲突（v7 的 CJS 导出没有
   `.default`，tslib `__importDefault` 解析出 undefined）。修法（当前在用）：
   ```bash
   cd node_modules/@capacitor/cli && npm install tar@6.2.1 --no-save --omit=dev
   ```
   注意：node_modules 物理修复会在下次根目录 `npm install` 后被冲掉，需要重装。
   （根 package.json 里保留了嵌套 override 声明，npm 10 目前不 nest，供未来生效。）
2. **npm 版本禁区**：repo engines 要求 `npm <11.10.0 || >=11.17.0`；homebrew node26
   自带 npm 11.12.1 在禁区内。用 `~/.hermes/node/bin/npm`（10.9.8）。
3. **模拟器连本机 dashboard 零配置**：模拟器与 Mac 共享 loopback，默认
   `http://127.0.0.1:9119` 直接通（ATS 对 localhost 豁免 + CORS allowlist 匹配
   `http://localhost` origin）。真机需在设置页填电脑 LAN IP，且 dashboard 需
   `--host 0.0.0.0`（会触发 OAuth gate，移动端首版暂不支持，建议走 Tailscale）。
4. **仓库自动更新会 `git reset --hard origin/main`**：本地 commit 会被丢弃
   （工作树直接清掉）。工作分支推 fork 备份：`git push fork HEAD:refs/heads/feat/mobile-app`。

## 当前功能

- 聊天：流式 markdown（streamdown 懒加载分包）/ 停止生成 / clarify·approval 弹窗应答
- 会话：搜索、本地置顶、自动重连（指数退避 + 前台探活僵尸连接检测）
- 看板：8 列 chips 直达 + 整宽单列滑动、任务详情/编辑/评论/移动、WS /events 实时刷新
- 设置：gateway 地址、主题（system/light/dark）
