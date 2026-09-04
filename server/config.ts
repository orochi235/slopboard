import { homedir } from 'node:os'
import { join } from 'node:path'
import { parseDuration } from '../shared/duration.ts'

const root = process.env.SLOP_ROOT ?? join(homedir(), 'slop')

export const config = {
  root,
  inbox: join(root, 'inbox'),
  cache: join(root, '.cache'),
  trash: join(root, 'trash'),
  port: Number(process.env.SLOP_PORT ?? 8787),
  ttlMs: parseDuration(process.env.SLOP_TTL ?? '24h') ?? 86_400_000,
  trashMs: 24 * 60 * 60 * 1000,
  maxEdge: 1024,
  /** Files ingested at once. Each one decodes, resizes, encodes a webp and
   *  re-encodes a full-resolution PNG, so this is the daemon's memory ceiling
   *  in practice. Overridable so the ceiling can be measured rather than
   *  argued about. */
  ingestAtOnce: Number(process.env.SLOP_INGEST_AT_ONCE ?? 3),
}
