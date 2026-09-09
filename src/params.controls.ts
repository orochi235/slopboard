import { leafAt, leafPathsOf } from '@/params.paths.ts'
import { TYPEFACES } from '@/typeface.ts'
import type { StackParams } from '@/params.ts'

export type Control =
  | { kind: 'slider'; path: string; min: number; max: number; step: number; invert?: true }
  | { kind: 'choice'; path: string; options: readonly (number | string)[] }
  | { kind: 'color'; path: string }
  | { kind: 'number'; path: string }
  | { kind: 'toggle'; path: string }

/** How many decimals `step` is written with. `0.005` is three, `10` is none. */
export function decimalsOf(step: number): number {
  const text = String(step)
  const dot = text.indexOf('.')
  return dot === -1 ? 0 : text.length - dot - 1
}

/** A slider's readout, to its step's precision — trailing zeros included, so a
 *  column is read down rather than across. Only a value too wide for the column
 *  goes exponential. */
export function formatStepped(value: number, step: number): string {
  return Math.abs(value) >= 1e6 ? value.toExponential(2) : value.toFixed(decimalsOf(step))
}

/**
 * Values stored negative and read as a magnitude. `step.z` is the only one: the
 * other two step axes are directions and take either sign, but rank steps away
 * from the camera or nowhere, so a signed range spends half its travel on
 * nothing and puts "deeper" to the left. The slider shows the depth; the sign
 * stays in the model, where a drag and the wheel nudge both already speak it.
 */
const INVERTED = new Set(['step.z'])

/** Ranges wide enough to find the answer in and narrow enough that a drag lands
 *  on one. A path with no entry gets a typed number instead of a guessed range. */
const SLIDERS: Record<string, readonly [number, number, number]> = {
  'step.x': [-0.1, 0.1, 0.001],
  'step.y': [-0.1, 0.1, 0.001],
  'step.z': [0, 0.2, 0.001],
  side: [0.02, 1, 0.005],
  'origin.x': [0, 1, 0.01],
  'origin.y': [0, 1, 0.01],
  'rot.x': [-1.5, 1.5, 0.01],
  'rot.y': [-1.5, 1.5, 0.01],
  'jitter.rot': [0, 0.5, 0.005],
  'jitter.pos': [0, 0.1, 0.001],
  shoveMs: [0, 3000, 10],
  'lod.rankCap': [1, 400, 1],
  'lod.revealHoldMs': [0, 4000, 50],
  'lod.revealFadeMs': [0, 1500, 25],
  'fade.from': [0, 1, 0.01],
  'fade.to': [0, 1, 0.01],
  'distance.from': [0, 200, 1],
  'distance.to': [0, 200, 1],
  'distance.floor': [0, 1, 0.01],
  'chips.size': [0.008, 0.12, 0.002],
  'chips.shrink': [0.1, 1, 0.01],
  'chips.inset': [0, 0.05, 0.001],
  'chips.bleed': [-0.05, 0.05, 0.001],
  'attention.pulse': [0, 1, 0.01],
  'attention.badgeSize': [0.008, 0.3, 0.002],
  'attention.hoverScale': [1, 1.5, 0.01],
  'attention.hoverEdge': [1, 4, 0.1],
  'attention.floatLift': [0, 0.4, 0.005],
  'attention.floatGap': [0, 0.1, 0.002],
  'attention.leaderWidth': [0.5, 6, 0.25],
  'menu.fan': [0, 3, 0.25],
  'menu.step': [0, 40, 1],
  'menu.swing': [0, 120, 2],
  'menu.tilt': [0, 30, 1],
  'attention.seekMs': [60, 1000, 20],
  'attention.seekReach': [1, 6, 1],
  'attention.seekPull': [0, 120, 2],
  'attention.seekPlateCost': [0, 300, 5],
  'attention.seekLineCost': [0, 400, 5],
  'attention.seekHysteresis': [0, 60, 1],
  'attention.seekStiffness': [1, 80, 1],
  'attention.seekDamping': [1, 40, 0.5],
  'zoneGrid.gap': [0, 1, 0.005],
  'zoneGrid.cols': [1, 12, 1],
  'zoneGrid.rows': [1, 12, 1],
  'camera.fovDeg': [5, 120, 1],
  'camera.standoff': [1, 60, 0.5],
  'camera.yawDeg': [-90, 90, 1],
  'camera.pitchDeg': [-90, 90, 1],
  'camera.margins': [1, 2, 0.01],
  'camera.moveMs': [0, 3000, 10],
  'nav.wheelThreshold': [5, 300, 5],
  'nav.pinchThreshold': [1, 60, 1],
  'nav.quietMs': [40, 600, 10],
  'nav.floorMs': [0, 800, 10],
  'nav.dragDepthPerNotch': [0, 0.004, 0.0001],
  'overlay.cardEdgeWidth': [0.5, 12, 0.5],
  'overlay.filterDim': [0, 1, 0.01],
  'zones.outlineWidth': [0.5, 12, 0.5],
  'zones.labelSize': [0.01, 0.6, 0.005],
  'zones.labelOffset': [-0.3, 0.3, 0.005],
  'zones.labelAlign': [0, 1, 0.01],
  'zones.backdropOpacity': [0, 1, 0.01],
  'zones.hatchSpacing': [0.002, 0.1, 0.001],
  'zones.hatchWidth': [0.0002, 0.02, 0.0002],
  'zones.hatchAngleDeg': [0, 180, 1],
  'sky.spreadDeg': [20, 160, 1],
  'sky.scale': [0.2, 8, 0.05],
  'sky.octaves': [1, 6, 1],
  'sky.intensity': [0, 1, 0.01],
  'sky.contrast': [0.5, 4, 0.05],
  'sky.starDensity': [0, 1, 0.01],
  'sky.starIntensity': [0, 1, 0.01],
  'lod.budgetBytes': [16 * 1024 * 1024, 1024 * 1024 * 1024, 16 * 1024 * 1024],
}

