import { rename, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { config } from './config.ts'
import { clearAttention, clearQuestion, setKept, trashStamp } from './sidecar.ts'
import type { WallItem } from '@shared/protocol.ts'

type Entry = { item: WallItem; sourcePath: string; cachePath: string }

const entries = new Map<string, Entry>()
const listeners = new Set<(id: string) => void>()

export function add(entry: Entry) {
  entries.set(entry.item.id, entry)
}

export function has(sourcePath: string) {
  for (const e of entries.values()) if (e.sourcePath === sourcePath) return true
  return false
}

export function snapshot(): WallItem[] {
  return [...entries.values()].map((e) => e.item)
}

export function onExpire(fn: (id: string) => void) {
  listeners.add(fn)
}

type Gone = { entry: Entry; dest: string }

/** The expiries a person asked for, oldest first, each the artifacts one step
 *  took — a whole zone goes and comes back as one. A TTL running out is never
 *  a step: on a busy wall it would bury a deliberate expiry within the second. */
const undoable: Gone[][] = []
const UNDO_DEPTH = 10

function remember(step: Gone[]) {
  undoable.push(step)
  if (undoable.length > UNDO_DEPTH) undoable.shift()
}

/** Expiry moves the source file to the trash; the wall never unlinks. */
async function expire(entry: Entry): Promise<Gone> {
  if (entry.item.question) await close(entry, 'expired', '')
  entries.delete(entry.item.id)
  const dest = join(config.trash, `${entry.item.id}-${entry.item.zone}`)
  await mkdir(config.trash, { recursive: true })
  await rename(entry.sourcePath, dest).catch(() => {})
  await trashStamp(entry.sourcePath, dest)
  for (const fn of listeners) fn(entry.item.id)
  return { entry, dest }
}

/** Returns the stop, for a test that must not leave a sweep running. */
export function startSweeper(): () => void {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const entry of entries.values()) {
      // An open question has someone waiting on it.
      if (entry.item.keptAt || entry.item.question) continue
      if (entry.item.bornAt < now - (entry.item.ttlMs ?? config.ttlMs)) void expire(entry)
    }
  }, 1000)
  return () => clearInterval(timer)
}

/** Expiry on demand. False when there is no such item, so the caller does not
 *  announce a death that did not happen. */
export async function expireNow(id: string): Promise<boolean> {
  const entry = entries.get(id)
  if (!entry) return false
  remember([await expire(entry)])
  return true
}

/**
 * Everything in a zone, as one undo step. The ids come back so the caller can
 * announce each death on the same `expire` message a natural one sends — a
 * client cannot tell a zone being cleared from thirty TTLs running out at once,
 * and needs no second path for it.
 *
 * A kept artifact is not swept, but it is taken here: rescuing something says
 * the wall must not drop it on its own, not that it cannot be dismissed.
 */
export async function expireZone(zone: string): Promise<string[]> {
  const doomed = [...entries.values()].filter((e) => e.item.zone === zone)
  if (doomed.length === 0) return []
  const gone: Gone[] = []
  for (const entry of doomed) gone.push(await expire(entry))
  remember(gone)
  return gone.map((g) => g.entry.item.id)
}

/**
 * Rescues an item, or lets one go again. The sidecar carries it, so the rescue
 * survives a restart; `keptAt` freezes the item's decay where it stood.
 */
export async function keep(id: string, on: boolean): Promise<number | null | false> {
  const entry = entries.get(id)
  if (!entry) return false
  const keptAt = on ? Date.now() : null
  if (keptAt === null) delete entry.item.keptAt
  else entry.item.keptAt = keptAt
  await setKept(entry.sourcePath, keptAt)
  return keptAt
}

/**
 * Puts the most recent step back, or nothing when there is none left.
 *
 * It returns with a fresh `bornAt`: restored at its old one it would be past
 * its TTL already and the sweeper would take it again within the second, which
 * looks exactly like undo not working.
 */
export async function undoExpiry(): Promise<WallItem[]> {
  const last = undoable.pop()
  if (!last) return []
  const back: WallItem[] = []
  for (const gone of last) {
    try {
      await rename(gone.dest, gone.entry.sourcePath)
    } catch {
      // One file that will not come back must not strand the rest of its zone.
      continue
    }
    await trashStamp(gone.dest, gone.entry.sourcePath)
    // Its old bornAt is already past its TTL, so it would be swept again on the
    // next tick.
    const item = { ...gone.entry.item, bornAt: Date.now() }
    entries.set(item.id, { ...gone.entry, item })
    back.push(item)
  }
  return back
}

/**
 * Clears an item's flag, on the wall and on disk. False when there was no such
 * item or it was not asking in the first place, so the caller does not
 * broadcast a change that did not happen.
 */
export async function dismiss(id: string, closeQuestion = false): Promise<boolean> {
  const entry = entries.get(id)
  // Opening a card dismisses its flag, and must not answer for the viewer.
  if (entry?.item.question) return closeQuestion && close(entry, 'dismissed', '')
  if (!entry?.item.attention) return false
  delete entry.item.attention
  await clearAttention(entry.sourcePath)
  return true
}

export type Closed = 'answered' | 'dismissed' | 'expired'

/**
 * Ends a question: the answer file first, since `bin/slop --ask` is waiting on
 * it, then the flag and the sidecar. The file is the status line, then the
 * text — `bin/slop` is `sh` and has no JSON parser.
 */
async function close(entry: Entry, status: Closed, text: string): Promise<boolean> {
  if (!entry.item.question) return false
  delete entry.item.question
  delete entry.item.choices
  delete entry.item.attention
  await mkdir(config.answers, { recursive: true })
  const dest = join(config.answers, basename(entry.sourcePath))
  // Renamed into place, so the waiting reader never sees half a file.
  await writeFile(`${dest}.tmp`, `${status}\n${text}`)
  await rename(`${dest}.tmp`, dest)
  await clearQuestion(entry.sourcePath)
  return true
}

/** False when there is no such item or no open question on it. */
export async function answer(id: string, status: Closed, text: string): Promise<boolean> {
  const entry = entries.get(id)
  return entry ? close(entry, status, text) : false
}

export function pathOf(id: string) {
  return entries.get(id)?.sourcePath
}

export function resolveCache(id: string) {
  return entries.get(id)?.cachePath
}

export function resolveOriginal(id: string) {
  return entries.get(id)?.sourcePath
}
