import { mkdtempSync, mkdirSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  candidates, excepted, isImage, message, onWall, pathsInCommand, toNudge,
} from './wall-nudge.mjs'

let dir
beforeEach(() => { dir = mkdtempSync(path.join(tmpdir(), 'wall-nudge-')) })
afterEach(() => { delete process.env.TRANSOM_ROOT })

const touch = (name, ageMs = 0) => {
  const p = path.join(dir, name)
  mkdirSync(path.dirname(p), { recursive: true })
  writeFileSync(p, 'x')
  if (ageMs) {
    const t = (Date.now() - ageMs) / 1000
    utimesSync(p, t, t)
  }
  return p
}

describe('isImage', () => {
  it('accepts the raster and vector extensions', () => {
    for (const n of ['a.png', 'a.JPG', 'a.jpeg', 'a.gif', 'a.webp', 'a.svg', 'a.avif']) {
      expect(isImage(n)).toBe(true)
    }
  })
  it('rejects everything else', () => {
    for (const n of ['a.ts', 'a.pdf', 'a.pngx', 'png', null]) expect(isImage(n)).toBe(false)
  })
})

describe('pathsInCommand', () => {
  it('finds a redirect target', () => {
    expect(pathsInCommand('python plot.py > /tmp/chart.png')).toEqual(['/tmp/chart.png'])
  })
  it('finds a flag value and dedupes repeats', () => {
    expect(pathsInCommand('magick in.png -resize 50% out.png && ls out.png'))
      .toEqual(['in.png', 'out.png'])
  })
  it('ignores quoting and pipe characters', () => {
    expect(pathsInCommand('convert "a.png"|cat')).toEqual(['a.png'])
  })
  it('returns nothing for a command with no image', () => {
    expect(pathsInCommand('npm test')).toEqual([])
  })
})

describe('candidates', () => {
  it('takes an image the agent read', () => {
    expect(candidates({ tool_name: 'Read', tool_input: { file_path: '/t/a.png' } }))
      .toEqual(['/t/a.png'])
  })
  it('ignores a source file the agent read', () => {
    expect(candidates({ tool_name: 'Read', tool_input: { file_path: '/t/a.ts' } })).toEqual([])
  })
  it('takes an image the agent wrote', () => {
    expect(candidates({ tool_name: 'Write', tool_input: { file_path: '/t/a.svg' } }))
      .toEqual(['/t/a.svg'])
  })
  it('stays quiet when the command already sends to the wall', () => {
    expect(candidates({ tool_name: 'Bash', tool_input: { command: 'transom post /tmp/a.png' } }))
      .toEqual([])
    expect(candidates({ tool_name: 'Bash', tool_input: { command: 'gen | transom post' } })).toEqual([])
  })
  it('ignores tools that cannot produce an image', () => {
    expect(candidates({ tool_name: 'Grep', tool_input: { pattern: 'a.png' } })).toEqual([])
  })
})

describe('excepted', () => {
  it('is false with no CLAUDE.local.md', () => {
    expect(excepted(dir)).toBe(false)
  })
  it('is true for the Preview marker block', () => {
    writeFileSync(path.join(dir, 'CLAUDE.local.md'),
      '<!-- transom:begin -->\nRenders open in Preview here.\n<!-- transom:end -->\n')
    expect(excepted(dir)).toBe(true)
  })
  it('is false for a zone-rename block, which still uses the wall', () => {
    writeFileSync(path.join(dir, 'CLAUDE.local.md'),
      '<!-- transom:begin -->\nRenders go to the `alt` zone.\n<!-- transom:end -->\n')
    expect(excepted(dir)).toBe(false)
  })
  it('is false when the word appears outside the block', () => {
    writeFileSync(path.join(dir, 'CLAUDE.local.md'), 'Preview is unrelated prose here.\n')
    expect(excepted(dir)).toBe(false)
  })
})

describe('onWall', () => {
  it('is true inside the inbox', () => {
    expect(onWall('/s/inbox/zone/a.png', '/s')).toBe(true)
  })
  it('is false elsewhere under the wall root', () => {
    expect(onWall('/s/zones/a.png', '/s')).toBe(false)
  })
})

describe('toNudge', () => {
  it('flags a fresh image off the wall', () => {
    const p = touch('a.png')
    expect(toNudge([p], { root: '/s' })).toEqual([p])
  })
  it('skips an image too old to be this command output', () => {
    const p = touch('a.png', 600_000)
    expect(toNudge([p], { root: '/s' })).toEqual([])
  })
  it('skips a path that does not exist', () => {
    expect(toNudge([path.join(dir, 'ghost.png')], { root: '/s' })).toEqual([])
  })
  it('skips one already nudged about', () => {
    const p = touch('a.png')
    expect(toNudge([p], { root: '/s', seen: { [path.resolve(p)]: Date.now() } })).toEqual([])
  })
  it('skips one already on the wall', () => {
    const root = path.join(dir, 'transom')
    const p = touch('transom/inbox/z/a.png')
    expect(toNudge([p], { root })).toEqual([])
  })
})

describe('message', () => {
  it('reads as one image in the singular', () => {
    const m = message(['/repo/chart.png'], '/repo')
    expect(m).toContain('chart.png is only visible to you')
    expect(m).toContain('transom post chart.png')
  })
  it('pluralizes for several', () => {
    const m = message(['/repo/a.png', '/repo/b.png'], '/repo')
    expect(m).toContain('a.png, b.png are only visible to you')
  })
})
