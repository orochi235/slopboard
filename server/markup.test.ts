import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { WallItem } from '@shared/protocol.ts'
import { looksLikeClaude } from './markup.ts'

/** The store and `config` read the environment at import, as in store.test.ts. */
async function fresh(root: string) {
  process.env.TRANSOM_ROOT = root
  vi.resetModules()
  return { store: await import('./store.ts'), marks: await import('./markup.ts') }
}

const itemAt = (path: string, over: Partial<WallItem> = {}): WallItem => ({
  id: 'a1',
  url: '/img/a1',
  origUrl: '/orig/a1',
  zone: 'transom',
  name: 'the sky',
  path,
  bornAt: 1000,
  w: 10,
  h: 10,
  ...over,
})

const drawn = { png: Buffer.from('composite'), marks: { version: 1, scenes: {} }, text: 'bluer' }

let root: string
let source: string
/** A process whose command line is a `claude` binary, for a live sender. */
let claude: ChildProcess | null = null

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'transom-marks-'))
  source = join(root, 'inbox', 'transom', 'a.png')
  await mkdir(join(root, 'inbox', 'transom'), { recursive: true })
  await writeFile(source, 'png')
})

afterEach(async () => {
  claude?.kill()
  claude = null
  vi.useRealTimers()
  await rm(root, { recursive: true, force: true })
})

async function liveClaude(): Promise<number> {
  const bin = join(root, 'claude')
  await symlink('/bin/sleep', bin)
  claude = spawn(bin, ['30'], { stdio: 'ignore' })
  await new Promise((r) => setTimeout(r, 100))
  return claude.pid!
}

describe('looksLikeClaude', () => {
  it('knows the binary and the npm package', () => {
    expect(looksLikeClaude('/Users/x/.local/bin/claude --resume')).toBe(true)
    expect(looksLikeClaude('node /opt/lib/node_modules/@anthropic-ai/claude-code/cli.js')).toBe(true)
  })
  it('is not fooled by a path under .claude', () => {
    expect(looksLikeClaude('node /r/.claude/worktrees/a/node_modules/.bin/vitest')).toBe(false)
  })
})

describe('markUp', () => {
  it('answers an open question when no session was recorded, which is a waiting ask', async () => {
    const { store, marks } = await fresh(root)
    store.add({ item: itemAt(source, { question: 'better?' }), sourcePath: source, cachePath: '' })

    const news = await store.markUp('a1', drawn)
    expect(news?.markup).toMatchObject({ status: 'delivered', via: 'ask', text: 'bluer' })
    expect(news?.reply?.status).toBe('marked')
    // The second line is the composite, so `transom ask` can print its path.
    expect(await readFile(join(root, 'answers', 'a.png'), 'utf8')).toBe(`marked\n${marks.pngOf('a1')}\nbluer`)
    expect(await readFile(marks.pngOf('a1'), 'utf8')).toBe('composite')
  })

  it('holds the card while its sender is not running, and lets it go once discarded', async () => {
    const { store, marks } = await fresh(root)
    // Alive, but not a claude process: a reused pid.
    const sender = { session: 's-gone', pid: process.pid }
    store.add({ item: itemAt(source, { question: 'better?' }), sourcePath: source, cachePath: '', sender })

    const news = await store.markUp('a1', drawn)
    expect(news?.markup).toMatchObject({ status: 'pending', live: false })
    // Not answered: nobody is there to read it.
    expect(existsSync(join(root, 'answers', 'a.png'))).toBe(false)
    expect(existsSync(join(root, 'marks', 'waiting', 's-gone'))).toBe(true)

    const discarded = await store.discardMarks('a1')
    expect(discarded?.markup.status).toBe('discarded')
    expect(existsSync(marks.pngOf('a1'))).toBe(false)
    expect(existsSync(join(root, 'marks', 'waiting', 's-gone'))).toBe(false)
    expect((await marks.read('a1'))?.status).toBe('discarded')
  })

  it('keeps a card with unsent marks past its lifetime', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'Date'] })
    const { store } = await fresh(root)
    store.add({
      item: itemAt(source, { ttlMs: 1000 }),
      sourcePath: source,
      cachePath: '',
      sender: { session: 's', pid: process.pid },
    })
    await store.markUp('a1', drawn)
    const stop = store.startSweeper()
    vi.advanceTimersByTime(5000)
    expect(store.snapshot().map((i) => i.id)).toEqual(['a1'])
    stop()
  })

  it('takes the marks to the trash with the card, and brings them back on undo', async () => {
    const { store, marks } = await fresh(root)
    store.add({ item: itemAt(source), sourcePath: source, cachePath: '', sender: { session: 's' } })
    await store.markUp('a1', drawn)

    await store.expireNow('a1')
    expect(existsSync(marks.pngOf('a1'))).toBe(false)
    expect(existsSync(join(root, 'marks', 'waiting', 's'))).toBe(false)

    await store.undoExpiry()
    expect(await readFile(marks.pngOf('a1'), 'utf8')).toBe('composite')
    expect(existsSync(join(root, 'marks', 'waiting', 's'))).toBe(true)
  })

  it('hands a live session its marks once, and marks them delivered', async () => {
    const { store, marks } = await fresh(root)
    const sender = { session: 's-live', pid: await liveClaude() }
    store.add({ item: itemAt(source), sourcePath: source, cachePath: '', sender })

    const news = await store.markUp('a1', drawn)
    expect(news?.markup).toMatchObject({ status: 'pending', live: true })

    const first = await store.claimMarks('s-live')
    expect(first.claimed).toEqual([
      { id: 'a1', caption: 'the sky', zone: 'transom', image: marks.pngOf('a1'), text: 'bluer' },
    ])
    expect(first.news[0]?.markup).toMatchObject({ status: 'delivered', via: 'hook' })
    expect(existsSync(join(root, 'marks', 'waiting', 's-live'))).toBe(false)
    expect((await store.claimMarks('s-live')).claimed).toEqual([])
  })

  it('reports a sender that has exited since', async () => {
    const { store } = await fresh(root)
    const sender = { session: 's', pid: await liveClaude() }
    store.add({ item: itemAt(source), sourcePath: source, cachePath: '', sender })
    await store.markUp('a1', drawn)

    claude?.kill()
    await new Promise((r) => setTimeout(r, 100))
    const news = await store.recheckSenders()
    expect(news.map((n) => n.markup.live)).toEqual([false])
    expect(await store.recheckSenders()).toEqual([])
  })

  it('refuses a run card, whose drawings are on its takes', async () => {
    const { store } = await fresh(root)
    store.addTake(
      itemAt(source, { id: 'run1' }),
      { id: 't1', url: '', origUrl: '', name: 'take one', path: source, at: 1, w: 1, h: 1 },
      { sourcePath: source, cachePath: '' },
      {},
    )
    expect(await store.markUp('run1', drawn)).toBeNull()
    const news = await store.markUp('t1', drawn)
    expect(news).toMatchObject({ id: 'run1', take: 't1' })
    expect(store.snapshot()[0]?.takes?.[0]?.markup?.status).toBe('pending')
  })
})
