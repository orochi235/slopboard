#!/usr/bin/env node
// `transom post`'s reading of a repo's .transom.yaml, for a shell to eval.
//
//   node settings.mjs FILE ROOT [ATTENTION]
//
// Prints `file_*` assignments, and `attention=…` when ATTENTION is above the
// repo's `loudest`. A file with any error prints each to stderr and exits 1, so
// a typo in a committed config stops the send rather than being ignored.

import { readFileSync } from 'node:fs'
import { isAbsolute, join } from 'node:path'
import { clampAttention, parseRepoSettings } from '../shared/repoSettings.ts'

const [file, root, attention = ''] = process.argv.slice(2)
const { settings, errors } = parseRepoSettings(readFileSync(file, 'utf8'))
if (errors.length > 0) {
  for (const e of errors) console.error(`transom: ${file}: ${e}`)
  process.exit(1)
}

const q = (v) => `'${String(v).replace(/'/g, `'\\''`)}'`
const out = []
const set = (name, v) => { if (v !== undefined && v !== '') out.push(`${name}=${q(v)}`) }

set('file_zone', settings.zone)
set('file_show', settings.show)
set('file_ttl', settings.defaults?.ttl)
// The shape `--app` accumulates: a line per app, `Name` or `Name=path`.
const apps = (settings.defaults?.apps ?? []).map((a) => {
  if (typeof a === 'string') return a
  if (!a.path) return a.name
  return `${a.name}=${isAbsolute(a.path) ? a.path : join(root, a.path)}`
})
if (apps.length > 0) set('file_apps', `${apps.join('\n')}\n`)
if (settings.attention?.sound === false) set('file_quiet', '1')
const clamped = clampAttention(attention, settings.attention?.loudest)
if (clamped !== attention) set('attention', clamped)

console.log(out.join('\n'))
