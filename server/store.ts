import { rename, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { config } from './config.ts'
import { clearAttention, closeQuestion, setKept, trashStamp } from './sidecar.ts'
import { ttlMs as wallTtlMs } from './settings.ts'
import { lifetimeFor as zoneLifetime } from './zones.ts'
import type { Poster, Reply, Take, WallItem } from '@shared/protocol.ts'
import { isEternal, lifetimeMs } from '@shared/lifetime.ts'
import { MAX_TAKES, posterOf, posterTake, runIsOpen, takeIsOpen } from '@shared/runs.ts'

/** One artifact's files: the original the sender wrote and the thumbnail the
 *  daemon made of it. A run has a pair per take. */
type Files = { sourcePath: string; cachePath: string }

/**
 * A run's own `sourcePath`/`cachePath` mirror whichever take it is drawing, so
 * `/img/:id` and `/orig/:id` keep serving the card with no route of their own.
 * `takes` is empty for everything else.
 */
type Entry = Files & { item: WallItem; takes: Map<string, Files> }

const entries = new Map<string, Entry>()
/** Which run each take belongs to, so `/img/<takeId>` resolves in one lookup
 *  rather than a scan of every run on the wall. */
const takeOwner = new Map<string, string>()
const listeners = new Set<(id: string) => void>()

export function add(entry: { item: WallItem; sourcePath: string; cachePath: string }) {
  entries.set(entry.item.id, { ...entry, takes: new Map() })
}

const filesOf = (entry: Entry): Files[] =>
  entry.takes.size > 0 ? [...entry.takes.values()] : [{ sourcePath: entry.sourcePath, cachePath: entry.cachePath }]

export function has(sourcePath: string) {
  for (const e of entries.values()) {
    if (e.takes.size === 0) {
      if (e.sourcePath === sourcePath) return true
      continue
    }
    // A run's own sourcePath is a copy of a take's, so only the takes are
    // asked: the sweep must re-offer nothing, and must not skip a take either.
    for (const f of e.takes.values()) if (f.sourcePath === sourcePath) return true
  }
  return false
}

/**
 * Adds a take to a run, opening the run's card if this is its first.
 *
 * Synchronous on purpose, and called with every `await` already finished: two
 * takes landing in the same tick must not both create the run. The failure
 * would be two cards with the same name holding half the takes each, and it
 * would only show under load.
 *
 * Null when the run is full — the cap is what bounds a card's size, since the
 * only other bound is how long the agent runs.
 */
export function addTake(
  card: Omit<WallItem, 'takes' | 'kind'>,
  take: Take,
  files: Files,
  run: { label?: string; of?: number },
): { item: WallItem; poster: Poster; opened: boolean } | null {
  const held = entries.get(card.id)
  if (held && (held.item.takes?.length ?? 0) >= MAX_TAKES) return null

  const entry: Entry =
    held ??
    ({
      item: { ...card, kind: 'run', takes: [], ...(Object.keys(run).length > 0 ? { run } : {}) },
      sourcePath: files.sourcePath,
      cachePath: files.cachePath,
      takes: new Map(),
    } satisfies Entry)

  // Kept in arrival order rather than ingest order: a restart re-adopts a
  // run's takes in whatever order the watcher offers them, and a carousel that
  // shuffles itself when the daemon bounces would be unreviewable.
  const takes = [...(entry.item.takes ?? []), take]
  takes.sort((a, b) => a.at - b.at)
  entry.item.takes = takes
  entry.takes.set(take.id, files)
  takeOwner.set(take.id, entry.item.id)
  // A run may learn its total late — the first send need not know it — and a
  // later label is the sender correcting itself, not a second run.
  if (run.of !== undefined || run.label !== undefined) {
    entry.item.run = { ...entry.item.run, ...run }
  }
  // A take arriving means the run is still producing, so the card is not stale.
  if (held) entry.item.bornAt = take.at
  entries.set(entry.item.id, entry)
  return { item: entry.item, poster: repost(entry), opened: !held }
}

/**
 * Points the card at the take it should be drawing. Every path that can change
 * which one that is goes through here — a take arriving, a question closing —
 * so the rule lives in `posterOf` and nothing else holds a copy of it.
 */
function repost(entry: Entry): Poster {
  const take = posterTake(entry.item.takes ?? [])
  if (!take) throw new Error(`run ${entry.item.id} has no takes`)
  Object.assign(entry.item, posterOf(entry.item.takes ?? []))
  const files = entry.takes.get(take.id)
  if (files) Object.assign(entry, files)
  return { url: take.url, origUrl: take.origUrl, w: take.w, h: take.h }
}

export function snapshot(): WallItem[] {
  return [...entries.values()].map((e) => e.item)
}

export function onExpire(fn: (id: string) => void) {
  listeners.add(fn)
}

/**
 * Drop whatever this path was holding, because the file is no longer there.
 *
 * The wall's own expiry moves the file and drops the item first, so by the time
 * the watcher reports it there is nothing left to match and this does nothing.
 * It is for a deletion from outside — a directory removed, a file cleaned up by
 * something that never heard of the wall — which otherwise left a card whose
 * lightbox served a 404 for as long as the daemon ran.
 *
 * A run loses only the take: the card stands while any take still has a file.
 */
export function forget(sourcePath: string): string | null {
  for (const entry of entries.values()) {
    if (entry.takes.size > 0) {
      for (const [takeId, files] of entry.takes.entries()) {
        if (files.sourcePath !== sourcePath) continue
        entry.takes.delete(takeId)
        takeOwner.delete(takeId)
        if (entry.takes.size > 0) return null
        entries.delete(entry.item.id)
        for (const fn of listeners) fn(entry.item.id)
        return entry.item.id
      }
      continue
    }
    if (entry.sourcePath !== sourcePath) continue
    entries.delete(entry.item.id)
    for (const fn of listeners) fn(entry.item.id)
    return entry.item.id
  }
  return null
}

/** Every file one expiry moved, since a run takes its whole carousel with it. */
type Gone = { entry: Entry; moves: { from: string; to: string }[] }

/** The expiries a person asked for, oldest first, each the artifacts one step
 *  took — a whole zone goes and comes back as one. A TTL running out is never
 *  a step: on a busy wall it would bury a deliberate expiry within the second. */
const undoable: Gone[][] = []
const UNDO_DEPTH = 10

function remember(step: Gone[]) {
  undoable.push(step)
  if (undoable.length > UNDO_DEPTH) undoable.shift()
}

/** Expiry moves the source file to the trash; the wall never unlinks. A run
 *  takes every take with it: the run is the unit of lifetime, and a take left
 *  in the inbox would be adopted as a card of its own on the next sweep. */
async function expire(entry: Entry): Promise<Gone> {
  await closeAll(entry, 'expired')
  entries.delete(entry.item.id)
  for (const take of entry.item.takes ?? []) takeOwner.delete(take.id)
  await mkdir(config.trash, { recursive: true })
  const moves: { from: string; to: string }[] = []
  for (const [at, files] of filesOf(entry).entries()) {
    // One name per file, so a run's takes cannot land on top of each other.
    const dest = join(config.trash, `${entry.item.id}${at === 0 ? '' : `-${at}`}-${entry.item.zone}`)
    await rename(files.sourcePath, dest).catch(() => {})
    await trashStamp(files.sourcePath, dest)
    moves.push({ from: files.sourcePath, to: dest })
  }
  for (const fn of listeners) fn(entry.item.id)
  return { entry, moves }
}

/** Returns the stop, for a test that must not leave a sweep running. */
export function startSweeper(): () => void {
  const timer = setInterval(() => {
    const now = Date.now()
    for (const entry of entries.values()) {
      // An open question has someone waiting on it.
      if (entry.item.keptAt || isOpen(entry.item)) continue
      // A question can stay open for longer than a TTL, so an answered card
      // gets a whole life from its answer — and a run from its last one, since
      // reviewing the twelfth take is not a reason to have already dropped it.
      const replies = (entry.item.takes ?? []).map((t) => t.reply?.at ?? 0)
      const from = Math.max(entry.item.bornAt, entry.item.reply?.at ?? 0, ...replies)
      // The item's own, then its zone's, then the wall's. Read per sweep
      // rather than stamped at arrival, so shortening a zone's lifetime
      // reaches what is already hanging in it.
      //
      // A zone held off the clock resolves to Infinity, which this comparison
      // is already false against — so neither hold needs a case here.
      const ttl = entry.item.ttlMs ?? lifetimeMs(zoneLifetime(entry.item.zone) ?? wallTtlMs())
      if (from < now - ttl) void expire(entry)
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
 *
 * An eternal zone is the exception, and the only thing that separates the two
 * holds: taking a whole zone at once is the collector that promise is against.
 * The card's own Expire is one deliberate act on one artifact and still lands.
 */
export async function expireZone(zone: string): Promise<string[]> {
  if (isEternal(zoneLifetime(zone))) return []
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
    let restored = 0
    for (const move of gone.moves) {
      try {
        await rename(move.to, move.from)
      } catch {
        // One take that will not come back must not strand the rest of its run.
        continue
      }
      await trashStamp(move.to, move.from)
      restored++
    }
    // One file that will not come back must not strand the rest of its zone.
    if (restored === 0) continue
    // Its old bornAt is already past its TTL, so it would be swept again on the
    // next tick.
    const item = { ...gone.entry.item, bornAt: Date.now() }
    entries.set(item.id, { ...gone.entry, item })
    for (const take of item.takes ?? []) takeOwner.set(take.id, item.id)
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
  if (entry && isOpen(entry.item)) return closeQuestion && (await closeAll(entry, 'dismissed'))
  if (!entry?.item.attention) return false
  delete entry.item.attention
  await clearAttention(entry.sourcePath)
  return true
}

export type Closed = Reply['status']

/** A run is open while any take is: the run is the unit of lifetime, so one
 *  unanswered take holds the whole card off the clock. */
const isOpen = (item: WallItem) =>
  item.kind === 'run' ? runIsOpen(item) : item.question !== undefined && item.reply === undefined

/**
 * The answer file, which is what `transom ask` is waiting on. Three parts:
 * the status, then the chip, then the free text from line 3 on. `bin/transom` is
 * `sh` and has no JSON parser, and a blank line 2 is what tells it a free-text
 * answer's first line is not a choice.
 */
async function writeAnswer(sourcePath: string, reply: Reply): Promise<void> {
  await mkdir(config.answers, { recursive: true })
  const dest = join(config.answers, basename(sourcePath))
  // Renamed into place, so the waiting reader never sees half a file.
  await writeFile(`${dest}.tmp`, `${reply.status}\n${reply.choice ?? ''}\n${reply.text}`)
  await rename(`${dest}.tmp`, dest)
}

const replyAt = (status: Closed, choice: string | undefined, text: string): Reply => ({
  status,
  ...(choice ? { choice } : {}),
  text,
  at: Date.now(),
})

/**
 * Ends a question: the answer file first, since something is waiting on it,
 * then the flag and the sidecar. The question itself stays.
 */
async function close(entry: Entry, status: Closed, text: string, choice?: string): Promise<boolean> {
  if (!isOpen(entry.item)) return false
  const reply = replyAt(status, choice, text)
  entry.item.reply = reply
  delete entry.item.attention
  await writeAnswer(entry.sourcePath, reply)
  await closeQuestion(entry.sourcePath, reply)
  return true
}

/** Ends one take's question, and moves the card on to the next take waiting.
 *  Null when there is no such take or it is already closed. */
async function closeTake(
  entry: Entry,
  takeId: string,
  status: Closed,
  text: string,
  choice?: string,
): Promise<Poster | null> {
  const take = (entry.item.takes ?? []).find((t) => t.id === takeId)
  const files = entry.takes.get(takeId)
  if (!take || !files || !takeIsOpen(take)) return null
  const reply = replyAt(status, choice, text)
  take.reply = reply
  await writeAnswer(files.sourcePath, reply)
  await closeQuestion(files.sourcePath, reply)
  // A run stops asking once nothing in it is waiting.
  if (!runIsOpen(entry.item)) delete entry.item.attention
  return repost(entry)
}

/** Every open question on the card at once: what a card-level dismiss and an
 *  expiry both mean for a run. */
async function closeAll(entry: Entry, status: Closed): Promise<boolean> {
  if (entry.item.kind !== 'run') return close(entry, status, '')
  let closed = false
  for (const take of entry.item.takes ?? []) {
    if (await closeTake(entry, take.id, status, '')) closed = true
  }
  return closed
}

/** The reply a question closed with, for the caller to broadcast. A run's
 *  replies are its takes'. */
export const replyOf = (id: string, takeId?: string) => {
  const item = entries.get(id)?.item
  if (takeId === undefined) return item?.reply
  return item?.takes?.find((t) => t.id === takeId)?.reply
}

/** The poster a run is drawing, for a caller that has to broadcast it. */
export const posterAt = (id: string): Poster | null => {
  const item = entries.get(id)?.item
  return item?.kind === 'run' ? posterOf(item.takes ?? []) : null
}

/** False when there is no such item or no open question on it. A run answers
 *  one take at a time, which is what `takeId` names. */
export async function answer(
  id: string,
  status: Closed,
  text: string,
  choice?: string,
  takeId?: string,
): Promise<boolean> {
  const entry = entries.get(id)
  if (!entry) return false
  if (takeId !== undefined) return (await closeTake(entry, takeId, status, text, choice)) !== null
  return close(entry, status, text, choice)
}

/** The item or take a take id belongs to. A run's takes are addressed by their
 *  own ids, so `/img/<takeId>` and the open route resolve without a scan. */
export function takeAt(takeId: string): { item: WallItem; take: Take } | null {
  const owner = takeOwner.get(takeId)
  const item = owner === undefined ? undefined : entries.get(owner)?.item
  const take = item?.takes?.find((t) => t.id === takeId)
  return item && take ? { item, take } : null
}

/** The apps offered for an id, whether it names a card or one take of a run.
 *  Empty for anything that offered none, which is most of the wall. */
export const appsAt = (id: string) =>
  takeAt(id)?.take.apps ?? entries.get(id)?.item.apps ?? []

const filesAt = (id: string): Files | undefined => {
  const entry = entries.get(id)
  if (entry) return entry
  const owner = takeOwner.get(id)
  return owner === undefined ? undefined : entries.get(owner)?.takes.get(id)
}

export function pathOf(id: string) {
  return filesAt(id)?.sourcePath
}

export function resolveCache(id: string) {
  return filesAt(id)?.cachePath
}

export function resolveOriginal(id: string) {
  return filesAt(id)?.sourcePath
}
