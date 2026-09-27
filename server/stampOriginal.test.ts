import { describe, expect, it } from 'vitest'
import { mkdtemp, stat, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'
import { stampOriginal } from './ingest.ts'
import { buildXmp, readXmp } from './xmp.ts'

const png = () =>
  sharp({ create: { width: 8, height: 8, channels: 3, background: '#123456' } }).png().toBuffer()

/** A file whose mtime is a known, deliberately old value. */
async function aged(name: string, when: Date) {
  const dir = await mkdtemp(join(tmpdir(), 'transom-stamp-'))
  const path = join(dir, name)
  await writeFile(path, await png())
  await utimes(path, when, when)
  return path
}

describe('stampOriginal', () => {
  const born = new Date('2026-09-01T12:00:00Z')

  it('writes the stamp into the file', async () => {
    const path = await aged('a.png', born)
    await stampOriginal(path, buildXmp({ caption: 'a caption', zone: 'z' }))
    const meta = await sharp(path).metadata()
    expect(readXmp(meta.xmp!.toString('utf8')).caption).toBe('a caption')
  })

  it('leaves mtime alone, because a restart derives bornAt from it', async () => {
    // `adopt` reads mtime so a daemon restart does not resurrect the wall.
    // A stamp that bumps mtime re-ages every item on the wall, silently.
    const path = await aged('b.png', born)
    await stampOriginal(path, buildXmp({ caption: 'x' }))
    const { mtime } = await stat(path)
    expect(Math.round(mtime.getTime() / 1000)).toBe(Math.round(born.getTime() / 1000))
  })

  it('leaves a format it cannot stamp losslessly untouched', async () => {
    const path = await aged('c.jpg', born)
    const before = await stat(path)
    await stampOriginal(path, buildXmp({ caption: 'x' }))
    const after = await stat(path)
    expect(after.size).toBe(before.size)
    expect(after.mtimeMs).toBe(before.mtimeMs)
  })
})
