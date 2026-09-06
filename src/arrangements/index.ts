import { createStack } from './stack.ts'
import type { Arrangement } from './types.ts'

/** Order is the cycle order under `[` / `]`. */
export const arrangements: Arrangement[] = [createStack()]

export type {
  Arrangement,
  Camera,
  SlopChannels,
  SlopStrategy,
  Size,
} from './types.ts'
