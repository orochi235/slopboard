import { describe, expect, it, vi } from 'vitest'
import { mergeStored, loadParams, saveParams } from '@/params.store.ts'
import { defaultParams } from '@/params.ts'

describe('mergeStored', () => {
  it('takes a stored value over the default', () => {
    const out = mergeStored(defaultParams, { side: 0.5 })
    expect(out.side).toBe(0.5)
  })

  it('merges nested objects rather than replacing them wholesale', () => {
    const out = mergeStored(defaultParams, { camera: { fovDeg: 12 } })
    expect(out.camera.fovDeg).toBe(12)
    expect(out.camera.moveMs).toBe(defaultParams.camera.moveMs)
  })

  it('keeps a default the stored blob has never heard of', () => {
    const out = mergeStored(defaultParams, { side: 0.5 })
    expect(out.overlay.cardEdges).toBe(defaultParams.overlay.cardEdges)
  })

  it('drops a stored key the params no longer have', () => {
    const out = mergeStored(defaultParams, { retired: 1, side: 0.5 }) as Record<string, unknown>
    expect(out.retired).toBeUndefined()
  })

  it('refuses a stored value whose type disagrees with the default', () => {
    const out = mergeStored(defaultParams, { side: 'wide', shoveMs: 10 })
    expect(out.side).toBe(defaultParams.side)
    expect(out.shoveMs).toBe(10)
  })

  it('replaces an array wholesale, since a tier list has no key to merge on', () => {
    const tiers = [{ maxRank: 1, edge: 32 }]
    expect(mergeStored(defaultParams, { lod: { tiers } }).lod.tiers).toEqual(tiers)
  })

  it('ignores a stored blob that is not an object', () => {
    expect(mergeStored(defaultParams, null)).toEqual(defaultParams)
    expect(mergeStored(defaultParams, 42)).toEqual(defaultParams)
  })
})

describe('loadParams', () => {
  const store = (raw: string | null) => ({
    getItem: () => raw,
    setItem: vi.fn(),
  })

  it('is the defaults when nothing is stored', () => {
    expect(loadParams(defaultParams, store(null) as unknown as Storage)).toEqual(defaultParams)
  })

  it('is the defaults when the stored text is not JSON, rather than throwing', () => {
    expect(loadParams(defaultParams, store('{oops') as unknown as Storage)).toEqual(defaultParams)
  })

  it('survives a storage that throws on read, as a private window does', () => {
    const hostile = {
      getItem: () => {
        throw new Error('denied')
      },
      setItem: vi.fn(),
    }
    expect(loadParams(defaultParams, hostile as unknown as Storage)).toEqual(defaultParams)
  })
})

describe('saveParams', () => {
  it('writes JSON and swallows a storage that refuses', () => {
    const setItem = vi.fn()
    saveParams(defaultParams, { setItem } as unknown as Storage)
    expect(JSON.parse(setItem.mock.calls[0]![1] as string).side).toBe(defaultParams.side)

    expect(() =>
      saveParams(defaultParams, {
        setItem: () => {
          throw new Error('quota')
        },
      } as unknown as Storage),
    ).not.toThrow()
  })
})

describe('migrating a v1 panel', () => {
  const fake = (): Storage => {
    const map = new Map<string, string>()
    return {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
      clear: () => map.clear(),
      key: () => null,
      length: 0,
    } as unknown as Storage
  }

  it('gives back the attention subtree so a changed meaning cannot survive', () => {
    const storage = fake()
    storage.setItem(
      'slopboard.params.v1',
      JSON.stringify({ attention: { seek: true, float: true }, origin: { x: 0.9, y: 0.9 } }),
    )
    const out = loadParams(defaultParams, storage)
    expect(out.attention.seek).toBe(defaultParams.attention.seek)
    expect(out.attention.float).toBe(defaultParams.attention.float)
  })

  it('keeps every other tuning, which is why it is not just a version bump', () => {
    const storage = fake()
    storage.setItem(
      'slopboard.params.v1',
      JSON.stringify({ attention: { seek: true }, origin: { x: 0.9, y: 0.9 } }),
    )
    expect(loadParams(defaultParams, storage).origin).toEqual({ x: 0.9, y: 0.9 })
  })

  it('retires the old key, so the migration runs once', () => {
    const storage = fake()
    storage.setItem('slopboard.params.v1', JSON.stringify({ origin: { x: 0.9, y: 0.9 } }))
    loadParams(defaultParams, storage)
    expect(storage.getItem('slopboard.params.v1')).toBeNull()
    expect(storage.getItem('slopboard.params.v2')).not.toBeNull()
  })

  it('prefers a v2 panel over a v1 left behind', () => {
    const storage = fake()
    storage.setItem('slopboard.params.v1', JSON.stringify({ origin: { x: 0.1, y: 0.1 } }))
    storage.setItem('slopboard.params.v2', JSON.stringify({ origin: { x: 0.7, y: 0.7 } }))
    expect(loadParams(defaultParams, storage).origin).toEqual({ x: 0.7, y: 0.7 })
  })
})
