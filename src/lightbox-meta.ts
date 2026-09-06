import { ago } from '@/age.ts'
import type { WallItem } from '@shared/protocol.ts'

/**
 * The line above the image: where it came from, how old it is, how big it is,
 * and the commit it was made at where `bin/slop` could see one.
 *
 * Parts rather than a string, so the caller can space them and give the zone
 * its colour without parsing text back apart.
 */
export function metaOf(item: WallItem, now: number): string[] {
  const parts = [item.zone, ago(now - item.bornAt)]
  if (item.repo && item.sha && item.repo !== item.zone) parts.push(`${item.repo}@${item.sha}`)
  else if (item.sha) parts.push(item.sha)
  if (item.w > 0 && item.h > 0) parts.push(`${item.w}×${item.h}`)
  if (item.keptAt) parts.push('kept')
  return parts
}
