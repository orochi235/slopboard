import { describe, expect, it, vi } from 'vitest'
import { createTextureStore } from '@/textures/store.ts'

const bytes = (edge: number) => edge * edge * 4

describe('createTextureStore', () => {
  it('holds what fits and reports its size', () => {
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2 })
    store.put('a', 'tex-a', bytes(512))
    store.put('b', 'tex-b', bytes(512))
    expect(store.get('a')).toBe('tex-a')
    expect(store.size()).toBe(2)
  })

  it('evicts least-recently-used first and disposes what it drops', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2, dispose })
    store.put('a', 'tex-a', bytes(512))
    store.put('b', 'tex-b', bytes(512))
    store.get('a')
    store.put('c', 'tex-c', bytes(512))

    expect(dispose).toHaveBeenCalledWith('tex-b')
    expect(store.get('b')).toBeUndefined()
    expect(store.get('a')).toBe('tex-a')
    expect(store.get('c')).toBe('tex-c')
  })

  it('replaces an entry in place, disposing the old value and rebilling', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 2, dispose })
    store.put('a', 'big', bytes(512))
    store.put('a', 'small', bytes(128))

    expect(dispose).toHaveBeenCalledWith('big')
    expect(store.get('a')).toBe('small')
    expect(store.bytes()).toBe(bytes(128))
  })

  it('refuses a single entry larger than the whole budget rather than emptying itself', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(128), dispose })
    store.put('a', 'tex-a', bytes(128))
    expect(store.put('huge', 'tex-huge', bytes(512))).toBe(false)

    expect(dispose).toHaveBeenCalledWith('tex-huge')
    expect(store.get('a')).toBe('tex-a')
  })

  it('disposes everything on clear, for a lost context', () => {
    const dispose = vi.fn()
    const store = createTextureStore<string>({ budgetBytes: bytes(512) * 4, dispose })
    store.put('a', 'tex-a', bytes(128))
    store.put('b', 'tex-b', bytes(128))
    store.clear()

    expect(dispose).toHaveBeenCalledTimes(2)
    expect(store.size()).toBe(0)
    expect(store.bytes()).toBe(0)
  })
})
