import { describe, expect, it } from 'vitest'
import { createStack } from '@/arrangements/stack.ts'
import { defaultParams } from '@/params.ts'

const container = { w: 16 / 9, h: 1 }
const item = (id: string, zone: string, age01 = 0) => ({ id, zone, age01 })

const run = (
  stack: ReturnType<typeof createStack>,
  items: ReturnType<typeof item>[],
  now: number,
) => stack.strategy.layout({ items, container, state: undefined, options: { now } })

describe('stack', () => {
  it('is a 3D arrangement', () => {
    expect(createStack().dims).toBe(3)
  })

  it('emits a square slot, never the image aspect', () => {
    const out = run(createStack(), [item('a', 'weasel')], 0)
    const rect = out.placements.get('a')!
    expect(rect.w).toBe(defaultParams.side)
    expect(rect.h).toBe(rect.w)
  })

  it('recedes one step per rank within a zone', () => {
    const stack = createStack()
    // Settled: both items present from the first call, so no shove is running.
    const out = run(stack, [item('new', 'z'), item('old', 'z')], 0)
    const near = out.placements.get('new')!
    const far = out.placements.get('old')!
    expect(far.z).toBeLessThan(near.z)
    expect(far.z - near.z).toBeCloseTo(defaultParams.step.z)
  })

  it('puts each zone in its own cell', () => {
    const out = run(createStack(), [item('a', 'weasel'), item('b', 'klieg')], 0)
    const a = out.placements.get('a')!
    const b = out.placements.get('b')!
    expect(a.x).not.toBeCloseTo(b.x)
  })

  it('animates a shove rather than jumping', () => {
    const stack = createStack()
    const shove = defaultParams.shoveMs
    run(stack, [item('a', 'z')], 0)
    // The arrival is its own call: a rank change is recorded at `now`, so
    // sampling in the same call always reads settle = 0 and proves nothing.
    run(stack, [item('new', 'z'), item('a', 'z')], 1000)
    const mid = run(stack, [item('new', 'z'), item('a', 'z')], 1000 + shove / 2)
    const zMid = mid.placements.get('a')!.z
    const settled = run(stack, [item('new', 'z'), item('a', 'z')], 1000 + shove * 4)
    const zEnd = settled.placements.get('a')!.z
    expect(zEnd).toBeCloseTo(defaultParams.step.z)
    // Halfway through, 'a' is between rank 0 and rank 1.
    expect(zMid).toBeLessThan(0)
    expect(zMid).toBeGreaterThan(zEnd)
  })

  it('fades only with age, wherever the item sits', () => {
    const stack = createStack()
    const out = run(stack, [item('young', 'z', 0), item('dying', 'z', 1)], 0)
    expect(out.channels!.get('young')!.opacity).toBeCloseTo(1)
    expect(out.channels!.get('dying')!.opacity).toBeCloseTo(0)
  })

  it('jitters deterministically, so a dropped cache does not reshuffle the pile', () => {
    const a = run(createStack(), [item('x', 'z')], 0)
    const b = run(createStack(), [item('x', 'z')], 0)
    expect(a.channels!.get('x')!.rotZ).toBe(b.channels!.get('x')!.rotZ)
  })

  it('assigns an LOD tier by rank and reports the deep tail as unplaced past the cap', () => {
    const params = { ...defaultParams, rankCap: 3 }
    const items = Array.from({ length: 6 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    expect(out.placements.size).toBe(3)
    expect(out.unplaced).toEqual(['i3', 'i4', 'i5'])
    expect(out.channels!.get('i0')!.lod).toBe(512)
    expect(out.channels!.get('i2')!.lod).toBe(128)
  })

  it('places nothing for an empty wall', () => {
    const out = run(createStack(), [], 0)
    expect(out.placements.size).toBe(0)
  })
})
