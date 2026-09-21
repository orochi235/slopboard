import sharp from 'sharp'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { hasInk } from './meshShot.ts'

let dir = ''
const png = (name: string) => join(dir, name)

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'slop-mesh-test-'))
  const blank = { width: 8, height: 8, channels: 4 as const, background: { r: 0, g: 0, b: 0, alpha: 0 } }
  await sharp({ create: blank }).png().toFile(png('blank.png'))
  await sharp({ create: { ...blank, background: { r: 200, g: 200, b: 200, alpha: 1 } } })
    .png()
    .toFile(png('drawn.png'))
  await sharp({ create: { ...blank, channels: 3 as const, background: '#888' } })
    .png()
    .toFile(png('opaque.png'))
})

afterAll(() => rm(dir, { recursive: true, force: true }))

describe('hasInk', () => {
  it('reads a fully transparent shot as nothing drawn', async () => {
    // Which is exactly what a viewer that failed to load leaves behind.
    expect(await hasInk(png('blank.png'))).toBe(false)
  })

  it('reads anything opaque as drawn', async () => {
    expect(await hasInk(png('drawn.png'))).toBe(true)
    expect(await hasInk(png('opaque.png'))).toBe(true)
  })

  it('reads a missing file as nothing drawn', async () => {
    expect(await hasInk(png('absent.png'))).toBe(false)
  })
})
