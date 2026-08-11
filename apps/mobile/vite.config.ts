import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  css: { postcss: { plugins: [] } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hermes/shared': path.resolve(__dirname, '../shared/src/index.ts'),
      // 复用 desktop 的路径风格，不做过度抽象
    },
  },
  server: {
    // 0.0.0.0：手机热点/局域网可访问（真机入口 http://<Mac-IP>:5175）
    host: '0.0.0.0',
    port: 5175,
    strictPort: true,
    proxy: {
      // 同源代理到 loopback dashboard：真机无需 CORS、不触发 OAuth gate
      // （dashboard 保持 127.0.0.1 绑定，代理请求带 changeOrigin 的 Host 重写）
      '/_dash': {
        target: 'http://127.0.0.1:9119',
        changeOrigin: true,
        ws: true,
        rewrite: p => p.replace(/^\/_dash/, ''),
        // 浏览器 WS 握手带页面 Origin（LAN IP），dashboard 只收 loopback origin → 403。
        // vite 原生选项：把 WS 握手的 Origin 重写为 target（loopback）。
        // 注：http-proxy 的 headers 选项会让请求挂起，踩过，勿回退。
        rewriteWsOrigin: true,
      },
    },
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
  build: {
    chunkSizeWarningLimit: 25000,
  },
})
