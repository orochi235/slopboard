import { describe, expect, it } from 'vitest'
import { closesDialog } from '@/scrim.ts'

const scrim = new EventTarget()
const sheet = new EventTarget()
const thumb = new EventTarget()

describe('closesDialog', () => {
  it('closes on a press and release that both land on the scrim', () => {
    expect(closesDialog(scrim, scrim, scrim)).toBe(true)
  })

  it('holds the dialog open for a drag that began inside it', () => {
    // A slider dragged past the sheet's edge releases over the scrim, and the
    // click that follows targets the scrim. This is the bug: the sheet closed
    // under the hand mid-drag.
    expect(closesDialog(thumb, scrim, scrim)).toBe(false)
  })

  it('ignores a click that never reached the scrim', () => {
    expect(closesDialog(sheet, sheet, scrim)).toBe(false)
  })

  it('holds open when the press target is unknown', () => {
    expect(closesDialog(null, scrim, scrim)).toBe(false)
  })
})
