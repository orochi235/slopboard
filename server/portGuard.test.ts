import { describe, expect, it } from 'vitest'
import { classifyPortHolder } from './portGuard.ts'

const responding = (body: unknown, ok = true) =>
  (async () => ({ ok, json: async () => body })) as unknown as typeof fetch

describe('classifyPortHolder', () => {
  it('recognises a slopboard daemon by its health body', async () => {
    const who = await classifyPortHolder(8787, responding({ ok: true, items: 3, ttlMs: 300000 }))
    expect(who).toBe('slopboard')
  })

  it('calls anything else on the port foreign, even when it answers 200 JSON', async () => {
    expect(await classifyPortHolder(8787, responding({ status: 'fine' }))).toBe('foreign')
  })

  it('treats a health body that reports itself unhealthy as foreign', async () => {
    expect(await classifyPortHolder(8787, responding({ ok: false, ttlMs: 1 }))).toBe('foreign')
  })

  it('treats a non-2xx as foreign', async () => {
    expect(await classifyPortHolder(8787, responding({ ok: true, ttlMs: 1 }, false))).toBe('foreign')
  })

  it('treats a refused or non-HTTP peer as foreign rather than throwing', async () => {
    const refusing = (async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    expect(await classifyPortHolder(8787, refusing)).toBe('foreign')
  })

  it('survives a peer that answers with something that is not JSON', async () => {
    const garbage = (async () => ({
      ok: true,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    })) as unknown as typeof fetch
    expect(await classifyPortHolder(8787, garbage)).toBe('foreign')
  })
})
