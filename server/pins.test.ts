import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

let transomRoot: string

beforeEach(async () => {
  transomRoot = await mkdtemp(join(tmpdir(), 'transom-pins-'))
  vi.resetModules()
  process.env.TRANSOM_ROOT = transomRoot
})

afterEach(() => {
  delete process.env.TRANSOM_ROOT
})

const load = () => import('./pins.ts')

const file = () => join(transomRoot, 'pins.json')

test('no file means no pinned zones', async () => {
  const { readPins } = await load()
  expect(await readPins()).toEqual({})
})

test('a pin round-trips through the file', async () => {
  const { setPinned, readPins } = await load()
  const at = await setPinned('weasel', true)
  expect(typeof at).toBe('number')
  expect(await readPins()).toEqual({ weasel: at })
})

test('the file holds an ISO string, so it can be read and edited by hand', async () => {
  const { setPinned } = await load()
  const at = await setPinned('weasel', true)
  const blob = JSON.parse(await readFile(file(), 'utf8'))
  expect(blob).toEqual({ zones: { weasel: new Date(at as number).toISOString() } })
})

test('unpinning takes the zone back out and leaves the others', async () => {
  const { setPinned, readPins } = await load()
  await setPinned('weasel', true)
  const wod = await setPinned('wod', true)
  expect(await setPinned('weasel', false)).toBeNull()
  expect(await readPins()).toEqual({ wod })
})

test('unpinning a zone that was never pinned is not an error', async () => {
  const { setPinned, readPins } = await load()
  expect(await setPinned('weasel', false)).toBeNull()
  expect(await readPins()).toEqual({})
})

test('a hand-written date that means nothing is dropped rather than pinning forever', async () => {
  await writeFile(file(), JSON.stringify({ zones: { weasel: 'sometime', wod: 'also' } }))
  const { readPins } = await load()
  expect(await readPins()).toEqual({})
})

test('an unreadable file reads as nothing pinned', async () => {
  await writeFile(file(), 'not json at all')
  const { readPins } = await load()
  expect(await readPins()).toEqual({})
})

test('a pin written into the file by hand is picked up', async () => {
  await writeFile(
    file(),
    JSON.stringify({ zones: { weasel: '2026-09-12T00:00:00.000Z' } }),
  )
  const { readPins } = await load()
  expect(await readPins()).toEqual({ weasel: Date.parse('2026-09-12T00:00:00.000Z') })
})
