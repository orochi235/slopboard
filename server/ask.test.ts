import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawn } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseStamp } from './sidecar.ts'

const TRANSOM = fileURLToPath(new URL('../bin/transom', import.meta.url))

let root: string
let png: string

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'transom-ask-'))
  png = join(root, 'shot.png')
  await writeFile(png, 'png')
})

afterEach(async () => {
  await rm(root, { recursive: true, force: true })
})

/** Runs `transom`, with nothing on stdin so that a send with no file ends. */
function transom(args: string[], env: Record<string, string> = {}) {
  return spawn('sh', [TRANSOM, ...args], {
    env: { ...process.env, TRANSOM_ROOT: root, TRANSOM_ZONE: 'z', ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

/** Runs it to the end, for a command that does not wait on the wall. */
async function run(args: string[], env: Record<string, string> = {}) {
  const child = transom(args, env)
  let out = ''
  let err = ''
  child.stdout.on('data', (d) => (out += d))
  child.stderr.on('data', (d) => (err += d))
  const code = await new Promise<number | null>((r) => child.on('exit', r))
  return { code, out, err, sent: out.trim().split('\n').filter(Boolean) }
}

const stampOf = async (path: string) => parseStamp(JSON.parse(await readFile(`${path}.transom.json`, 'utf8')))

/** Plays the daemon once the image lands: answers with `reply`, as the store
 *  would write it. */
async function answer(reply: string) {
  const inbox = join(root, 'inbox', 'z')
  for (;;) {
    const sent = existsSync(inbox) ? readdirSync(inbox).find((f) => f.endsWith('.png')) : undefined
    if (sent) {
      await mkdir(join(root, 'answers'), { recursive: true })
      await writeFile(join(root, 'answers', sent), reply)
      return join(inbox, sent)
    }
    await new Promise((r) => setTimeout(r, 50))
  }
}

/** Asks, and answers it. */
async function ask(question: string, args: string[], reply: string) {
  const asked = run(['ask', question, ...args, png])
  const sent = await answer(reply)
  return { ...(await asked), sent }
}

describe('transom ask', () => {
  it('writes the question and its choices where ingest reads them, even with quotes and newlines', async () => {
    const { sent } = await ask('which "crop"?\nsecond line', ['--choice', 'left', '--choice', 'a\\b'], 'answered\nleft')
    const stamp = await stampOf(sent)
    expect(stamp.question).toBe('which "crop"?\nsecond line')
    expect(stamp.choices).toEqual(['left', 'a\\b'])
  })

  it('prints a free-text answer after the path, and exits cleanly', async () => {
    // A blank second line is what keeps the first line of the text from being
    // read as a choice.
    const { code, out, sent } = await ask('q', [], 'answered\n\ntwo\nlines')
    expect(code).toBe(0)
    expect(out).toBe(`${sent}\ntwo\nlines\n`)
    expect(existsSync(join(root, 'answers', basename(sent)))).toBe(false)
  })

  it('prints the chip where the answer was one', async () => {
    const { out, sent } = await ask('q', ['--choice', 'better'], 'answered\nbetter\n')
    expect(out).toBe(`${sent}\nbetter\n`)
  })

  it('prints the whole reply with --json, for a caller that wants both parts', async () => {
    const { out, sent } = await ask('q', ['--json', '--choice', 'worse', '--why'], 'answered\nworse\ntoo "dark"')
    expect(out.slice(sent.length + 1)).toBe(
      `${JSON.stringify({ status: 'answered', choice: 'worse', text: 'too "dark"' })}\n`,
    )
  })

  it('exits 3 when the question is dismissed, and 4 when the card expires first', async () => {
    expect((await ask('q', [], 'dismissed\n\n')).code).toBe(3)
    await rm(join(root, 'inbox'), { recursive: true, force: true })
    expect((await ask('q', [], 'expired\n\n')).code).toBe(4)
  })

  it('prints the marked-up picture and the text, and exits 5, when the viewer drew instead', async () => {
    const { code, out, err, sent } = await ask('q', ['--choice', 'yes'], 'marked\n/t/marks/a.png\nbluer')
    expect(code).toBe(5)
    expect(out).toBe(`${sent}\n/t/marks/a.png\nbluer\n`)
    expect(err).toContain('marked up')
  })

  it('names the picture in --json for a drawing', async () => {
    const { out, sent } = await ask('q', ['--json'], 'marked\n/t/marks/a.png\n')
    expect(out.slice(sent.length + 1)).toBe(`${JSON.stringify({ status: 'marked', image: '/t/marks/a.png', text: '' })}\n`)
  })

  it('offers a free-text box only where something asked', async () => {
    const { sent } = await ask('q', ['--why', 'what is off about it?'], 'answered\n\nnothing')
    expect((await stampOf(sent)).why).toBe('what is off about it?')
  })

  it('takes --why bare, and does not eat the file it is sending', async () => {
    const { sent } = await ask('q', ['--why'], 'answered\n\nnothing')
    expect((await stampOf(sent)).why).toBe('anything to add?')
    expect(sent.endsWith('.png')).toBe(true)
  })

  it('wants the question first, since a flag there would be read as one', async () => {
    const { code, err } = await run(['ask', '--choice', 'left', png])
    expect(code).toBe(1)
    expect(err).toContain('the question comes first')
  })

  it('refuses several files outside a group', async () => {
    const second = join(root, 'two.png')
    await writeFile(second, 'png')
    const { code, err } = await run(['ask', 'q', png, second])
    expect(code).toBe(1)
    expect(err).toContain('one answer comes back')
  })
})

describe('transom wait', () => {
  it('collects the answer to a question sent with --no-wait', async () => {
    const { code, sent } = await run(['ask', 'q', '--no-wait', png])
    expect(code).toBe(0)
    await answer('answered\nleft\n')
    const waited = await run(['wait', sent[0]!])
    expect(waited.code).toBe(0)
    expect(waited.out).toBe('left\n')
  })

  it('prints the whole reply with --json', async () => {
    const { sent } = await run(['ask', 'q', '--no-wait', png])
    await answer('dismissed\n\n')
    const waited = await run(['wait', '--json', sent[0]!])
    expect(waited.code).toBe(3)
    expect(waited.out).toBe(`${JSON.stringify({ status: 'dismissed', choice: '', text: '' })}\n`)
  })
})

describe('transom post', () => {
  it('records the Claude Code session it ran under, where a drawing goes back to', async () => {
    const { sent } = await run(['post', png], { CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: '4242' })
    const blob = JSON.parse(await readFile(`${sent[0]}.transom.json`, 'utf8'))
    expect(blob.session).toBe('sess-1')
    expect(blob.pid).toBe(4242)
    expect(parseStamp(blob)).toMatchObject({ session: 'sess-1', pid: 4242 })
  })

  it('drops a pid that is not a number, and records nothing outside a session', async () => {
    const odd = await run(['post', png], { CLAUDE_CODE_SESSION_ID: 'sess-1', CLAUDE_PID: '12; rm' })
    expect(JSON.parse(await readFile(`${odd.sent[0]}.transom.json`, 'utf8')).pid).toBeUndefined()
    const none = await run(['post', png], { CLAUDE_CODE_SESSION_ID: '', CLAUDE_PID: '' })
    const stamp = await stampOf(none.sent[0]!)
    expect(stamp.session).toBeUndefined()
  })

  it('sends and returns, with no question on the card', async () => {
    const { code, sent } = await run(['post', png])
    expect(code).toBe(0)
    expect(sent).toHaveLength(1)
    expect((await stampOf(sent[0]!)).question).toBeUndefined()
  })

  it('refuses what only means something beside a question', async () => {
    for (const flag of [['--choice', 'left'], ['--why'], ['--json'], ['--no-wait']]) {
      const { code, err } = await run(['post', ...flag, png])
      expect(code).toBe(1)
      expect(err).toContain('belongs to `transom ask`')
    }
  })

  it('names a flag it does not have, rather than looking for a file called that', async () => {
    const { code, err } = await run(['post', '--ask', 'q', png])
    expect(code).toBe(1)
    expect(err).toContain('no such flag: --ask')
  })

  it('names the group, its label and how many takes are coming', async () => {
    const { sent } = await run(['post', '--group', 'sweep-3', '--group-label', 'outline sweep', '--of', '12', png])
    const stamp = await stampOf(sent[0]!)
    expect(stamp.group).toBe('sweep-3')
    expect(stamp.groupLabel).toBe('outline sweep')
    expect(stamp.of).toBe(12)
  })

  it('still takes the v0.2.0 spellings, on the command line and in a sidecar', async () => {
    const { sent } = await run(['post', '--run', 'sweep-3', '--run-label', 'outline sweep', png])
    expect(await stampOf(sent[0]!)).toMatchObject({ group: 'sweep-3', groupLabel: 'outline sweep' })
    expect(parseStamp({ run: 'old', runLabel: 'old label' })).toMatchObject({ group: 'old', groupLabel: 'old label' })
  })

  it('takes several files for a question in a group, since a group answers per take', async () => {
    const second = join(root, 'two.png')
    await writeFile(second, 'png')
    const { code, sent } = await run(['ask', 'how does this read?', '--group', 'r', '--no-wait', png, second])
    expect(code).toBe(0)
    expect(sent).toHaveLength(2)
    expect((await stampOf(sent[1]!)).question).toBe('how does this read?')
  })

  it('refuses a group count that is not one', async () => {
    expect((await run(['post', '--group', 'r', '--of', 'lots', png])).code).toBe(1)
    expect((await run(['post', '--group', 'r', '--of', '0', png])).code).toBe(1)
  })

  it('refuses --group-label and --of without a group to hang them on', async () => {
    expect((await run(['post', '--group-label', 'x', png])).code).toBe(1)
    expect((await run(['post', '--of', '3', png])).code).toBe(1)
  })

  it('hands a bare --app the artifact itself, which is the copy in the inbox', async () => {
    const { sent } = await run(['post', '--app', 'LDView', png])
    expect((await stampOf(sent[0]!)).apps).toEqual([{ name: 'LDView', path: sent[0] }])
  })

  it('makes a named file absolute, since the daemon does not share this directory', async () => {
    const { sent } = await run(['post', '--app', `LDView=${png}`, '--app', 'Finder', png])
    expect((await stampOf(sent[0]!)).apps).toEqual([
      { name: 'LDView', path: png },
      { name: 'Finder', path: sent[0] },
    ])
  })

  it('labels a bare link with its host, and takes label=url', async () => {
    const { sent } = await run([
      'post',
      '--link',
      'https://rebrickable.com/parts/3001/',
      '--link',
      'part 3001=https://example.com/a?b=c',
      png,
    ])
    expect((await stampOf(sent[0]!)).links).toEqual([
      { label: 'rebrickable.com', url: 'https://rebrickable.com/parts/3001/' },
      { label: 'part 3001', url: 'https://example.com/a?b=c' },
    ])
  })

  it('refuses a link a browser would not open', async () => {
    const { code, err } = await run(['post', '--link', 'file:///etc/passwd', png])
    expect(code).toBe(1)
    expect(err).toContain('http(s)')
  })
})

describe('transom', () => {
  it('prints the zone a send would land in', async () => {
    expect((await run(['zone'])).out).toBe('z\n')
  })

  it('refuses a command it does not have', async () => {
    const { code, err } = await run(['nope', png])
    expect(code).toBe(1)
    expect(err).toContain('no such command: nope')
  })
})
