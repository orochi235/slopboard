import { leafAt, leafPathsOf } from '@/params.paths.ts'
import type { StackParams } from '@/params.ts'

export type Control =
  | { kind: 'slider'; path: string; min: number; max: number; step: number }
  | { kind: 'choice'; path: string; options: readonly (number | string)[] }
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
  'zoneGrid.gap': [0, 0.3, 0.005],
  'zoneGrid.padding': [0, 0.3, 0.005],
  'zoneGrid.cols': [1, 12, 1],
  'zoneGrid.rows': [1, 12, 1],
  'camera.fovDeg': [5, 120, 1],
  'camera.standoff': [1, 60, 0.5],
  'camera.yawDeg': [-90, 90, 1],
  'camera.pitchDeg': [-90, 90, 1],
  'camera.wallMargin': [1, 2, 0.01],
  'camera.stackMargin': [1, 2, 0.01],
  'camera.moveMs': [0, 3000, 10],
  'overlay.labelSize': [0.01, 0.4, 0.005],
  textureBudgetBytes: [16 * 1024 * 1024, 1024 * 1024 * 1024, 16 * 1024 * 1024],
}

const CHOICES: Record<string, readonly (number | string)[]> = {
  'camera.projection': ['orthographic', 'perspective'],
  'zoneGrid.orientation': ['wide', 'tall'],
}

/** `lod.3.maxRank` is a sentinel far outside any useful range, so the rule is
 *  by suffix and the out-of-range guard below is what spares it a slider. */
const BY_SUFFIX: Record<string, readonly [number, number, number]> = {
  maxRank: [0, 400, 1],
}
const EDGES = [0, 32, 128, 512] as const

export function controlFor(path: string, value: number | string | boolean): Control {
  if (typeof value === 'boolean') return { kind: 'toggle', path }
  const choices = CHOICES[path]
  if (choices) return { kind: 'choice', path, options: choices }
  if (typeof value === 'string') return { kind: 'number', path }
  if (path.endsWith('.edge')) return { kind: 'choice', path, options: EDGES }

  const leaf = path.split('.').at(-1) ?? path
  const range = SLIDERS[path] ?? BY_SUFFIX[leaf]
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
