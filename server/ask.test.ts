import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStamp } from './sidecar.ts'

const SLOP = fileURLToPath(new URL('../bin/slop', import.meta.url))

let root: string
let png: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'slop-ask-'))
  png = join(root, 'shot.png')
  await writeFile(png, 'png')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Runs `slop`, and plays the daemon once the sidecar lands: answers with
 *  `reply`, as the store would write it. */
function ask(args: string[], reply: string) {
  const child = spawn('sh', [SLOP, '--zone', 'z', ...args, png], { env: { ...process.env, SLOP_ROOT: root } })
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (err += d))
  const inbox = join(root, 'inbox', 'z')
  const answered = (async () => {
    for (;;) {
      const sent = existsSync(inbox) ? readdirSync(inbox).find((f) => f.endsWith('.png')) : undefined
      if (sent) {
        await mkdir(join(root, 'answers'), { recursive: true })
        await writeFile(join(root, 'answers', sent), reply)
        return join(inbox, sent)
      }
      await new Promise((r) => setTimeout(r, 50))
    }
  })()
  return new Promise<{ code: number | null; out: string; err: string; sent: string }>((resolve) =>
    child.on('exit', async (code) => resolve({ code, out, err, sent: await answered })),
  )
}

describe('slop --ask', () => {
  it('writes the question and its choices where ingest reads them, even with quotes and newlines', async () => {
    const { sent } = await ask(['--ask', 'which "crop"?\nsecond line', '--choice', 'left', '--choice', 'a\\b'], 'answered\nleft')
    const stamp = parseStamp(JSON.parse(await readFile(`${sent}.slop.json`, 'utf8')))
    expect(stamp.question).toBe('which "crop"?\nsecond line')
    expect(stamp.choices).toEqual(['left', 'a\\b'])
  })

  it('prints the answer after the path, and exits cleanly', async () => {
    const { code, out, sent } = await ask(['--ask', 'q'], 'answered\ntwo\nlines')
    expect(code).toBe(0)
    expect(out).toBe(`${sent}\ntwo\nlines\n`)
    expect(existsSync(join(root, 'answers', basename(sent)))).toBe(false)
  })

  it('exits 3 when the question is dismissed, and 4 when the card expires first', async () => {
    expect((await ask(['--ask', 'q'], 'dismissed\n')).code).toBe(3)
    await rm(join(root, 'inbox'), { recursive: true, force: true })
    expect((await ask(['--ask', 'q'], 'expired\n')).code).toBe(4)
  })
})
