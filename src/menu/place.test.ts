import { describe, expect, it } from 'vitest'
import { placeMenu } from '@/menu/place.ts'

const view = { w: 1000, h: 800 }
const menu = { w: 200, h: 300 }

describe('placeMenu', () => {
  it('hangs off the pointer where there is room', () => {
    expect(placeMenu({ x: 100, y: 100 }, menu, view)).toEqual({ left: 100, top: 100 })
  })

  it('flips rather than sliding, so the first item is never under the cursor', () => {
    expect(placeMenu({ x: 950, y: 100 }, menu, view).left).toBe(750)
    expect(placeMenu({ x: 100, y: 780 }, menu, view).top).toBe(480)
  })

  it('stays on screen when the menu is taller than the room either way', () => {
    const tall = { w: 200, h: 700 }
    const at = placeMenu({ x: 100, y: 400 }, tall, view)
    expect(at.top).toBeGreaterThanOrEqual(8)
    expect(at.top + tall.h).toBeLessThanOrEqual(view.h)
  })
})
