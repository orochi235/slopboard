import { execFile } from 'node:child_process'
import { mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { afterEach, describe, expect, it } from 'vitest'
import { crc32, zipBytes } from '@shared/zip.ts'

const run = promisify(execFile)
const bytes = (text: string) => new TextEncoder().encode(text)

const scratch: string[] = []
const dir = async () => {
  const made = await mkdtemp(join(tmpdir(), 'transom-zip-'))
  scratch.push(made)
  return made
}
afterEach(async () => {
  for (const made of scratch.splice(0)) await rm(made, { recursive: true, force: true })
})

describe('crc32', () => {
  it('agrees with the published check value', () => {
    expect(crc32(bytes('123456789'))).toBe(0xcbf43926)
  })
})

describe('zipBytes', () => {
  it('writes an archive the system unzip reads back whole', async () => {
    const made = await dir()
    const archive = join(made, 'a.zip')
    await writeFile(
      archive,
      await zipBytes([
        { name: 'plot.png', bytes: bytes('one') },
        { name: 'run/take-2.png', bytes: bytes('two') },
      ]),
    )
    await run('unzip', ['-t', archive])
    const out = join(made, 'out')
    await run('unzip', ['-q', archive, '-d', out])
    expect((await readdir(out)).sort()).toEqual(['plot.png', 'run'])
    expect(await readFile(join(out, 'plot.png'), 'utf8')).toBe('one')
    expect(await readFile(join(out, 'run', 'take-2.png'), 'utf8')).toBe('two')
  })

  it('writes an empty archive rather than nothing', async () => {
    const made = await dir()
    const archive = join(made, 'empty.zip')
    await writeFile(archive, await zipBytes([]))
    // `unzip -t` calls an empty archive an error, so the check is that the end
    // record is there and no entry is.
    const held = await readFile(archive)
    expect(held.length).toBe(22)
    expect(held.readUInt32LE(0)).toBe(0x06054b50)
  })

  it('keeps bytes that are not text intact', async () => {
    const made = await dir()
    const archive = join(made, 'b.zip')
    const raw = new Uint8Array(4096)
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 7) & 0xff
    await writeFile(archive, await zipBytes([{ name: 'mesh.glb', bytes: raw }]))
    const out = join(made, 'out')
    await run('unzip', ['-q', archive, '-d', out])
    expect(new Uint8Array(await readFile(join(out, 'mesh.glb')))).toEqual(raw)
  })
})
