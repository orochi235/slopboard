import { ago } from '@/age.ts'
import { formatClock } from '@shared/duration.ts'
import type { WallItem } from '@shared/protocol.ts'

/**
 * What the artifact is. A page says so in the wall's own word, because the
 * card it was opened from is a screenshot and the two are easy to confuse; a
 * picture says the format `/orig` will hand over on a save.
 *
 * Null for an artifact whose name carries no extension, which is what expiry
 * renames a file to.
 */
function formatOf(item: WallItem): string | null {
  if (item.kind === 'page') return 'page'
  // A video says its container, the same as a picture does: it is what `/orig`
  // hands over on a save, and `video` would say less than `mp4`.
  return item.path.toLowerCase().match(/\.([a-z0-9]+)$/)?.[1] ?? null
}

/**
 * The line above the image: where it came from, how old it is, what it is,
 * how big it is, and the commit it was made at where `bin/slop` could see one.
 *
 * Parts rather than a string, so the caller can space them and give the zone
 * its color without parsing text back apart.
 */
export function metaOf(item: WallItem, now: number): string[] {
  const parts = [item.zone, ago(now - item.bornAt)]
  if (item.repo && item.sha && item.repo !== item.zone) parts.push(`${item.repo}@${item.sha}`)
  else if (item.sha) parts.push(item.sha)
  const format = formatOf(item)
  if (format) parts.push(format)
  // The one thing about an animation nobody can count by looking, and the
  // reason the card underneath is a still.
  if (item.frames) parts.push(`${item.frames} frames`)
  // Same job for a video: how much of it there is, which the poster cannot say.
  if (item.duration) parts.push(formatClock(item.duration))
  if (item.w > 0 && item.h > 0) parts.push(`${item.w}×${item.h}`)
  return parts
}

/**
 * What is true of the artifact right now, as against what it is: kept from the
 * sweeper, flagged, asking a question, asking to be looked at.
 *
 * Apart from `metaOf` because these are read differently. A format and a pixel
 * size are settled facts and a reader scans past them; state is the reason to
 * look at the line at all, and set in the same row in the same ink it reads as
 * one more fact about the file — which is how `kept` sat unnoticed at the end
 * of six of them.
 */
export function statusOf(item: WallItem): string[] {
  const parts: string[] = []
  if (item.keptAt) parts.push('kept')
  if (item.note) parts.push(item.note)
  if (item.attention) parts.push(item.attention.level)
  if (item.question) parts.push(item.reply ? item.reply.status : 'asked')
  return parts
}
