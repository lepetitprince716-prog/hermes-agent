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
    host: '127.0.0.1',
    port: 5175,
    strictPort: true,
  },
  preview: {
    host: '127.0.0.1',
    port: 4175,
  },
  build: {
    chunkSizeWarningLimit: 25000,
  },
})
