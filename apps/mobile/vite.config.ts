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
    // tailscale serve 的通用入口 https://<host>.tailfd06ff.ts.net 走这个域名进来
    // hermes-mobile.zzzoficial.com = Cloudflare Tunnel 公网入口（Access 门禁保护）
    allowedHosts: ['.ts.net', '.zzzoficial.com'],
    proxy: {
      '/_dash': {
        target: 'http://127.0.0.1:9119',
        changeOrigin: true,
        ws: true,
        rewrite: p => p.replace(/^\/_dash/, ''),
        rewriteWsOrigin: true,
      },
      '/_z3': {
        target: 'http://127.0.0.1:19119',
        changeOrigin: true,
        ws: true,
        rewrite: p => p.replace(/^\/_z3/, ''),
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
