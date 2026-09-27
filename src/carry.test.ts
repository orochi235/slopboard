import { describe, expect, it } from 'vitest'
import { carryIn } from '@/carry.ts'

function memory(): Storage {
  const held = new Map<string, string>()
  return {
    getItem: (k) => held.get(k) ?? null,
    setItem: (k, v) => void held.set(k, v),
    removeItem: (k) => void held.delete(k),
    clear: () => held.clear(),
    key: (i) => [...held.keys()][i] ?? null,
    get length() {
      return held.size
    },
  }
}

const hashOf = (carried: unknown) => `#carry=${encodeURIComponent(JSON.stringify(carried))}`

describe('carryIn', () => {
  it('stores what the old address sent', () => {
    const storage = memory()
    expect(carryIn(hashOf({ 'transom.params.v3': '{"side":0.5}', 'transom.sidebar.open.v1': '1' }), storage)).toBe(true)
    expect(storage.getItem('transom.params.v3')).toBe('{"side":0.5}')
    expect(storage.getItem('transom.sidebar.open.v1')).toBe('1')
  })

  it('leaves a fragment that is a view alone', () => {
    const storage = memory()
    expect(carryIn('#zone/weasel', storage)).toBe(false)
    expect(carryIn('', storage)).toBe(false)
    expect(storage.length).toBe(0)
  })

  it('keeps what is already stored, so a link cannot overwrite a tuning', () => {
    const storage = memory()
    storage.setItem('transom.params.v3', '{"side":0.9}')
    carryIn(hashOf({ 'transom.params.v3': '{"side":0.1}' }), storage)
    expect(storage.getItem('transom.params.v3')).toBe('{"side":0.9}')
  })

  it('takes only its own keys, and only strings', () => {
    const storage = memory()
    carryIn(hashOf({ 'other.app': 'x', 'transom.band.v1': { listed: true } }), storage)
    expect(storage.length).toBe(0)
  })

  it('asks to be cleared even when it cannot be read', () => {
    const storage = memory()
    expect(carryIn('#carry=%7Boops', storage)).toBe(true)
    expect(carryIn(hashOf(['transom.params.v3']), storage)).toBe(true)
    expect(storage.length).toBe(0)
  })
})
