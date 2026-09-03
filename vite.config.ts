import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const daemon = `http://localhost:${process.env.SLOP_PORT ?? 8787}`
const proxy = { target: daemon, ws: true, changeOrigin: false }

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      // Source, not dist: windease is co-designed with this repo, and its
      // `main` points at dist, where an edit to its src is invisible until a
      // rebuild — a stale answer with no error.
      windease: fileURLToPath(new URL('../windease/src/index.ts', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    proxy: { '/img': proxy, '/orig': proxy, '/api': proxy, '/ws': proxy },
  },
})
