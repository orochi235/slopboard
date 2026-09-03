import { grid } from './grid.ts'
import { createTide } from './tide.ts'
import { createErode } from './erode.ts'
import type { Arrangement } from './types.ts'

/** Order is the cycle order under `[` / `]`. grid is the 2D control. */
export const arrangements: Arrangement[] = [grid, createTide(), createErode()]

/** One backend never cycles into the other's arrangements. */
export const arrangementsFor = (dims: 2 | 3): Arrangement[] =>
  arrangements.filter((a) => a.dims === dims)

export type {
  Arrangement,
  Arrangement2D,
  Arrangement3D,
  Camera,
  Item,
  Placement,
  Size,
  SlopChannels,
  SlopStrategy,
} from './types.ts'
