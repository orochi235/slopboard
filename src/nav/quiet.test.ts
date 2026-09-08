import { describe, expect, it } from 'vitest'
import { createQuietGate } from '@/nav/quiet.ts'

describe('createQuietGate', () => {
  it('calls the first event a fresh gesture', () => {
    const gate = createQuietGate(150)
    expect(gate.feed(0)).toBe(true)
  })

  it('calls a frame-interval stream one gesture', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    for (let t = 16; t <= 800; t += 16) expect(gate.feed(t)).toBe(false)
  })

  it('starts a new gesture once the stream goes quiet', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    expect(gate.feed(100)).toBe(false)
    expect(gate.feed(300)).toBe(true)
  })

  it('measures the gap from the last event, not the last fresh one', () => {
    const gate = createQuietGate(150)
    gate.feed(0)
    // 140 apart each: never quiet, however long the stream runs.
    for (let t = 140; t <= 1400; t += 140) expect(gate.feed(t)).toBe(false)
  })

  it('starts disarmed when handed a start time, for a mid-gesture mount', () => {
    const gate = createQuietGate(150, 1000)
    expect(gate.feed(1020)).toBe(false)
    expect(gate.feed(1400)).toBe(true)
  })
})