const CHOICES: Record<string, readonly (number | string)[]> = {
  'typeface.label': TYPEFACES,
  'typeface.badge': TYPEFACES,
  'distance.combine': ['ceiling', 'min'],
  'zones.backdrop': ['none', 'hatch', 'solid'],
  'camera.projection': ['orthographic', 'perspective'],
  'zoneGrid.orientation': ['wide', 'tall'],
  'menu.mode': ['window', 'tilt'],
}

/** `lod.3.maxRank` is a sentinel far outside any useful range, so the rule is
 *  by suffix and the out-of-range guard below is what spares it a slider. */
const BY_SUFFIX: Record<string, readonly [number, number, number]> = {
  maxRank: [0, 400, 1],
  // One entry ranges the same knob on every attention level, so a fifth level
  // needs no new control registration.
  lift: [0, 1, 0.01],
  haloWidth: [0, 12, 0.5],
  pulseAmp: [0, 0.2, 0.002],
  pulseHz: [0, 4, 0.05],
}
const EDGES = [0, 32, 128, 512] as const

/** What `<input type="color">` can round-trip: six digits, no alpha. */
const HEX = /^#[0-9a-f]{6}$/i

/** A path with its array indices dropped, so one entry ranges every element of
 *  a list whose length is the point — `camera.margins.0` asks for
 *  `camera.margins`, and a rung added later needs no second entry. */
const familyOf = (path: string) =>
  path
    .split('.')
    .filter((seg) => !/^\d+$/.test(seg))
    .join('.')

export function controlFor(path: string, value: number | string | boolean): Control {
  if (typeof value === 'boolean') return { kind: 'toggle', path }
  const choices = CHOICES[path]
  if (choices) return { kind: 'choice', path, options: choices }
  // By the value's shape rather than a list of paths, so a colour added later
  // gets a picker without being registered anywhere.
  if (typeof value === 'string') return HEX.test(value) ? { kind: 'color', path } : { kind: 'number', path }
  if (path.endsWith('.edge')) return { kind: 'choice', path, options: EDGES }

  const leaf = path.split('.').at(-1) ?? path
  const range = SLIDERS[path] ?? SLIDERS[familyOf(path)] ?? BY_SUFFIX[leaf]
  if (!range) return { kind: 'number', path }
  const [min, max, step] = range
  const invert = INVERTED.has(path)
  // A value the range cannot express would be silently clamped by the input,
  // which is how a sentinel gets destroyed by a drag that never happened.
  const shown = invert ? -value : value
  if (shown < min || shown > max) return { kind: 'number', path }
  return invert
    ? { kind: 'slider', path, min, max, step, invert }
    : { kind: 'slider', path, min, max, step }
}

export function controlsOf(params: StackParams): Control[] {
  return leafPathsOf(params).flatMap((path) => {
    const value = leafAt(params, path)
    return value === undefined ? [] : [controlFor(path, value)]
  })
}
