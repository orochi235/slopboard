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
   * Small readouts standing in a corner: how old the front of a pile is, how
   * many artifacts a zone holds. Both answer a question the wall could only be
   * asked by walking up to it.
   */
  chips: {
    /** An age chip on the front card of every pile. */
    cards: boolean
    /** A count chip on every zone. */
    zones: boolean
    /** World height of a chip, whichever it is. */
    size: number
    /** What fraction of `size` a chip keeps once the view is inside a zone. A
     *  chip that held its world size would swell as the camera closed in,
     *  because the card it annotates is what gets bigger, not the note. */
    shrink: number
    /** How far the age chip sits inside its artifact's top-left corner. */
    inset: number
    /** How far a zone's count runs past the corner it marks, along the
     *  diagonal. Centered on the corner point, so zero is the straddle. */
    bleed: number
  }
  /**
   * How an item that asks to be looked at gets said. One strength drives all
   * three cues, so they cannot drift apart, and the wall reads the same
   * whether a flag is fresh or about to lapse.
   */
  attention: {
    /** Master gain over every level's pulse. Off by default: the wall earns
     *  its calm, and motion is the one cue that cannot be ignored on purpose. */
    pulse: number
    /** World height of a badge's text, like a zone label's. */
    badgeSize: number
    /** How much a flagged artifact grows under the pointer. In place: it swells
     *  where it stands rather than coming toward the camera, so hovering never
     *  reorders what is in front of what. */
    hoverScale: number
    /** What the hover multiplies its halo by. */
    hoverEdge: number
    /** Badges rise to a shelf above their zone and run a line back down to the
     *  artifact they belong to, rather than sitting welded to its top border.
     *  Welded is unreadable the moment two flagged artifacts share a pile: the
     *  nearer plate buries the deeper one. */
    float: boolean
    /** How far the lowest shelf sits above the zone's top border. Zero by
     *  default, so a pile with one flagged artifact reads exactly as it did
     *  welded and only a second plate has to climb. */
    floatLift: number
    /** Space between two plates on the same shelf. */
    floatGap: number
    /** Width of the line back to the artifact, in screen pixels. */
    leaderWidth: number
    /** Plates hunt for the emptiest part of the screen near their artifact
     *  rather than always standing on the zone's top border. */
    seek: boolean
    /** How often the hunt runs, in ms. Not every frame: the answer would
     *  change under a moving camera and the plates would crawl. */
    seekMs: number
    /** How many plate-widths out a plate may go looking. */
    seekReach: number
    /** What a plate pays per world unit of distance from its artifact, against
     *  the busyness it saves by moving. Zero makes it take the emptiest spot on
     *  screen however far away that is. */
    seekPull: number
    /** What one plate already placed costs a later one that would overlap it.
     *  Well above `seekLineCost`, because two plates on top of each other
     *  leaves neither readable, where a plate over a picture is merely untidy.
     *  This is what decides that a plate moves at all. */
    seekPlateCost: number
    /** What a plate pays for any placement that needs a line back to its
     *  artifact. Only the spot resting on the card needs none, so this is what
     *  keeps a plate welded unless moving buys more than the line costs. */
    seekLineCost: number
    /** What a plate pays per world unit it would travel from where it is now.
     *  A move is made only when what it escapes outweighs the distance, so two
     *  near-equal spots cannot trade a plate back and forth, and a long jump
     *  needs a better reason than a short one. */
    seekMove: number
    /** The spring pulling a plate toward the spot it has chosen. A plate is
     *  never moved outright: it is driven there, so a wall settling reads as
     *  motion rather than as a jump. */
    seekStiffness: number
    /** Damping on that spring. Around twice the square root of the stiffness
     *  arrives without overshooting; below that a plate bounces. */
    seekDamping: number
    /** One row per level, which is what makes a fifth level a row here rather
     *  than a change to the ingest contract. */
    levels: Record<Level, AttentionLevel>
  }
  zoneGrid: {
    gap: number
    orientation: 'wide' | 'tall'
    cols?: number
    rows?: number
    /**
     * The fewest cells the grid lays out, however few zones there are. A wall
     * with one repo writing to it otherwise hands that pile the whole
     * container, so the general view is a different size every time a zone
     * arrives or falls quiet. The spare cells draw nothing — they are room,
     * not zones — and the wall frames them so zooming out settles on one
     * framing rather than on however many piles happen to exist.
     */
    minCells: number
    /** Which way the zones run along each axis. Mirroring the placed cells
     *  rather than re-sorting the slots, so reversing an axis moves the grid
     *  and never renumbers a zone — a pile keeps the cell it has claimed. */
    reverseX: boolean
    reverseY: boolean
    /** How long a pile takes to reach a new cell, when a sort, a pin or an
     *  arriving zone reshuffles the grid. */
    moveMs: number
  }
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
    /** How far out the reset button frames the wall: the wall rung's margin
     *  it restores. A margin rather than a distance, because an orthographic
     *  camera's distance changes nothing you can see. */
    homeMargin: number
    /** How long a level change takes. */
    moveMs: number
  }
  /** Walking the hierarchy by wheel and pinch. */
  nav: {
    /** Charge a scroll must accumulate to move a rung. */
    wheelThreshold: number
    /** The same for a pinch, whose deltas run an order of magnitude smaller. */
    pinchThreshold: number
    /** A silence this long ends a wheel gesture. One gesture is worth one rung,
     *  so a flick's tail cannot walk the hierarchy behind the hand. */
    quietMs: number
    /** The least time between rungs — one rung per tick of the wheel, however
     *  hard it is spun. The gate stops a flick's tail; this paces a sustained
     *  stream and a pinch, which carries no tail to gate. */
    floorMs: number
    /** A drag begun on a card moves its pile instead of turning the wall.
     *  Turning still works from the sky and the gaps between piles. */
    dragCardSetsStep: boolean
    /** World units of depth per wheel notch while a card is being dragged. A
     *  drag can only ever reach the two axes facing the camera, so this is the
     *  way to the third without orbiting to find it. */
    dragDepthPerNotch: number
  }
  /**
   * The right-click menu's parallax, handed straight to delamin8r. Here rather
   * than in the component because the only way to judge it is to open the menu
   * and move the pointer, which is a drag rather than an edit.
   */
  menu: {
    /** `window` moves the viewpoint and leaves every box where it is, so a
     *  click lands where it was aimed. `tilt` rotates the deck under the
     *  pointer, which reads harder and moves the target while you approach. */
    mode: 'window' | 'tilt'
    /** Z between adjacent planes, px. */
    step: number
    /** How far the viewpoint swings at full deflection, px. */
    swing: number
    /** Degrees the deck turns at full deflection. `tilt` only. */
    tilt: number
  }
  /** The filter band's parallax, handed to delamin8r. It moves only while the
   *  pointer is over the band. */
  band: {
    parallax: boolean
    /** Z between adjacent planes, px. */
    step: number
    /** px. delamin8r derives this from the band's width, which leaves a stack
     *  this shallow barely moving. */
    perspective: number
    /** How far the viewpoint swings at full deflection, px. */
    swing: number
  }
  /** The faces text drawn into the scene wears. One per use rather than one
   *  for the wall: a zone name is a heading read at a distance and a badge is
   *  signage read up close, and the face that serves one need not serve the
   *  other. The DOM chrome keeps the system stack either way. */
  typeface: { label: Typeface; badge: Typeface }
  /** Diagnostics drawn into the scene. Debug today, likely furniture later. */
  overlay: {
    /** Outline each card, so a slot's real extent is visible against its image. */
    cardEdges: boolean
    /** Screen pixels. Real widths need fat lines; WebGL ignores linewidth. */
    cardEdgeWidth: number
    /** What an artifact the filter excludes fades to. Not zero: the point of
     *  dimming rather than removing is that you can still see how much you
     *  cut. It does not keep its place in the pile — excluded artifacts rank
     *  behind every kept one, so the pile closes over the gap. */
    filterDim: number
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
    /** How far the label sits outside its cell's border, in world units.
     *  Negative brings it inside. */
    labelOffset: number
    /** Where the label sits across the cell, 0..1. 0 is hard against the left
     *  border, 1 against the right — so this is what moves a turned label off
     *  the edge it climbs and across the pile. */
    labelAlign: number
    /** What fills a zone's cell behind its pile. */
    backdrop: 'none' | 'hatch' | 'solid'
    /** Borrow the colour of the project bound to a zone, where it has a
     *  `.hued`. Falls back to the palette for every zone that has none. */
    /** The zone's frame — its outline, its name and its count — in the color
     *  of the project bound to it. One switch, because three parts of one frame
     *  disagreeing about whose zone this is reads as a bug. */
    huedFrame: boolean
    huedBackdrop: boolean
    huedCardEdge: boolean
    /** Floor under a project colour's lightness. A `.hued` background is picked
     *  to sit behind an editor's text, so some are near-black — weasel's is
     *  #470013 — and unlifted they read as no colour at all on this wall. */
    huedMinLight: number
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
    /** A card whose texture has not landed yet. Sat near the sky on purpose:
     *  three's default is white, and a wall of white quads turning into
     *  pictures reads as the artifacts arriving one at a time. */
    cardBlank: string
    /** One per attention level, run near-neon: a badge competes with whatever
     *  the artifact itself is showing, and a muted plate loses. `look` sits
     *  outside the traffic-light ramp on purpose — it is not a severity, so it
     *  must not read as the low end of one, and nothing else here uses green. */
    attentionLook: string
    attentionSoon: string
    attentionUrgent: string
    attentionProblem: string
    /** Badge text. Black on every plate: they all run near-neon, and even pure
     *  red measures better against black (5.25:1) than against white (4.00:1).
     *  Renamed from `badgeInk` so a panel saved with white stops overriding it. */
    flagInk: string
    /** A corner chip: a black plate, so it reads against a picture of any
     *  color, with the clock struck in yellow so the glyph is findable at a
     *  glance and the text stays the thing being read. */
    chipFill: string
    chipIcon: string
    chipInk: string
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
  /** What each rank costs to draw, and the ceiling on all of it together. The
   *  budget lives here rather than on its own because it is the same decision
   *  read from the other end: the tiers spend, and this is the purse. */
  lod: {
    tiers: LodTier[]
    /** Texture byte budget. A backstop, not the thing shaping the design. */
    budgetBytes: number
    /** Ranks past this are not placed at all — the tier ladder's last rung.
     *  The tiers spend less on a card the deeper it sits, 512 down to an
     *  untextured quad; this is where the wall stops paying for one. */
    rankCap: number
    /** The wall stays dark on load until the front of every pile has its
     *  picture, then fades in assembled. The hold is a ceiling, not a wait:
     *  a card that never decodes must not keep the wall off. Zero shows every
     *  card the moment it is placed. */
    revealHoldMs: number
    revealFadeMs: number
  }
}

