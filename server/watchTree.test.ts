import { mkdtempSync } from 'node:fs'
import { mkdir, rm, writeFile, appendFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { nativeRecursiveSupported, watchTree, type TreeWatcher } from './watchTree.ts'

async function waitFor(pred: () => boolean, ms = 4000): Promise<void> {
  const deadline = Date.now() + ms
  while (!pred()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out')
    await new Promise((r) => setTimeout(r, 20))
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

describe('nativeRecursiveSupported', () => {
  it('is true only where the OS has a recursive watcher worth trusting', () => {
    expect(nativeRecursiveSupported('darwin')).toBe(true)
    expect(nativeRecursiveSupported('win32')).toBe(true)
    // Recursive fs.watch reached Linux in node 20 and still carries caveats;
    // chokidar's inotify path was never the fd bomb there anyway.
    expect(nativeRecursiveSupported('linux')).toBe(false)
    expect(nativeRecursiveSupported('freebsd')).toBe(false)
  })
})

const backends: Array<'native' | 'chokidar'> = ['chokidar']
if (nativeRecursiveSupported()) backends.unshift('native')

describe.each(backends)('watchTree (%s)', (backend) => {
  let root = ''
  let w: TreeWatcher | null = null

  afterEach(async () => {
    await w?.close()
    w = null
    if (root) await rm(root, { recursive: true, force: true })
  })

  const start = async (opts: Partial<Parameters<typeof watchTree>[1]> = {}) => {
    const hits: Array<[string, boolean]> = []
    w = watchTree(root, {
      backend,
      settleMs: 60,
      pollMs: 20,
      onFile: (p, adopting) => hits.push([p, adopting]),
      ...opts,
    })
    await w.ready
    return hits
  }

  it('emits a file dropped into a zone that was already there', async () => {
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    await mkdir(join(root, 'brick-icons'))
    const hits = await start()

    const f = join(root, 'brick-icons', 'a.png')
    await writeFile(f, 'x'.repeat(2048))
    await waitFor(() => hits.some(([p]) => p === f))
    expect(hits.find(([p]) => p === f)?.[1]).toBe(false)
  })

  it('emits the first file in a zone created moments earlier', async () => {
    // `bin/slop` does `mkdir -p` then writes: the zone and its first artifact
    // arrive together, which is the window a per-directory watcher loses.
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    const hits = await start()

    const dir = join(root, 'mirror')
    await mkdir(dir)
    const f = join(dir, 'first.png')
    await writeFile(f, 'x'.repeat(2048))
    await waitFor(() => hits.some(([p]) => p === f))
  })

  it('adopts what was already in the inbox when it started', async () => {
    // Written immediately before the watch on purpose: FSEvents replays a
    // just-before-start write as a live event, so the file arrives by both
    // routes and adopting must not be decided by whichever wins. Dating it now
    // would give an artifact due for the trash a fresh lifetime on the wall.
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    await mkdir(join(root, 'weasel'))
    const old = join(root, 'weasel', 'old.png')
    await writeFile(old, 'x'.repeat(2048))

    const hits = await start()
    await waitFor(() => hits.some(([p]) => p === old))
    expect(hits.filter(([p]) => p === old).map(([, adopting]) => adopting)).toEqual([true])
  })

  it('ignores a file sitting directly in the inbox root', async () => {
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    const hits = await start()

    await writeFile(join(root, 'stray.png'), 'x'.repeat(2048))
    await sleep(400)
    expect(hits).toHaveLength(0)
  })

  it('ignores what the caller says to ignore', async () => {
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    await mkdir(join(root, 'z'))
    const hits = await start({ ignore: (p) => p.endsWith('.slop.json') })

    await writeFile(join(root, 'z', 'a.png.slop.json'), '{}')
    const keep = join(root, 'z', 'a.png')
    await writeFile(keep, 'x'.repeat(2048))

    await waitFor(() => hits.some(([p]) => p === keep))
    expect(hits.some(([p]) => p.endsWith('.slop.json'))).toBe(false)
  })

  it('waits for a streamed write to stop growing before emitting', async () => {
    // `gen | slop renders` writes over several ticks; handing sharp a
    // truncated file is what `awaitWriteFinish` bought under chokidar.
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    await mkdir(join(root, 'z'))
    const sizes: number[] = []
    const f = join(root, 'z', 'streamed.png')
    w = watchTree(root, {
      backend,
      settleMs: 200,
      pollMs: 20,
      onFile: () => sizes.push(1),
    })
    await w.ready

    await writeFile(f, 'x'.repeat(1024))
    for (let i = 0; i < 5; i++) {
      await sleep(60)
      await appendFile(f, 'x'.repeat(1024))
    }
    expect(sizes).toHaveLength(0) // still growing

    await waitFor(() => sizes.length > 0)
  })

  it('stops emitting once closed', async () => {
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    await mkdir(join(root, 'z'))
    const hits = await start()
    await w!.close()
    w = null

    await writeFile(join(root, 'z', 'after.png'), 'x'.repeat(2048))
    await sleep(400)
    expect(hits).toHaveLength(0)
  })
})

// The reason for the backend at all: one handle for the tree, not one per
// file. chokidar without fsevents opens a descriptor per watched path, and the
// daemon's cost then grows with everything on the wall.
;(nativeRecursiveSupported() ? describe : describe.skip)('native watch cost', () => {
  let root = ''
  let w: TreeWatcher | null = null

  afterEach(async () => {
    await w?.close()
    w = null
    if (root) await rm(root, { recursive: true, force: true })
  })

  const fsEventHandles = () =>
    (process.report.getReport() as { libuv: Array<{ type: string }> }).libuv.filter(
      (h) => h.type === 'fs_event',
    ).length

  it('holds one handle for the whole inbox however many artifacts it has', async () => {
    root = mkdtempSync(join(tmpdir(), 'wt-'))
    for (let z = 0; z < 8; z++) {
      await mkdir(join(root, `zone${z}`))
      for (let i = 0; i < 25; i++) {
        await writeFile(join(root, `zone${z}`, `a${i}.png`), 'x'.repeat(512))
      }
    }

    const before = fsEventHandles()
    w = watchTree(root, { backend: 'native', onFile: () => {} })
    await w.ready
    expect(fsEventHandles() - before).toBe(1)
  })
})
