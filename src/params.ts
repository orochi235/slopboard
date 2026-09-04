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
  /**
   * Presence falling off with depth, which is the other half of what the LOD
   * tiers already do: detail drops with rank, and without this luminance does
   * not, so a buried card reads as blocky and loud at once.
   */
  distance: {
    /** Off is the wall before this existed: depth changes detail and nothing else. */
    enabled: boolean
    /**
     * Rank window over which presence falls from full to `floor`. Ranks rather
     * than world z, so the window holds its meaning while `step.z` is tuned.
     */
    from: number
    to: number
    /** Where the tail settles. Never 0: an invisible tail is a shorter pile. */
    floor: number
    /**
     * How the falloff meets the temporal fade. Both take a fully expired card
     * to nothing; they disagree while one is running. `ceiling` scales age's
     * presence by depth's, so the two compound and a deep old card is dimmer
     * than either alone. `min` takes whichever is dimmer, so a deep card holds
     * at the floor and ignores its fade until age drops past it.
     */
    combine: 'ceiling' | 'min'
  }
  zoneGrid: { gap: number; orientation: 'wide' | 'tall'; cols?: number; rows?: number }
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
    /** Slack around the framed box, one entry per rung from the wall down; the
     *  last entry serves every rung past it, so a deeper hierarchy costs no new
     *  parameter. 1 is exactly framed. */
    margins: number[]
    /** How long a level change takes. */
    moveMs: number
  }
  /** Walking the hierarchy by wheel and pinch. */
  nav: {
    /** Charge a scroll must accumulate to move a rung. */
    wheelThreshold: number
    /** The same for a pinch, whose deltas run an order of magnitude smaller. */
    pinchThreshold: number
    /** Dead time after a step. Momentum scrolling keeps delivering for most of
     *  a second, and without this one flick walks the whole hierarchy. */
    cooldownMs: number
  }
  /** Diagnostics drawn into the scene. Debug today, likely furniture later. */
  overlay: {
    /** Outline each card, so a slot's real extent is visible against its image. */
    cardEdges: boolean
    /** Screen pixels. Real widths need fat lines; WebGL ignores linewidth. */
    cardEdgeWidth: number
  }
  /** How a zone presents itself, beyond the cards standing in it. */
  zones: {
    /** Outline each zone's drawn extent. */
    outline: boolean
    /** Screen pixels, like the card outline's. */
    outlineWidth: number
    /** Name each zone in the scene. */
    labels: boolean
    /** World height of a label's text. */
    labelSize: number
    /** What fills a zone's cell behind its pile. */
    backdrop: 'none' | 'hatch' | 'solid'
    /** Borrow the colour of the project bound to a zone, where it has a
     *  `.hued`. Falls back to the palette for every zone that has none. */
    huedOutline: boolean
    huedLabel: boolean
    huedBackdrop: boolean
    huedCardEdge: boolean
    /** 0 is invisible, 1 is flat. */
    backdropOpacity: number
    /** World distance between hatch lines, and how wide a line is. Both are
     *  world units rather than cell fractions, so the hatch reads at one
     *  density across the wall however the cells are sized. */
    hatchSpacing: number
    hatchWidth: number
    hatchAngleDeg: number
  }
  /**
   * A cosmetic layer behind everything. Decoration, so the one constraint is
   * that it must not compete with the cards: they are the content and most of
   * them are dark.
   */
  sky: {
    enabled: boolean
    /** Degrees of sky across the screen's height. Not the camera's own fov: an
     *  orthographic camera's rays are parallel, so borrowing the projection
     *  would sample one direction and paint the screen flat. */
    spreadDeg: number
    /** Cycles of the first noise octave across a radian of sky. */
    scale: number
    octaves: number
    /** Ceiling on how far the glow travels from the base colour. */
    intensity: number
    /** Pulls the clouds away from the empty sky between them. */
    contrast: number
    starDensity: number
    starIntensity: number
  }
  /**
   * Every colour the wall picks, in one place so a theme has one surface to
   * drive. Alpha variants are derived in CSS with `color-mix`, so one entry
   * here covers all of its uses rather than one entry per declaration.
   */
  colors: {
    /** Drawn into the scene, and turning with it. */
    cardEdge: string
    zoneIdle: string
    zoneFocus: string
    zoneBackdrop: string
    label: string
    /** The empty sky, and the nebula the glow reaches toward. Stars derive
     *  from the glow rather than earning a third entry. */
    skyBase: string
    skyGlow: string
    /** The DOM chrome: panel, HUD, plan view, lightbox. */
    bg: string
    scrim: string
    ink: string
    muted: string
    accent: string
    danger: string
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
  distance: { enabled: true, from: 1, to: 22, floor: 0.12, combine: 'ceiling' },
  zoneGrid: { gap: 0.02, orientation: 'wide' },
  camera: {
    projection: 'orthographic',
    fovDeg: 35,
    standoff: 12,
    yawDeg: 0,
    pitchDeg: 0,
    margins: [1.08, 1.12],
    moveMs: 520,
  },
  nav: { wheelThreshold: 60, pinchThreshold: 8, cooldownMs: 320 },
  overlay: { cardEdges: false, cardEdgeWidth: 1 },
  zones: {
    outline: false,
    outlineWidth: 1.5,
    labels: false,
    labelSize: 0.03,
    backdrop: 'hatch',
    huedOutline: false,
    huedLabel: false,
    huedBackdrop: false,
    huedCardEdge: false,
    backdropOpacity: 0.14,
    hatchSpacing: 0.014,
    hatchWidth: 0.001,
    hatchAngleDeg: 45,
  },
  sky: {
    enabled: true,
    spreadDeg: 90,
    scale: 1.6,
    octaves: 4,
    intensity: 0.45,
    contrast: 1.7,
    starDensity: 0.35,
    starIntensity: 0.5,
  },
  colors: {
    cardEdge: '#22d3ee',
    zoneIdle: '#64748b',
    zoneFocus: '#38bdf8',
    zoneBackdrop: '#64748b',
    label: '#e2e8f0',
    skyBase: '#05060a',
    skyGlow: '#2b3f6b',
    bg: '#0a0a0c',
    scrim: '#000000',
    ink: '#e2e8f0',
    muted: '#94a3b8',
    accent: '#38bdf8',
    danger: '#e0796b',
  },
  lod: [
    { maxRank: 1, edge: 512 },
    { maxRank: 8, edge: 128 },
    { maxRank: 40, edge: 32 },
    { maxRank: Number.MAX_SAFE_INTEGER, edge: 0 },
  ],
  textureBudgetBytes: 256 * 1024 * 1024,
}
