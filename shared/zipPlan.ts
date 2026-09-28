import type { WallItem } from './protocol.ts'

/**
 * What goes into a zip of a stack, and what each file is called inside it.
 *
 * The plan is ids rather than paths or urls because the two halves address the
 * same file differently: the daemon resolves an id to a file on disk, the demo
 * wall fetches `/orig/<id>`. Both mean the original — a zip of the wall's
 * capped thumbnails would be a zip of the wrong pictures.
 */
export type ZipEntry = { id: string; name: string }

/** Whatever a file system will take, from a name the sender chose. */
const safe = (name: string) =>
  name
    .replace(/[/\\]+/g, '-')
    .replace(/[\x00-\x1f:*?"<>|]+/g, '')
    .replace(/^\.+/, '')
    .trim() || 'untitled'

/** The source file's extension, which `name` has had taken off it. */
const extOf = (path: string) => {
  const base = path.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot) : ''
}

/** Two renders can carry one name — the same script run twice — and a zip with
 *  two `plot.png` in it loses one on extraction. */
function unique(entries: ZipEntry[]): ZipEntry[] {
  const taken = new Set<string>()
  return entries.map((entry) => {
    if (!taken.has(entry.name)) {
      taken.add(entry.name)
      return entry
    }
    const dot = entry.name.lastIndexOf('.')
    const stem = dot > 0 ? entry.name.slice(0, dot) : entry.name
    const ext = dot > 0 ? entry.name.slice(dot) : ''
    let n = 2
    while (taken.has(`${stem}-${n}${ext}`)) n++
    const name = `${stem}-${n}${ext}`
    taken.add(name)
    return { ...entry, name }
  })
}

/** A group contributes a folder of its takes, since the card stands for many
 *  pictures and only one of them is the one on the wall. */
const forItem = (item: WallItem, under = ''): ZipEntry[] => {
  const stem = under + safe(item.name)
  if (item.kind !== 'group' || !item.takes?.length) {
    return [{ id: item.id, name: stem + extOf(item.path) }]
  }
  return unique(
    item.takes.map((take) => ({ id: take.id, name: safe(take.name) + extOf(take.path) })),
  ).map((entry) => ({ ...entry, name: `${stem}/${entry.name}` }))
}

/** Every artifact in a zone, oldest first — the order they arrived, which is
 *  the order a folder of them reads in. */
export function zipPlanForZone(items: readonly WallItem[], zone: string): ZipEntry[] {
  const held = items.filter((i) => i.zone === zone).sort((a, b) => a.bornAt - b.bornAt)
  return unique(held.flatMap((item) => forItem(item)))
}

/** One group's takes, flat: the archive is already named for the group. */
export function zipPlanForGroup(item: WallItem): ZipEntry[] {
  if (item.kind !== 'group' || !item.takes?.length) return forItem(item)
  return unique(item.takes.map((take) => ({ id: take.id, name: safe(take.name) + extOf(take.path) })))
}

/** What the download is called. Stamped, because a second zip of the same
 *  stack should sit beside the first rather than land as `foo (1).zip`. */
export function zipName(what: string, at = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const stamp = `${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}`
  return `transom-${safe(what).replace(/\s+/g, '-')}-${stamp}.zip`
}
