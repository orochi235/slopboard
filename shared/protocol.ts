export type WallItem = {
  id: string
  url: string
  origUrl: string
  zone: string
  bornAt: number
  w: number
  h: number
}

export type ServerMessage =
  | { type: 'snapshot'; now: number; ttlMs: number; items: WallItem[] }
  | { type: 'arrive'; item: WallItem }
  | { type: 'expire'; id: string }
