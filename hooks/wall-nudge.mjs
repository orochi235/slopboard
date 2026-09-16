#!/usr/bin/env node
// PostToolUse on Read|Write|Bash: catch an image the agent just made or looked
// at that never reached the wall. Exits 2 with the nudge on stderr, which
// Claude Code feeds back to the model.
//
// Prose in CLAUDE.md loses to the harness telling every session to write
// generated files into its scratchpad; this fires after the fact, when the fix
// is one command.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|tiff?|avif)$/i

// A file older than this was not made by the command that mentioned it.
const FRESH_MS = 120_000
const SEEN_TTL_MS = 3_600_000

export const slopRoot = () => process.env.SLOP_ROOT || path.join(homedir(), 'slop')

export function isImage(p) {
  return typeof p === 'string' && IMAGE_EXT.test(p)
}

/** Already on the wall: nudging about it would be the second nudge. */
export function onWall(p, root = slopRoot()) {
  const inbox = path.join(root, 'inbox') + path.sep
  return path.resolve(p).startsWith(inbox)
}

/** Image-looking paths named anywhere in a shell command. */
export function pathsInCommand(cmd) {
  if (typeof cmd !== 'string') return []
  const out = []
  for (const m of cmd.matchAll(/[^\s'"`|<>()]+\.(?:png|jpe?g|gif|webp|svg|bmp|tiff?|avif)\b/gi)) {
    out.push(m[0])
  }
  return [...new Set(out)]
}

/** Paths the tool call put in front of us that we should judge. */
export function candidates(payload) {
  const tool = payload?.tool_name
  const input = payload?.tool_input ?? {}
  if (tool === 'Read' || tool === 'Write') {
    return isImage(input.file_path) ? [input.file_path] : []
  }
  if (tool === 'Bash') {
    // The command sent it itself, or asked slop a question.
    if (/\bslop\b/.test(input.command ?? '')) return []
    return pathsInCommand(input.command)
  }
  return []
}

/** Repos that opted out via the skill's marker block keep Preview. */
export function excepted(cwd) {
  if (!cwd) return false
  const local = path.join(cwd, 'CLAUDE.local.md')
  if (!existsSync(local)) return false
  let text
  try { text = readFileSync(local, 'utf8') } catch { return false }
  const block = text.match(/<!-- slopboard:begin -->([\s\S]*?)<!-- slopboard:end -->/)
  return block ? /Preview/i.test(block[1]) : false
}

function seenPath() { return path.join(slopRoot(), 'wall-nudge-seen.json') }

export function readSeen(now = Date.now(), file = seenPath()) {
  let raw
  try { raw = JSON.parse(readFileSync(file, 'utf8')) } catch { return {} }
  if (!raw || typeof raw !== 'object') return {}
  const kept = {}
  for (const [k, t] of Object.entries(raw)) {
    if (typeof t === 'number' && now - t < SEEN_TTL_MS) kept[k] = t
  }
  return kept
}

function writeSeen(seen, file = seenPath()) {
  try {
    mkdirSync(path.dirname(file), { recursive: true })
    writeFileSync(file, JSON.stringify(seen))
  } catch { /* the nudge is worth more than the bookkeeping */ }
}

/** Images worth nudging about: real, fresh, off the wall, not already flagged. */
export function toNudge(paths, { now = Date.now(), seen = {}, root = slopRoot() } = {}) {
  const hits = []
  for (const p of paths) {
    const abs = path.resolve(p)
    if (onWall(abs, root)) continue
    if (seen[abs]) continue
    let st
    try { st = statSync(abs) } catch { continue }
    if (!st.isFile() || now - st.mtimeMs > FRESH_MS) continue
    hits.push(abs)
  }
  return hits
}

export function message(hits, cwd) {
  const names = hits.map((h) => path.relative(cwd || process.cwd(), h) || h)
  const one = names.length === 1
  return (
    `${names.join(', ')} ${one ? 'is' : 'are'} only visible to you. ` +
    `Put ${one ? 'it' : 'them'} on the slopboard wall now — ` +
    `\`slop ${names.join(' ')}\` (or \`~/src/slopboard/bin/slop\` if it is not on PATH) — ` +
    `then say which zone ${one ? 'it' : 'they'} went to. Do not \`open\` renders in Preview.\n`
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  let raw = ''
  for await (const c of process.stdin) raw += c
  let p; try { p = JSON.parse(raw) } catch { process.exit(0) }

  const paths = candidates(p)
  if (paths.length === 0) process.exit(0)
  if (excepted(p?.cwd)) process.exit(0)

  const now = Date.now()
  const seen = readSeen(now)
  const hits = toNudge(paths, { now, seen })
  if (hits.length === 0) process.exit(0)

  for (const h of hits) seen[h] = now
  writeSeen(seen)

  process.stderr.write(message(hits, p?.cwd))
  process.exit(2)
}
