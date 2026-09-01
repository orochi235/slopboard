import { grid } from './grid.ts'
import { createTide } from './tide.ts'
import { createErode } from './erode.ts'
import type { Arrangement } from './types.ts'

/** Order is the cycle order under `[` / `]`. grid is the control. */
export const arrangements: Arrangement[] = [grid, createTide(), createErode()]

export type { Arrangement, Item, Placement, Size } from './types.ts'
