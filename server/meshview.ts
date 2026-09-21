import express, { type Express } from 'express'
import { resolve, dirname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MESH_VIEW } from '@shared/mesh.ts'
import { config } from './config.ts'

const here = dirname(fileURLToPath(import.meta.url))
const three = resolve(here, '../node_modules/three')

/**
 * The page a mesh is postered from: three over an import map, the viewer, and
 * the constants the lightbox reads from `shared/mesh.ts` inlined, because the
 * viewer is served as plain JavaScript and cannot import typescript.
 */
const page = `<!doctype html>
<meta charset="utf-8">
<title>mesh</title>
<style>html,body{margin:0;height:100%;background:transparent;overflow:hidden}canvas{display:block}</style>
<script type="importmap">
${JSON.stringify({ imports: { three: '/view/three/build/three.module.js', 'three/addons/': '/view/three/examples/jsm/' } }, null, 2)}
</script>
<script>window.__MESH_VIEW__ = ${JSON.stringify(MESH_VIEW)}</script>
<script type="module" src="/view/mesh/viewer.js"></script>
`

/** Under the wall's own directories and nowhere else. The viewer asks for a
 *  path rather than an id because a mesh is postered during ingest, before the
 *  store has ever heard of it — so this route, and not the store, is what keeps
 *  it from being pointed at an arbitrary file. */
export function held(path: string): boolean {
  const full = resolve(path)
  return [config.inbox, config.cache].some((dir) => full.startsWith(resolve(dir) + sep))
}

/** Where the poster shot is pointed. Loopback by address, so the shot does not
 *  wait on a name lookup that may answer with the other family. */
export const meshViewUrl = (source: string): string =>
  `http://127.0.0.1:${config.port}/view/mesh?src=${encodeURIComponent(source)}`

export function mountMeshView(app: Express): void {
  app.get('/view/mesh', (_req, res) => {
    res.type('html').send(page)
  })

  app.get('/view/mesh/viewer.js', (_req, res) => {
    res.type('js').sendFile(resolve(here, 'meshview.client.js'))
  })

  app.get('/view/mesh/file', (req, res) => {
    const src = String(req.query.src ?? '')
    if (!src || !held(src)) return void res.sendStatus(404)
    res.sendFile(resolve(src), { dotfiles: 'allow' })
  })

  app.use('/view/three', express.static(three))
}
