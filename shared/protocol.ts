export type WallItem = {
  id: string
  url: string
  origUrl: string
  zone: string
  bornAt: number
  /** Overrides the wall's default TTL. Absent means the default applies. */
  ttlMs?: number
  w: number
  h: number
}

export type ServerMessage =
  | { type: 'snapshot'; now: number; ttlMs: number; items: WallItem[] }
  | { type: 'arrive'; item: WallItem }
  | { type: 'expire'; id: string }
