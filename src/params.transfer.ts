import type { StackParams } from '@/params.ts'
import { mergeStored } from '@/params.store.ts'

/** Indented, because where a tuned set is going is `src/params.ts`. */
export function toText(params: StackParams): string {
  return JSON.stringify(params, null, 2)
}

/**
 * Null for anything that is not a parameter object; otherwise the text laid
 * over the defaults by `mergeStored`, which already drops keys the params no
 * longer have and ignores values whose type disagrees. An import needs exactly
 * that validation, so it does not get a second one.
 */
export function fromText(defaults: StackParams, text: string): StackParams | null {
  let blob: unknown
  try {
    blob = JSON.parse(text)
  } catch {
    return null
  }
  if (blob === null || typeof blob !== 'object' || Array.isArray(blob)) return null
  return mergeStored(defaults, blob)
}
