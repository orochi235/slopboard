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

  it('prints a free-text answer after the path, and exits cleanly', async () => {
    // A blank second line is what keeps the first line of the text from being
    // read as a choice.
    const { code, out, sent } = await ask(['--ask', 'q'], 'answered\n\ntwo\nlines')
    expect(code).toBe(0)
    expect(out).toBe(`${sent}\ntwo\nlines\n`)
    expect(existsSync(join(root, 'answers', basename(sent)))).toBe(false)
  })

  it('prints the chip where the answer was one', async () => {
    const { out, sent } = await ask(['--ask', 'q', '--choice', 'better'], 'answered\nbetter\n')
    expect(out).toBe(`${sent}\nbetter\n`)
  })

  it('prints the whole reply with --json, for a caller that wants both parts', async () => {
    const { out, sent } = await ask(['--json', '--ask', 'q', '--choice', 'worse', '--why'], 'answered\nworse\ntoo "dark"')
    expect(out.slice(sent.length + 1)).toBe(
      `${JSON.stringify({ status: 'answered', choice: 'worse', text: 'too "dark"' })}\n`,
    )
  })

  it('exits 3 when the question is dismissed, and 4 when the card expires first', async () => {
    expect((await ask(['--ask', 'q'], 'dismissed\n\n')).code).toBe(3)
    await rm(join(root, 'inbox'), { recursive: true, force: true })
    expect((await ask(['--ask', 'q'], 'expired\n\n')).code).toBe(4)
  })

  it('offers a free-text box only where something asked', async () => {
    const { sent } = await ask(['--ask', 'q', '--why', 'what is off about it?'], 'answered\n\nnothing')
    expect(parseStamp(JSON.parse(await readFile(`${sent}.slop.json`, 'utf8'))).why).toBe('what is off about it?')
  })

  it('takes --why bare, and does not eat the file it is sending', async () => {
    const { sent } = await ask(['--ask', 'q', '--why'], 'answered\n\nnothing')
    expect(parseStamp(JSON.parse(await readFile(`${sent}.slop.json`, 'utf8'))).why).toBe('anything to add?')
    expect(sent.endsWith('.png')).toBe(true)
  })
})

describe('slop --run', () => {
  /** Sends without waiting, which is what a run does: the caller holds the
   *  paths and collects the answers itself. */
  async function send(args: string[], files = [png]) {
    const child = spawn('sh', [SLOP, '--zone', 'z', ...args, ...files], {
      env: { ...process.env, SLOP_ROOT: root },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    const code = await new Promise<number | null>((r) => child.on('exit', r))
    return { code, out, err, sent: out.trim().split('\n').filter(Boolean) }
  }

  const stampOf = async (path: string) => parseStamp(JSON.parse(await readFile(`${path}.slop.json`, 'utf8')))

  it('names the run, its label and how many takes are coming', async () => {
    const { sent } = await send(['--run', 'sweep-3', '--run-label', 'outline sweep', '--of', '12'])
    const stamp = await stampOf(sent[0]!)
    expect(stamp.run).toBe('sweep-3')
    expect(stamp.runLabel).toBe('outline sweep')
    expect(stamp.of).toBe(12)
  })

  it('takes several files in one send, since a run answers per take', async () => {
    const second = join(root, 'two.png')
    await writeFile(second, 'png')
    const { code, sent } = await send(['--run', 'r', '--ask', 'how does this read?', '--no-wait'], [png, second])
    expect(code).toBe(0)
    expect(sent).toHaveLength(2)
    expect((await stampOf(sent[1]!)).question).toBe('how does this read?')
  })

  it('refuses several files for a question outside a run', async () => {
    const second = join(root, 'two.png')
    await writeFile(second, 'png')
    const { code, err } = await send(['--ask', 'q'], [png, second])
    expect(code).toBe(1)
    expect(err).toContain('one answer comes back')
  })

  it('refuses a run count that is not one', async () => {
    expect((await send(['--run', 'r', '--of', 'lots'])).code).toBe(1)
    expect((await send(['--run', 'r', '--of', '0'])).code).toBe(1)
  })

  it('refuses --run-label and --of without a run to hang them on', async () => {
    expect((await send(['--run-label', 'x'])).code).toBe(1)
    expect((await send(['--of', '3'])).code).toBe(1)
  })
})

describe('slop --app and --link', () => {
  async function send(args: string[]) {
    const child = spawn('sh', [SLOP, '--zone', 'z', ...args, png], {
      env: { ...process.env, SLOP_ROOT: root },
    })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    const code = await new Promise<number | null>((r) => child.on('exit', r))
    return { code, err, sent: out.trim() }
  }

  const stampOf = async (path: string) => parseStamp(JSON.parse(await readFile(`${path}.slop.json`, 'utf8')))

  it('hands a bare --app the artifact itself, which is the copy in the inbox', async () => {
    const { sent } = await send(['--app', 'LDView'])
    expect((await stampOf(sent)).apps).toEqual([{ name: 'LDView', path: sent }])
  })

  it('makes a named file absolute, since the daemon does not share this directory', async () => {
    const { sent } = await send(['--app', `LDView=${png}`, '--app', 'Finder'])
    expect((await stampOf(sent)).apps).toEqual([
      { name: 'LDView', path: png },
      { name: 'Finder', path: sent },
    ])
  })

  it('labels a bare link with its host, and takes label=url', async () => {
    const { sent } = await send([
      '--link',
      'https://rebrickable.com/parts/3001/',
      '--link',
      'part 3001=https://example.com/a?b=c',
    ])
    expect((await stampOf(sent)).links).toEqual([
      { label: 'rebrickable.com', url: 'https://rebrickable.com/parts/3001/' },
      { label: 'part 3001', url: 'https://example.com/a?b=c' },
    ])
  })

  it('refuses a link a browser would not open', async () => {
    const { code, err } = await send(['--link', 'file:///etc/passwd'])
    expect(code).toBe(1)
    expect(err).toContain('http(s)')
  })
})
