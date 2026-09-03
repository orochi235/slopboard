import { describe, expect, it, vi } from 'vitest'
import { averageColorOf, loadBitmap } from '@/textures/source.ts'

describe('loadBitmap', () => {
  it('asks the decoder for the target edge, not the full frame', async () => {
    const bitmap = { width: 128, height: 128, close: vi.fn() }
    const createImageBitmap = vi.fn().mockResolvedValue(bitmap)
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => 'blob' })

    const out = await loadBitmap('/img/a', 128, { fetch, createImageBitmap } as never)

    expect(fetch).toHaveBeenCalledWith('/img/a')
    expect(createImageBitmap).toHaveBeenCalledWith('blob', {
      resizeWidth: 128,
      resizeHeight: 128,
      resizeQuality: 'medium',
    })
    expect(out).toBe(bitmap)
  })

  it('returns null on a failed response rather than throwing into the frame loop', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false, blob: async () => 'blob' })
    const createImageBitmap = vi.fn()

    expect(await loadBitmap('/img/a', 128, { fetch, createImageBitmap } as never)).toBeNull()
    expect(createImageBitmap).not.toHaveBeenCalled()
  })

  it('returns null when the decode itself rejects', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true, blob: async () => 'blob' })
    const createImageBitmap = vi.fn().mockRejectedValue(new Error('decode failed'))

    expect(await loadBitmap('/img/a', 32, { fetch, createImageBitmap } as never)).toBeNull()
  })
})

describe('averageColorOf', () => {
  it('reads the single pixel a 1x1 decode produces', () => {
    const data = new Uint8ClampedArray([10, 20, 30, 255])
    const ctx = { drawImage: vi.fn(), getImageData: vi.fn().mockReturnValue({ data }) }
    const canvas = { width: 0, height: 0, getContext: () => ctx }

    expect(averageColorOf({ width: 1, height: 1 } as never, canvas as never)).toEqual({
      r: 10 / 255,
      g: 20 / 255,
      b: 30 / 255,
    })
    expect(canvas.width).toBe(1)
    expect(canvas.height).toBe(1)
  })

  it('falls back to mid grey when the context is unavailable', () => {
    const canvas = { width: 0, height: 0, getContext: () => null }
    expect(averageColorOf({ width: 1, height: 1 } as never, canvas as never)).toEqual({
      r: 0.5,
      g: 0.5,
      b: 0.5,
    })
  })
})
