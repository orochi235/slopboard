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
      // Source for the same reason windease is: co-designed with this repo,
      // and its `main` points at a dist an edit does not reach.
      'reticul8r/react': fileURLToPath(new URL('../reticul8r/src/react.ts', import.meta.url)),
      reticul8r: fileURLToPath(new URL('../reticul8r/src/index.ts', import.meta.url)),
    },
  },
  server: {
    // Its own port, not vite's 5173: this machine runs several vite projects
    // and whichever starts first takes 5173. strictPort then fails loudly
    // instead of drifting to a port nobody thinks to open.
    port: Number(process.env.SLOP_CLIENT_PORT ?? 5183),
    strictPort: true,
    proxy: { '/img': proxy, '/orig': proxy, '/api': proxy, '/ws': proxy },
  },
})
