import { homedir } from 'node:os'
import { join } from 'node:path'

const root = process.env.SLOP_ROOT ?? join(homedir(), 'slop')

export const config = {
  root,
  inbox: join(root, 'inbox'),
  cache: join(root, '.cache'),
  trash: join(root, 'trash'),
  port: Number(process.env.SLOP_PORT ?? 8787),
  ttlMs: Number(process.env.SLOP_TTL ?? 300) * 1000,
  trashMs: 24 * 60 * 60 * 1000,
  maxEdge: 1024,
}
