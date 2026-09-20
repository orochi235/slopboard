/**
 * The prefs sheet's tabs: six areas of the wall, each holding the leaves that
 * draw it. A leaf is placed by the longest prefix of its path listed here, so
 * a group can split — `lod`'s shape is the piles', its reveal timing the
 * cards' — and `colors` and `typeface` dissolve into the tab of what they
 * color. Paths stay as they are, so a saved set keeps loading.
 */
export type Category = { id: string; label: string }

export const CATEGORIES: readonly Category[] = [
  { id: 'piles', label: 'piles' },
  { id: 'inbox', label: 'inbox' },
  { id: 'cards', label: 'cards' },
  { id: 'flags', label: 'flags' },
  { id: 'zones', label: 'zones & sky' },
  { id: 'camera', label: 'camera & input' },
  { id: 'chrome', label: 'chrome' },
]

/** Where a leaf that matches nothing below lands, so it is never hidden. */
export const OTHER: Category = { id: 'other', label: 'other' }

const PLACES: Record<string, string> = {
  // The general tab is not one of the areas of the wall, so it is absent from
  // CATEGORIES and never nests under `params`. Its leaves are drawn from
  // wherever they live: what they have in common is being worth finding first,
  // not being about one part of the wall.
  general: 'general',
  'typeface.chrome': 'general',
  'camera.projection': 'general',

  step: 'piles',
  side: 'piles',
  shoveMs: 'piles',
  origin: 'piles',
  rot: 'piles',
  jitter: 'piles',
  zoneGrid: 'piles',
  lod: 'piles',
  inbox: 'inbox',
  'lod.revealHoldMs': 'cards',
  'lod.revealFadeMs': 'cards',

  fade: 'cards',
  distance: 'cards',
  chips: 'cards',
  overlay: 'cards',
  'colors.cardEdge': 'cards',
  'colors.cardBlank': 'cards',
  'colors.chipFill': 'cards',
  'colors.chipIcon': 'cards',
  'colors.chipInk': 'cards',

  attention: 'flags',
  'colors.attentionLook': 'flags',
  'colors.attentionSoon': 'flags',
  'colors.attentionUrgent': 'flags',
  'colors.attentionProblem': 'flags',
  'colors.flagInk': 'flags',
  'typeface.badge': 'flags',

  zones: 'zones',
  sky: 'zones',
  'colors.zoneIdle': 'zones',
  'colors.zoneFocus': 'zones',
  'colors.zoneBackdrop': 'zones',
  'colors.label': 'zones',
  'colors.skyBase': 'zones',
  'colors.skyGlow': 'zones',
  'typeface.label': 'zones',

  camera: 'camera',
  nav: 'camera',

  menu: 'chrome',
  band: 'chrome',
  prefs: 'chrome',
  'colors.bg': 'chrome',
  'colors.scrim': 'chrome',
  'colors.ink': 'chrome',
  'colors.muted': 'chrome',
  'colors.accent': 'chrome',
  'colors.danger': 'chrome',
}

/** The tab a leaf path belongs to, by its longest listed prefix. */
export function categoryOf(path: string): string {
  const segments = path.split('.')
  for (let n = segments.length; n > 0; n--) {
    const hit = PLACES[segments.slice(0, n).join('.')]
    if (hit) return hit
  }
  return OTHER.id
}

/** The tabs in order, `other` last and only when something landed there. */
export function categoriesFor(paths: readonly string[]): Category[] {
  const used = new Set(paths.map(categoryOf))
  const out = CATEGORIES.filter((c) => used.has(c.id))
  return used.has(OTHER.id) ? [...out, OTHER] : out
}
