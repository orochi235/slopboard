import { describe, expect, it } from 'vitest'
import { config } from './config.ts'
import { meshViewUrl } from './meshview.ts'

describe('meshViewUrl', () => {
  it('points the shot at this daemon, by address rather than by name', () => {
    expect(meshViewUrl('/slop/inbox/z/head.glb')).toBe(
      `http://127.0.0.1:${config.port}/view/mesh?src=%2Fslop%2Finbox%2Fz%2Fhead.glb`,
    )
  })

  it('escapes a path that would otherwise end the query', () => {
    expect(meshViewUrl('/slop/inbox/my zone/a&b.glb')).toContain('my%20zone%2Fa%26b.glb')
  })
})

/** The viewer names a file rather than an item id, because a mesh is postered
 *  during ingest, before the store has heard of it. This is what stops the
 *  route being pointed anywhere else. */
describe('held', () => {
  it('serves a mesh out of the inbox or the cache', async () => {
    const { held } = await import('./meshview.ts')
    expect(held(`${config.inbox}/zone/head.glb`)).toBe(true)
    expect(held(`${config.cache}/abc.glb`)).toBe(true)
  })

  it('refuses anything else, including a walk out of one', async () => {
    const { held } = await import('./meshview.ts')
    expect(held('/etc/passwd')).toBe(false)
    expect(held(`${config.inbox}/../../.ssh/id_ed25519`)).toBe(false)
    // The directory itself is not a file in it.
    expect(held(config.inbox)).toBe(false)
  })
})
