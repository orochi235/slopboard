import type { Attention } from './attention.ts'

export type WallItem = {
  id: string
  url: string
  origUrl: string
  zone: string
  /** The source file's own name, less its TTL segment and extension. The
   *  closest thing to a caption an agent already writes. */
  name: string
  bornAt: number
  /** Overrides the wall's default TTL. Absent means the default applies. */
  ttlMs?: number
  /** Set when the item asks to be looked at. Absent is the ordinary case. */
  attention?: Attention
  /** When it was rescued. Present means the sweeper leaves it alone and its
   *  decay is frozen at this moment. */
  keptAt?: number
  /** The source file on disk. What "copy path" puts on the clipboard, so the
   *  wall answers a question the terminal can act on. */
  path: string
  /** The badge a flagged item wears. Absent means it wears none. */
  note?: string
  /** What `bin/slop` saw when it ran: the repository and the short commit.
   *  Absent for anything dropped in by hand. */
  repo?: string
  sha?: string
  w: number
  h: number
}

export type ServerMessage =
  | {
      type: 'snapshot'
      now: number
      ttlMs: number
      items: WallItem[]
      /** Zone name to the colour of the project bound to it, where one has a
       *  `.hued`. Only the daemon can read those files. */
      zoneColors: Record<string, string>
    }
  | { type: 'zoneColors'; zoneColors: Record<string, string> }
  | { type: 'arrive'; item: WallItem }
  | { type: 'expire'; id: string }
  /** The item is still on the wall; it has just stopped asking to be looked at. */
  | { type: 'dismiss'; id: string }
  /** Rescued, or let go again. `keptAt` is null for the second. */
  | { type: 'keep'; id: string; keptAt: number | null }
