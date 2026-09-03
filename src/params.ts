/** One LOD tier. `edge` of 0 means no texture — a flat quad in the average color. */
export type LodTier = { maxRank: number; edge: 0 | 32 | 128 | 512 }

export type StackParams = {
  /** Per-rank offset within a pile, in world units. z is negative: away. */
  step: { x: number; y: number; z: number }
  /** Constant world side of each item's square slot. */
  side: number
  /** Constant card angles, radians. */
  rot: { x: number; y: number }
  /** Deterministic per-id jitter, radians and world units. */
  jitter: { rot: number; pos: number }
  /** How long a rank change takes to animate. */
  shoveMs: number
  /** Ranks past this are not placed at all. */
  rankCap: number
  /** age01 window over which an item fades out. */
  fade: { from: number; to: number }
  zoneGrid: { gap: number; padding: number; orientation: 'wide' | 'tall'; cols?: number; rows?: number }
  camera: { fovDeg: number }
  lod: LodTier[]
  /** Texture byte budget. A backstop, not the thing shaping the design. */
  textureBudgetBytes: number
}

export const defaultParams: StackParams = {
  step: { x: 0.012, y: -0.012, z: -0.035 },
  side: 0.22,
  rot: { x: -0.12, y: 0.34 },
  jitter: { rot: 0.03, pos: 0.004 },
  shoveMs: 420,
  rankCap: 200,
  fade: { from: 0.88, to: 1 },
  zoneGrid: { gap: 0.02, padding: 0.02, orientation: 'wide' },
  camera: { fovDeg: 35 },
  lod: [
    { maxRank: 1, edge: 512 },
    { maxRank: 8, edge: 128 },
    { maxRank: 40, edge: 32 },
    { maxRank: Number.MAX_SAFE_INTEGER, edge: 0 },
  ],
  textureBudgetBytes: 256 * 1024 * 1024,
}
