import { rename, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { config } from './config.ts'
import { clearAttention, trashStamp } from './sidecar.ts'
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

/** Expiry moves the source file to the trash; the wall never unlinks. */
async function expire(entry: Entry) {
  entries.delete(entry.item.id)
  const dest = join(config.trash, `${entry.item.id}-${entry.item.zone}`)
  await mkdir(config.trash, { recursive: true })
  await rename(entry.sourcePath, dest).catch(() => {})
  await trashStamp(entry.sourcePath, dest)
  for (const fn of listeners) fn(entry.item.id)
}

export function startSweeper() {
  setInterval(() => {
    const now = Date.now()
    for (const entry of entries.values()) {
      if (entry.item.bornAt < now - (entry.item.ttlMs ?? config.ttlMs)) void expire(entry)
    }
  }, 1000)
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

export function resolveCache(id: string) {
  return entries.get(id)?.cachePath
}

export function resolveOriginal(id: string) {
  return entries.get(id)?.sourcePath
}