export const defaultParams: StackParams = {
  step: {
    x: -0.013,
    y: -0.009,
    z: -0.023,
  },
  side: 0.305,
  origin: {
    x: 0,
    y: 0,
  },
  rot: {
    x: -0.12,
    y: 0.34,
  },
  jitter: {
    rot: 0,
    pos: 0,
  },
  shoveMs: 420,
  fade: {
    from: 1,
    to: 0.67,
  },
  distance: {
    enabled: true,
    from: 1,
    to: 22,
    floor: 0.12,
    combine: 'ceiling',
  },
  chips: {
    cards: true,
    zones: true,
    size: 0.03,
    shrink: 0.45,
    inset: 0.006,
    bleed: 0,
  },
  attention: {
    pulse: 0,
    badgeSize: 0.026,
    hoverScale: 1.07,
    hoverEdge: 1.8,
    float: true,
    floatLift: 0,
    floatGap: 0.012,
    leaderWidth: 1.5,
    seek: true,
    seekMs: 220,
    seekReach: 3,
    seekPull: 90,
    seekPlateCost: 90,
    seekLineCost: 140,
    seekMove: 600,
    seekStiffness: 26,
    seekDamping: 10,
    levels: {
      look: {
      // A bookmark, not an alarm: findable while scanning and quiet enough
      // that a wall of them stays calm, and still enough not to nag.
        lift: 0.06,
        haloWidth: 1.5,
        pulseAmp: 0,
        pulseHz: 0,
      },
      soon: {
        lift: 0.16,
        haloWidth: 2.5,
        pulseAmp: 0.012,
        pulseHz: 0.35,
      },
      urgent: {
        lift: 0.4,
        haloWidth: 4,
        pulseAmp: 0.05,
        pulseHz: 0.9,
      },
      problem: {
        lift: 0.4,
        haloWidth: 4,
        pulseAmp: 0.05,
        pulseHz: 1.4,
      },
    },
  },
  zoneGrid: {
    gap: 0.425,
    orientation: 'wide',
    reverseX: false,
    reverseY: false,
    minCells: 4,
    moveMs: 520,
  },
  camera: {
    projection: 'orthographic',
    fovDeg: 35,
    standoff: 18,
    yawDeg: 23.8720703125,
    pitchDeg: -15.578125,
    margins: [
      1.08,
      1.12,
    ],
    homeMargin: 1.08,
    moveMs: 520,
  },
  nav: {
    wheelThreshold: 60,
    pinchThreshold: 8,
    quietMs: 90,
    floorMs: 800,
    dragCardSetsStep: true,
    dragDepthPerNotch: 0.0006,
  },
  menu: {
    mode: 'tilt',
    step: 16,
    swing: 40,
    tilt: 12,
  },
  band: {
    parallax: true,
    step: 20,
    perspective: 500,
    swing: 80,
  },
  typeface: {
    label: 'oxanium',
    badge: 'oxanium',
  },
  overlay: {
    cardEdges: false,
    cardEdgeWidth: 1,
    filterDim: 0.12,
  },
  zones: {
    outline: true,
    outlineWidth: 1.5,
    labels: true,
    labelSize: 0.05,
    labelOffset: 0.01,
    labelAlign: 0,
    backdrop: 'hatch',
    huedFrame: true,
    huedBackdrop: true,
    huedCardEdge: true,
    huedMinLight: 0.34,
    backdropOpacity: 0.69,
    hatchSpacing: 0.015,
    hatchWidth: 0.002,
    hatchAngleDeg: 46,
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
    cardBlank: '#0b1020',
    attentionLook: '#00ff00',
    attentionSoon: '#ffff00',
    attentionUrgent: '#ff8000',
    attentionProblem: '#ff0000',
    flagInk: '#000000',
    chipFill: '#000000',
    chipIcon: '#ffe58f',
    chipInk: '#ffffff',
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
  lod: {
    tiers: [
      {
        maxRank: 1,
        edge: 512,
      },
      {
        maxRank: 8,
        edge: 128,
      },
      {
        maxRank: 40,
        edge: 32,
      },
      {
        maxRank: Number.MAX_SAFE_INTEGER,
        edge: 0,
      },
    ],
    budgetBytes: 268435456,
    rankCap: 88,
    revealHoldMs: 1200,
    revealFadeMs: 250,
  },
}
