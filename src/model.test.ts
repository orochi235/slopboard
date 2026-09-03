import { describe, expect, it } from 'vitest'
import { toStackItems } from '@/model.ts'
import type { WallItem } from '@shared/protocol.ts'

const item = (over: Partial<WallItem> = {}): WallItem => ({
  id: 'a',
  url: '/img/a',
  origUrl: '/orig/a',
  zone: 'windease',
  bornAt: 1000,
  w: 200,
  h: 100,
  ...over,
})

describe('toStackItems', () => {
  it('derives age01 from the daemon clock, not the browser clock', () => {
    const [out] = toStackItems([item()], { now: 3000, ttlMs: 4000 })
    expect(out!.age01).toBe(0.5)
  })

  it('clamps a past-expiry item to 1 rather than reporting more than a life', () => {
    const [out] = toStackItems([item()], { now: 99_000, ttlMs: 4000 })
    expect(out!.age01).toBe(1)
  })

  it('clamps a clock-skewed future arrival to 0', () => {
    const [out] = toStackItems([item({ bornAt: 5000 })], { now: 3000, ttlMs: 4000 })
    expect(out!.age01).toBe(0)
  })

  it('carries zone and id through, and aspect from the stored dimensions', () => {
    const [out] = toStackItems([item()], { now: 1000, ttlMs: 4000 })
    expect(out!.id).toBe('a')
    expect(out!.zone).toBe('windease')
    expect(out!.aspect).toBe(2)
  })

  it('treats a zero-height item as square rather than dividing by zero', () => {
    const [out] = toStackItems([item({ h: 0 })], { now: 1000, ttlMs: 4000 })
    expect(out!.aspect).toBe(1)
  })
})
