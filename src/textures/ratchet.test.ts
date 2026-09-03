import { describe, expect, it } from 'vitest'
import { ratchet } from '@/textures/ratchet.ts'

describe('ratchet', () => {
  it('takes the requested edge when nothing is held yet', () => {
    expect(ratchet(undefined, 512)).toBe(512)
  })

  it('shrinks when the item sinks down the pile', () => {
    expect(ratchet(512, 128)).toBe(128)
    expect(ratchet(128, 0)).toBe(0)
  })

  it('refuses to grow, which is what makes the downgrade path re-decode-free', () => {
    expect(ratchet(128, 512)).toBe(128)
    expect(ratchet(0, 512)).toBe(0)
  })

  it('holds steady when the tier has not changed', () => {
    expect(ratchet(128, 128)).toBe(128)
  })
})
