import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, test, vi } from 'vitest'

let root: string
const file = () => join(root, 'zones.json')

/** `config` reads the environment at import, so each test needs the root set
 *  and the module graph dropped before it loads the store. */
async function fresh() {
  process.env.SLOP_ROOT = root
  vi.resetModules()
  const zones = await import('./zones.ts')
  await zones.load()
  return zones
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'slop-zones-'))
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
  delete process.env.SLOP_ROOT
})

test('no file means every zone inherits', async () => {
  const { all, lifetimeFor } = await fresh()
  expect(all()).toEqual({})
  expect(lifetimeFor('weasel')).toBeUndefined()
})

test('a setting round-trips through the file', async () => {
  const { set, all } = await fresh()
  const held = await set('weasel', { backdrop: 'dots', lifetime: 4 * 3_600_000 })
  expect(held).toEqual({ backdrop: 'dots', lifetime: 4 * 3_600_000 })
  expect(all()).toEqual({ weasel: held })

  const reloaded = await fresh()
  expect(reloaded.all()).toEqual({ weasel: { backdrop: 'dots', lifetime: 4 * 3_600_000 } })
})

test('the file writes a duration the way a person does, so it can be edited by hand', async () => {
  const { set } = await fresh()
  await set('weasel', { lifetime: 4 * 3_600_000 })
  expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual({ zones: { weasel: { ttl: '4h' } } })
})

test('a field set to null goes back to inheriting', async () => {
  const { set, all } = await fresh()
  await set('weasel', { color: '#102030', backdrop: 'dots' })
  expect(await set('weasel', { color: null })).toEqual({ backdrop: 'dots' })
  expect(all().weasel).toEqual({ backdrop: 'dots' })
})

test('a zone with nothing left overriding leaves no entry behind', async () => {
  const { set, all } = await fresh()
  await set('weasel', { backdrop: 'dots' })
  expect(await set('weasel', { backdrop: null })).toEqual({})
  expect(all()).toEqual({})
  expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual({ zones: {} })
})

test('a patch touches only the fields it names', async () => {
  const { set } = await fresh()
  await set('weasel', { color: '#102030', lifetime: 900_000 })
  expect(await set('weasel', { backdrop: 'bricks' })).toEqual({
    color: '#102030',
    lifetime: 900_000,
    backdrop: 'bricks',
  })
})

test('a lifetime outside the bounds the wall holds is refused, and the rest of the patch still lands', async () => {
  const { set } = await fresh()
  expect(await set('weasel', { lifetime: 1, backdrop: 'dots' })).toEqual({ backdrop: 'dots' })
})

test('a pattern the wall cannot draw is dropped rather than stored', async () => {
  const { set } = await fresh()
  expect(await set('weasel', { backdrop: 'tartan' as never })).toEqual({})
})

test('a color that is not a hex triple is dropped', async () => {
  const { set } = await fresh()
  expect(await set('weasel', { color: 'chartreuse' })).toEqual({})
  expect(await set('weasel', { color: '#abcdef' })).toEqual({ color: '#abcdef' })
})

test('junk in the file costs the zone its overrides, not the wall its start', async () => {
  await writeFile(file(), JSON.stringify({ zones: { weasel: { ttl: 'soon', backdrop: 7 }, bad: 3 } }))
  const { all } = await fresh()
  expect(all()).toEqual({})
})

test('an unreadable file reads as no overrides at all', async () => {
  await writeFile(file(), 'not json')
  const { all } = await fresh()
  expect(all()).toEqual({})
})

test('the lifetime a zone sets is what the sweeper asks for', async () => {
  const { set, lifetimeFor } = await fresh()
  await set('weasel', { lifetime: 900_000 })
  expect(lifetimeFor('weasel')).toBe(900_000)
  expect(lifetimeFor('slopboard')).toBeUndefined()
})

test('a hold is stored as its own word, so the file stays readable by hand', async () => {
  const { set } = await fresh()
  await set('weasel', { lifetime: 'eternal' })
  expect(JSON.parse(await readFile(file(), 'utf8'))).toEqual({
    zones: { weasel: { ttl: 'eternal' } },
  })
  expect((await fresh()).all()).toEqual({ weasel: { lifetime: 'eternal' } })
})

test('a hold is never out of bounds — it is the setting the bounds imitate', async () => {
  const { set } = await fresh()
  // A number this large is refused; saying the same thing outright is not.
  expect(await set('a', { lifetime: 400 * 86_400_000 })).toEqual({})
  expect(await set('b', { lifetime: 'indefinite' })).toEqual({ lifetime: 'indefinite' })
})

test('a stored word the build does not know leaves the zone inheriting', async () => {
  await writeFile(file(), JSON.stringify({ zones: { weasel: { ttl: 'forever' } } }))
  expect((await fresh()).all()).toEqual({})
})
