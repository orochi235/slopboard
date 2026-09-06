import { leafAt, leafPathsOf } from '@/params.paths.ts'
import { TYPEFACES } from '@/typeface.ts'
import type { StackParams } from '@/params.ts'

export type Control =
  | { kind: 'slider'; path: string; min: number; max: number; step: number }
  | { kind: 'choice'; path: string; options: readonly (number | string)[] }
  | { kind: 'color'; path: string }
  | { kind: 'number'; path: string }
  | { kind: 'toggle'; path: string }

/** Ranges wide enough to find the answer in and narrow enough that a drag lands
 *  on one. A path with no entry gets a typed number instead of a guessed range. */
const SLIDERS: Record<string, readonly [number, number, number]> = {
  'step.x': [-0.1, 0.1, 0.001],
  'step.y': [-0.1, 0.1, 0.001],
  'step.z': [-0.2, 0, 0.001],
  side: [0.02, 1, 0.005],
  'origin.x': [0, 1, 0.01],
  'origin.y': [0, 1, 0.01],
  'rot.x': [-1.5, 1.5, 0.01],
  'rot.y': [-1.5, 1.5, 0.01],
  'jitter.rot': [0, 0.5, 0.005],
  'jitter.pos': [0, 0.1, 0.001],
  shoveMs: [0, 3000, 10],
  rankCap: [1, 400, 1],
  'fade.from': [0, 1, 0.01],
  'fade.to': [0, 1, 0.01],
  'distance.from': [0, 200, 1],
  'distance.to': [0, 200, 1],
  'distance.floor': [0, 1, 0.01],
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
  'nav.cooldownMs': [0, 1200, 10],
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
  // A value the range cannot express would be silently clamped by the input,
  // which is how a sentinel gets destroyed by a drag that never happened.
  if (value < min || value > max) return { kind: 'number', path }
  return { kind: 'slider', path, min, max, step }
}

export function controlsOf(params: StackParams): Control[] {
  return leafPathsOf(params).flatMap((path) => {
    const value = leafAt(params, path)
    return value === undefined ? [] : [controlFor(path, value)]
  })
}
