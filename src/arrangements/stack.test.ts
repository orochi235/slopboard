import { describe, expect, it } from 'vitest'
import { createStack } from '@/arrangements/stack.ts'
import { defaultParams } from '@/params.ts'

const container = { w: 16 / 9, h: 1 }
const item = (id: string, zone: string, age01 = 0, emphasis = 0) => ({
  id,
  zone,
  age01,
  emphasis,
})

const run = (
  stack: ReturnType<typeof createStack>,
  items: ReturnType<typeof item>[],
  now: number,
) => stack.strategy.layout({ items, container, state: undefined, options: { now } })

describe('stack', () => {
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

  it('ranks an excluded artifact behind every kept one', () => {
    const stack = createStack()
    // Newest first, so untouched the front of the pile is `fresh`. Excluding
    // it has to promote `older` rather than leave it buried.
    const items = [
      { ...item('fresh', 'z', 0), excluded: true },
      item('older', 'z', 0.5),
    ]
    const out = stack.strategy.layout({ items, container, state: undefined, options: { now: 0 } })
    const fresh = out.placements.get('fresh')!
    const older = out.placements.get('older')!
    expect(older.z).toBeGreaterThan(fresh.z)
  })

  it('leaves the pile alone when the band excludes nothing', () => {
    const stack = createStack()
    const out = run(stack, [item('fresh', 'z', 0), item('older', 'z', 0.5)], 0)
    const fresh = out.placements.get('fresh')!
    const older = out.placements.get('older')!
    expect(older.z).toBeLessThan(fresh.z)
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

  it('glides a pile to its new cell when the zone order changes', () => {
    const stack = createStack()
    const ms = defaultParams.zoneGrid.moveMs
    const given = (items: ReturnType<typeof item>[], now: number) =>
      stack.strategy.layout({ items, container, state: undefined, options: { now, zones: 'given' } })
    const before = given([item('a', 'one'), item('b', 'two')], 0).placements.get('a')!
    const swapped = [item('b', 'two'), item('a', 'one')]
    // The reorder is its own call, for the same reason a shove's arrival is.
    given(swapped, 1000)
    const mid = given(swapped, 1000 + ms / 2).placements.get('a')!
    const after = given(swapped, 1000 + ms * 4).placements.get('a')!
    expect(after.x).not.toBeCloseTo(before.x)
    expect(mid.x).toBeGreaterThan(Math.min(before.x, after.x))
    expect(mid.x).toBeLessThan(Math.max(before.x, after.x))
  })

  it('fades with age at the front of the pile', () => {
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
    const params = { ...defaultParams, lod: { ...defaultParams.lod, rankCap: 3 } }
    const items = Array.from({ length: 6 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    expect(out.placements.size).toBe(3)
    expect(out.unplaced).toEqual(['i3', 'i4', 'i5'])
    expect(out.channels!.get('i0')!.lod).toBe(512)
    expect(out.channels!.get('i2')!.lod).toBe(128)
  })

  it('dims a card by depth even when it is fresh', () => {
    const params = { ...defaultParams, distance: { ...defaultParams.distance, from: 0, to: 4 } }
    const items = Array.from({ length: 5 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    expect(out.channels!.get('i0')!.opacity).toBeCloseTo(1)
    expect(out.channels!.get('i4')!.opacity).toBeCloseTo(params.distance.floor)
  })

  it('never takes depth alone below the floor, so the tail still reads as a pile', () => {
    const params = { ...defaultParams, distance: { ...defaultParams.distance, from: 0, to: 4 } }
    const items = Array.from({ length: 40 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    for (const [, ch] of out.channels!) {
      expect(ch.opacity).toBeGreaterThanOrEqual(params.distance.floor)
    }
  })

  it('still takes a dying card to nothing at any depth, under `ceiling`', () => {
    const params = {
      ...defaultParams,
      distance: { ...defaultParams.distance, from: 0, to: 4, combine: 'ceiling' as const },
    }
    const items = [...Array.from({ length: 4 }, (_, i) => item(`i${i}`, 'z')), item('deep', 'z', 1)]
    const out = run(createStack(params), items, 0)
    expect(out.channels!.get('deep')!.opacity).toBeCloseTo(0)
  })

  it('compounds depth with a running fade under `ceiling`, where `min` ignores it', () => {
    // Half way through the fade window, so age has taken half the card and the
    // rules disagree — at either end of the window they agree.
    const half = (defaultParams.fade.from + defaultParams.fade.to) / 2
    const deep = (combine: 'ceiling' | 'min') => {
      const params = {
        ...defaultParams,
        distance: { ...defaultParams.distance, from: 0, to: 4, combine },
      }
      const items = [
        ...Array.from({ length: 4 }, (_, i) => item(`i${i}`, 'z')),
        item('deep', 'z', half),
      ]
      return run(createStack(params), items, 0).channels!.get('deep')!.opacity
    }
    const floor = defaultParams.distance.floor
    expect(deep('min')).toBeCloseTo(floor)
    expect(deep('ceiling')).toBeCloseTo(floor * 0.5)
  })

  it('leaves opacity to age alone when the falloff is off', () => {
    const params = { ...defaultParams, distance: { ...defaultParams.distance, enabled: false } }
    const items = Array.from({ length: 40 }, (_, i) => item(`i${i}`, 'z'))
    const out = run(createStack(params), items, 0)
    for (const [, ch] of out.channels!) expect(ch.opacity).toBeCloseTo(1)
  })

  it('takes an overridden curve, so the escape hatch is wired and not decorative', () => {
    const stack = createStack(defaultParams, { distance: () => 0.5 })
    const out = run(stack, [item('a', 'z')], 0)
    expect(out.channels!.get('a')!.opacity).toBeCloseTo(0.5)
  })

  it('keeps a flagged card present however deep it is buried', () => {
    const params = { ...defaultParams, distance: { ...defaultParams.distance, from: 0, to: 4 } }
    const items = [
      ...Array.from({ length: 30 }, (_, i) => item(`i${i}`, 'z')),
      item('flagged', 'z', 0, 1),
    ]
    const out = run(createStack(params), items, 0)
    // Last in the bucket, so the deepest rank on the pile — and still full.
    expect(out.channels!.get('flagged')!.opacity).toBeCloseTo(1)
    expect(out.channels!.get('i29')!.opacity).toBeCloseTo(params.distance.floor)
  })

  it('lets a flagged card still die on time, since a flag is not a reprieve', () => {
    const out = run(createStack(), [item('a', 'z'), item('flagged', 'z', 1, 1)], 0)
    expect(out.channels!.get('flagged')!.opacity).toBeCloseTo(0)
  })

  it('reports emphasis on the channel, so the renderer need not re-derive it', () => {
    const out = run(createStack(), [item('a', 'z', 0, 0.5)], 0)
    expect(out.channels!.get('a')!.emphasis).toBe(0.5)
  })

  it('places nothing for an empty wall', () => {
    const out = run(createStack(), [], 0)
    expect(out.placements.size).toBe(0)
  })
})

describe('an excluded artifact', () => {
  const container = { w: 16 / 9, h: 1 }
  const run = (items: ReturnType<typeof item>[]) =>
    createStack().strategy.layout({ items, container, state: undefined, options: { now: 0 } })

  it('is dimmed by the filter alone, not by the rank the filter gave it', () => {
    // The newest many cut, as dragging the band's front edge back does: they
    // rank behind every kept one, and must not pay the depth falloff for it.
    const items = Array.from({ length: 30 }, (_, i) => ({
      ...item(`c${i}`, 'z', 0.01 + i * 0.001),
      excluded: i < 25,
    }))
    const channels = run(items).channels!
    for (let i = 0; i < 25; i++) {
      expect(channels.get(`c${i}`)!.opacity).toBeCloseTo(1, 5)
    }
    // The kept ones still recede with depth, which is the whole point of it.
    expect(channels.get('c29')!.opacity).toBeLessThan(1)
  })
})
