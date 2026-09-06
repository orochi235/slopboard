import type { Level } from '@shared/attention.ts'
import type { Typeface } from '@/typeface.ts'

/** One LOD tier. `edge` of 0 means no texture — a flat quad in the average color. */
export type LodTier = { maxRank: number; edge: 0 | 32 | 128 | 512 }

export type Projection = 'orthographic' | 'perspective'

/** How one attention level is drawn. */
export type AttentionLevel = {
  /** World units toward the viewer, in front of the pile's own front rank. */
  lift: number
  /** Screen pixels, like the other line widths. 0 draws no halo. */
  haloWidth: number
  /** Half the peak-to-peak scale swing. 0 is no pulse. */
  pulseAmp: number
  /** Beats per second. Urgency reads as rate before it reads as size, so this
   *  climbs with the level rather than being one rhythm for the wall. */
  pulseHz: number
}

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
  /**
   * How an item that asks to be looked at gets said. One strength drives all
   * three cues, so they cannot drift apart, and the wall reads the same
   * whether a flag is fresh or about to lapse.
   */
  attention: {
    /** World height of a badge's text, like a zone label's. */
    badgeSize: number
    /** One row per level, which is what makes a fifth level a row here rather
     *  than a change to the ingest contract. */
    levels: Record<Level, AttentionLevel>
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
  /** The face zone labels and attention badges are drawn in. Text in the scene
   *  only — the DOM chrome keeps the system stack. */
  typeface: Typeface
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
    /** World height of a label's text — its thickness, since the label is
     *  turned a quarter turn and climbs the cell's left edge. */
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
    /** One per attention level, run near-neon: a badge competes with whatever
     *  the artifact itself is showing, and a muted plate loses. `look` sits
     *  outside the traffic-light ramp on purpose — it is not a severity, so it
     *  must not read as the low end of one, and nothing else here uses green. */
    attentionLook: string
    attentionSoon: string
    attentionUrgent: string
    attentionProblem: string
    /** Badge text. The plates run near-neon, so black carries most of them and
     *  white is kept for the one plate dark enough to need it. */
    badgeInk: string
    badgeInkQuiet: string
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
  attention: {
    badgeSize: 0.026,
    levels: {
      // A bookmark, not an alarm: findable while scanning and quiet enough
      // that a wall of them stays calm, and still enough not to nag.
      look: { lift: 0.06, haloWidth: 1.5, pulseAmp: 0, pulseHz: 0 },
      soon: { lift: 0.16, haloWidth: 2.5, pulseAmp: 0.012, pulseHz: 0.35 },
      urgent: { lift: 0.4, haloWidth: 4, pulseAmp: 0.05, pulseHz: 0.9 },
      problem: { lift: 0.4, haloWidth: 4, pulseAmp: 0.05, pulseHz: 1.4 },
    },
  },
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
  typeface: 'oxanium',
  overlay: { cardEdges: false, cardEdgeWidth: 1 },
  zones: {
    outline: false,
    outlineWidth: 1.5,
    labels: false,
    labelSize: 0.075,
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
    attentionLook: '#00ff00',
    attentionSoon: '#ffff00',
    attentionUrgent: '#ff8000',
    attentionProblem: '#ff0000',
    badgeInk: '#ffffff',
    badgeInkQuiet: '#000000',
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
