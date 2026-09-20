import { createInbox } from './inbox.ts'
import { createStack } from './stack.ts'
import type { Arrangement } from './types.ts'
import { defaultParams, type StackParams } from '@/params.ts'

/** Order is the cycle order under `[` / `]`. Each closes over its params, so a
 *  change to them rebuilds the set. */
export const arrangementsFor = (params: StackParams): Arrangement[] => [
  createStack(params),
  createInbox(params),
]

export const arrangements: Arrangement[] = arrangementsFor(defaultParams)

export type {
  Arrangement,
  Camera,
  SlopChannels,
  SlopStrategy,
  Size,
} from './types.ts'
