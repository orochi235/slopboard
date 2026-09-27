import { execFile } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { Response } from 'express'
import { afterEach, describe, expect, it } from 'vitest'
import { readOriginal, serveZip } from './serveZip.ts'

const run = promisify(execFile)

const scratch: string[] = []
const dir = async () => {
  const made = await mkdtemp(join(tmpdir(), 'transom-serve-zip-'))
  scratch.push(made)
  return made
}
afterEach(async () => {
  for (const made of scratch.splice(0)) await rm(made, { recursive: true, force: true })
})

/** Enough of an express response for the streaming to write into. */
const fakeRes = () => {
  const chunks: Uint8Array[] = []
  const headers: Record<string, string> = {}
  const res = {
    writableEnded: false,
    set: (key: string, value: string) => void (headers[key] = value),
    write: (chunk: Uint8Array) => (chunks.push(chunk), true),
    once: () => res,
    end: () => void (res.writableEnded = true),
  }
  return { res, chunks, headers }
}

/** What the archive holds, by name, read back with the system unzip. */
const namesIn = async (chunks: Uint8Array[], into: string) => {
  const total = chunks.reduce((n, c) => n + c.length, 0)
  const all = new Uint8Array(total)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.length
  }
  const archive = join(into, 'out.zip')
  await writeFile(archive, all)
  const { stdout } = await run('unzip', ['-Z1', archive])
  return stdout.trim().split('\n').filter(Boolean)
}

describe('serveZip', () => {
  it('names the download and streams the files the plan asked for', async () => {
    const made = await dir()
    await writeFile(join(made, 'one.png'), 'one')
    await writeFile(join(made, 'two.png'), 'two')
    const { res, chunks, headers } = fakeRes()

    await serveZip(
      res as unknown as Response,
      [
        { id: 'a', name: 'one.png' },
        { id: 'b', name: 'runs/two.png' },
      ],
      'transom-zone-20260927-1405.zip',
      readOriginal((id) => join(made, id === 'a' ? 'one.png' : 'two.png')),
    )

    expect(headers['Content-Type']).toBe('application/zip')
    expect(headers['Content-Disposition']).toBe(
      'attachment; filename="transom-zone-20260927-1405.zip"',
    )
    expect(res.writableEnded).toBe(true)
    expect(await namesIn(chunks, made)).toEqual(['one.png', 'runs/two.png'])
  })

  it('drops a file the disk no longer holds rather than failing the download', async () => {
    const made = await dir()
    await writeFile(join(made, 'one.png'), 'one')
    const { res, chunks } = fakeRes()

    await serveZip(
      res as unknown as Response,
      [
        { id: 'a', name: 'one.png' },
        { id: 'gone', name: 'gone.png' },
      ],
      'a.zip',
      readOriginal((id) => (id === 'a' ? join(made, 'one.png') : undefined)),
    )

    expect(await namesIn(chunks, made)).toEqual(['one.png'])
  })
})
