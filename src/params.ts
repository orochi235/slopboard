/** One LOD tier. `edge` of 0 means no texture — a flat quad in the average color. */
export type LodTier = { maxRank: number; edge: 0 | 32 | 128 | 512 }

export type Projection = 'orthographic' | 'perspective'

export type StackParams = {
  /** Per-rank offset within a pile, in world units. z is negative: away. */
  step: { x: number; y: number; z: number }
  /** Constant world side of each item's square slot. */
  side: number
  /**
   * Where a pile hangs in its cell, 0..1 on each axis. The same relative point
   * of the card meets that point of the cell, so 0,0 is top-left corner to
   * top-left corner and 0.5,0.5 is centred.
   */
  origin: { x: number; y: number }
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
  camera: {
    projection: Projection
    /** Perspective only. */
    fovDeg: number
    /** Orthographic only: how far off the wall the camera sits. Scale-neutral
     *  under an orthographic projection, so it only has to clear the deepest
     *  card the rank cap allows. */
    standoff: number
    /** Where the camera sits on its orbit around what it frames. 0,0 looks
     *  straight down -Z; yaw swings right, pitch rises. */
    yawDeg: number
    pitchDeg: number
    /** Slack around the framed box at each level. 1 is exactly framed. */
    wallMargin: number
    stackMargin: number
    /** How long a level change takes. */
    moveMs: number
  }
  /** Diagnostics drawn into the scene. Debug today, likely furniture later. */
  overlay: {
    /** Outline each zone's drawn extent. */
    zones: boolean
    /** Name each zone in the scene. */
    labels: boolean
    /** World height of a label's text. */
    labelSize: number
    /** Outline each card, so a slot's real extent is visible against its image. */
    cardEdges: boolean
  }
  lod: LodTier[]
  /** Texture byte budget. A backstop, not the thing shaping the design. */
  textureBudgetBytes: number
}

export const defaultParams: StackParams = {
  step: { x: 0.012, y: -0.012, z: -0.035 },
  side: 0.22,
  origin: { x: 0, y: 0 },
  rot: { x: -0.12, y: 0.34 },
  jitter: { rot: 0.03, pos: 0.004 },
  shoveMs: 420,
  rankCap: 200,
  fade: { from: 0.88, to: 1 },
  zoneGrid: { gap: 0.02, padding: 0.02, orientation: 'wide' },
  camera: {
    projection: 'orthographic',
    fovDeg: 35,
    standoff: 12,
    yawDeg: 0,
    pitchDeg: 0,
    wallMargin: 1.08,
    stackMargin: 1.12,
    moveMs: 520,
  },
  overlay: { zones: false, labels: false, labelSize: 0.03, cardEdges: false },
  lod: [
    { maxRank: 1, edge: 512 },
    { maxRank: 8, edge: 128 },
    { maxRank: 40, edge: 32 },
    { maxRank: Number.MAX_SAFE_INTEGER, edge: 0 },
  ],
  textureBudgetBytes: 256 * 1024 * 1024,
}
