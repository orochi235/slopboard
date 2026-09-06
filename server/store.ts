import { rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'
import { clearAttention, setKept, trashStamp } from './sidecar.ts'
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

/** The last thing expiry took, and where it put it. One deep: undo is for
 *  watching something go and wanting it back, not for browsing the trash. */
let lastExpired: { entry: Entry; dest: string } | null = null

/** Expiry moves the source file to the trash; the wall never unlinks. */
async function expire(entry: Entry) {
  entries.delete(entry.item.id)
  const dest = join(config.trash, `${entry.item.id}-${entry.item.zone}`)
  await mkdir(config.trash, { recursive: true })
  await rename(entry.sourcePath, dest).catch(() => {})
  await trashStamp(entry.sourcePath, dest)
  lastExpired = { entry, dest }
  for (const fn of listeners) fn(entry.item.id)
}

export function startSweeper() {
  setInterval(() => {
    const now = Date.now()
    for (const entry of entries.values()) {
      if (entry.item.keptAt) continue
      if (entry.item.bornAt < now - (entry.item.ttlMs ?? config.ttlMs)) void expire(entry)
    }
  }, 1000)
}

/** Expiry on demand. False when there is no such item, so the caller does not
 *  announce a death that did not happen. */
export async function expireNow(id: string): Promise<boolean> {
  const entry = entries.get(id)
  if (!entry) return false
  await expire(entry)
  return true
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
 * Puts the last expiry back, or null when there is nothing to put back.
 *
 * It returns with a fresh `bornAt`: restored at its old one it would be past
 * its TTL already and the sweeper would take it again within the second, which
 * looks exactly like undo not working.
 */
export async function undoExpiry(): Promise<WallItem | null> {
  const last = lastExpired
  if (!last) return null
  lastExpired = null
  try {
    await rename(last.dest, last.entry.sourcePath)
  } catch {
    return null
  }
  await trashStamp(last.dest, last.entry.sourcePath)
  const item = { ...last.entry.item, bornAt: Date.now() }
  entries.set(item.id, { ...last.entry, item })
  return item
}

/**
 * Clears an item's flag, on the wall and on disk. False when there was no such
 * item or it was not asking in the first place, so the caller does not
 * broadcast a change that did not happen.
 */
export async function dismiss(id: string): Promise<boolean> {
  const entry = entries.get(id)
  if (!entry?.item.attention) return false
  delete entry.item.attention
  await clearAttention(entry.sourcePath)
  return true
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
