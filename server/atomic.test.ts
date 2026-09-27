import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { save } from './atomic.ts'

let dir = ''
const file = () => join(dir, 'state.json')

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'transom-atomic-'))
})
afterEach(async () => {
  await rm(dir, { recursive: true, force: true })
})

describe('save', () => {
  it('leaves a whole file when writes of different lengths overlap', async () => {
    // The bug this exists for: a slider drag posts several times a second, and
    // two bare writeFile calls interleave — the longer one's tail survives past
    // the shorter one's end, and the file no longer parses. One corrupt read
    // then takes every zone's settings with it.
    const long = JSON.stringify({ zones: Object.fromEntries([...Array(40)].map((_, i) => [`zone-${i}`, { angle: i }])) })
    const short = JSON.stringify({ zones: { one: { angle: 90 } } })

    await Promise.all([
      save(file(), long),
      save(file(), short),
      save(file(), long),
      save(file(), short),
      save(file(), long),
    ])

    const text = await readFile(file(), 'utf8')
    expect(() => JSON.parse(text)).not.toThrow()
  })

  it('writes the last value in, not a blend of them', async () => {
    await Promise.all([save(file(), '{"n":1}'), save(file(), '{"n":22222}'), save(file(), '{"n":3}')])
    const text = await readFile(file(), 'utf8')
    expect(['{"n":1}', '{"n":22222}', '{"n":3}']).toContain(text)
  })

  it('leaves no temporary file behind', async () => {
    await save(file(), '{"n":1}')
    await expect(readFile(`${file()}.tmp`, 'utf8')).rejects.toThrow()
  })
})
