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
