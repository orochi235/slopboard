import { grid } from './grid.ts'
import type { Arrangement } from './types.ts'

/** Order is the cycle order under `[` / `]`. */
export const arrangements: Arrangement[] = [grid]

export type { Arrangement, Item, Placement, Size } from './types.ts'
