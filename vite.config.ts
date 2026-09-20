import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// Source, not dist, for a sibling checkout: windease and delamin8r are
// co-designed with this repo, and each `main` points at a dist an edit to its
// src does not reach — a stale answer with no error. A clone with no siblings
// falls through to the published package in node_modules.
const sibling = (name: string, entries: Record<string, string>) => {
  const root = new URL(`../${name}/`, import.meta.url)
  if (!existsSync(fileURLToPath(root))) return {}
  return Object.fromEntries(
    Object.entries(entries).map(([from, to]) => [from, fileURLToPath(new URL(to, root))]),
  )
}

const daemon = `http://localhost:${process.env.SLOP_PORT ?? 8787}`
const proxy = { target: daemon, ws: true, changeOrigin: false }

export default defineConfig({
  plugins: [react()],
  // A literal, not a lookup on `import.meta.env`: rollup has to see `false`
  // to drop the demo branch, and with it the daemon and forty pictures. An
  // env var read at runtime keeps all of it in the ordinary bundle.
  define: { __SLOP_DEMO__: JSON.stringify(process.env.VITE_SLOP_DEMO === '1') },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      ...sibling('windease', { windease: 'src/index.ts' }),
      ...sibling('delamin8r', {
        'delamin8r/react': 'src/react.ts',
        delamin8r: 'src/index.ts',
      }),
    },
  },
  server: {
    // Its own port, not vite's 5173: this machine runs several vite projects
    // and whichever starts first takes 5173. strictPort then fails loudly
    // instead of drifting to a port nobody thinks to open.
    port: Number(process.env.SLOP_CLIENT_PORT ?? 5183),
    // Both address families. Left unset, node binds whatever the resolver
    // returns for `localhost` first — here `::1` — and the IPv4 loopback then
    // refuses, so the port is plainly listening and the page will not load.
    // `::` is the only value that answers on both: `0.0.0.0` is IPv4 only.
    host: '::',
    strictPort: true,
    proxy: { '/img': proxy, '/orig': proxy, '/page': proxy, '/api': proxy, '/ws': proxy },
  },
})
