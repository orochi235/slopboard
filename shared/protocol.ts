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
  /** Absent for a picture, which is the ordinary case. `page` means `/orig`
   *  serves an HTML file the lightbox runs, and `url` is a shot of it. */
  kind?: 'page'
  /** How many frames the artifact plays, for the one kind of card whose
   *  picture is not the whole of it: the wall draws the first frame and the
   *  lightbox plays all of them. Absent for a still. */
  frames?: number
  /** What the pusher said the page may do, verbatim into the iframe's
   *  `sandbox` attribute. Absent means the wall's own default applies. */
  sandbox?: string
  /** The pixels behind the card. For a picture that is its own size, which is
   *  what `/orig` serves — not the cache thumbnail's, which is capped at
   *  `maxEdge`. For a page it is the shot's viewport, since the document has
   *  no size of its own; the two kinds differ here and nowhere else. */
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
