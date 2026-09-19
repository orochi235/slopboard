import type { Attention, Level } from './attention.ts'
import type { Backdrop } from './backdrops.ts'
import type { Lifetime } from './lifetime.ts'

/** How a question closed. `text` is empty unless it was answered. */
export type Reply = { status: 'answered' | 'dismissed' | 'expired'; text: string; at: number }

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
  /** A question the agent asked. Open while `reply` is absent; once closed it
   *  stays on the card, inert, beside its reply. `choices` absent means the
   *  answer is free text. */
  question?: string
  choices?: string[]
  reply?: Reply
  /** What `bin/slop` saw when it ran: the repository and the short commit.
   *  Absent for anything dropped in by hand. */
  repo?: string
  sha?: string
  /** Absent for a picture, which is the ordinary case. `page` means `/orig`
   *  serves an HTML file the lightbox runs; `video` means it serves a video
   *  the lightbox plays. Either way `url` is a poster of it. */
  kind?: 'page' | 'video'
  /** How many frames an animated picture plays: the wall draws the first and
   *  the lightbox plays all of them. Absent for a still, and for a video,
   *  which reports its runtime instead. */
  frames?: number
  /** How long a video runs, in ms. Absent for everything else, and for a
   *  container that declares no duration — which some `.webm` do not. */
  duration?: number
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

/** How often the daemon beats. A socket vite proxies stays open at the
 *  browser's end when the daemon dies, so the wall listens for silence. */
export const BEAT_MS = 5000

/**
 * Why the wall just made a noise. The daemon plays the sound, so only the
 * daemon knows a sound was played; this is it saying so, with where the
 * arrival came from and what it wants, for a toast on the wall.
 */
export type Alert = {
  id: string
  zone: string
  level: Level
  /** The question if there is one, else the note, else the item's name. */
  asks: string
  name: string
  repo?: string
  sha?: string
}

/**
 * What one zone overrides about itself. Every field is absent by default and
 * absent means inherit — the wall's backdrop, the wall's lifetime, the color
 * the daemon read off the project's `.hued`. A zone that has never been
 * configured has no entry at all.
 */
export type ZoneSettings = {
  /** Wins over the `.hued` color. Cleared to fall back to the project again. */
  color?: string
  backdrop?: Backdrop
  /** How long an artifact here lives when it carries no TTL of its own. A
   *  duration, or one of the two ways of being off the clock. */
  lifetime?: Lifetime
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
      /** Zone name to when it was pinned, for the zones held at the top of
       *  the wall. A zone that is not held has no entry. */
      pinnedZones: Record<string, number>
      /** Zone name to what that zone overrides. Most zones have no entry. */
      zoneSettings: Record<string, ZoneSettings>
    }
  | { type: 'zoneColors'; zoneColors: Record<string, string> }
  /** One zone's overrides, as someone just set them. An empty object means the
   *  zone went back to inheriting everything. */
  | { type: 'zoneSettings'; zone: string; settings: ZoneSettings }
  | { type: 'arrive'; item: WallItem }
  | { type: 'expire'; id: string }
  /** The item is still on the wall; it has just stopped asking to be looked at. */
  | { type: 'dismiss'; id: string }
  /** A question closed. Its flag goes with it; the question stays. */
  | { type: 'reply'; id: string; reply: Reply }
  /** Rescued, or let go again. `keptAt` is null for the second. */
  | { type: 'keep'; id: string; keptAt: number | null }
  /** A zone held at the top of the wall, or let back into the order.
   *  `pinnedAt` is null for the second. */
  | { type: 'zonePin'; zone: string; pinnedAt: number | null }
  /** The daemon played a sound for this arrival. */
  | { type: 'alert'; alert: Alert }
  /** How long an artifact lives from now on, as someone just set it. */
  | { type: 'ttl'; ttlMs: number }
  /** Nothing happened, and the daemon is still here to say so. */
  | { type: 'beat' }
