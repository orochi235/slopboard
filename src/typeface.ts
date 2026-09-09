/**
 * The faces the wall's in-scene text can wear: zone labels and attention
 * badges, both of which are drawn to a canvas rather than laid out by CSS.
 *
 * All proportional except the two monospaces, because what the wall wants is
 * the *look* of machine type with real hinting — a fixed advance width buys
 * nothing here and costs legibility at a glance across a room.
 *
 * Vendored rather than fetched: a wall on a side monitor must not lose its
 * typography because the network did.
 */
export const FACES = {
  mono: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  oxanium: '"Oxanium", ui-monospace, monospace',
  orbitron: '"Orbitron", ui-monospace, monospace',
  novaSquare: '"Nova Square", ui-monospace, monospace',
  firaSans: '"Fira Sans Condensed", ui-sans-serif, sans-serif',
  firaCode: '"Fira Code", ui-monospace, monospace',
  tektur: '"Tektur", ui-monospace, monospace',
} as const

/** A chip is a note on its subject and a label names the subject itself, so the
 *  two are not set at the same weight. Only Oxanium is vendored variable enough
 *  to honor the difference; the rest resolve both to their one instance. */
export const CHIP_WEIGHT = 400
export const LABEL_WEIGHT = 600

/** Canvas silently falls back to the system face for a weight the document has
 *  not loaded, so every weight the wall draws with has to be asked for. */
const WEIGHTS = [CHIP_WEIGHT, LABEL_WEIGHT] as const

export type Typeface = keyof typeof FACES

export const TYPEFACES = Object.keys(FACES) as Typeface[]

export const stackFor = (face: Typeface): string => FACES[face] ?? FACES.mono

/**
 * Canvas text silently falls back to the system face for any webfont the
 * document has not finished loading, and it does so without erroring — so a
 * badge built on the first frame wears the wrong type forever unless whatever
 * caches it is told to rebuild. Resolves once every vendored face is ready.
 */
export function loadFaces(px = 72): Promise<void> {
  const wanted = TYPEFACES.filter((f) => f !== 'mono').flatMap((f) =>
    WEIGHTS.map((w) => document.fonts.load(`${w} ${px}px ${stackFor(f)}`).catch(() => [])),
  )
  return Promise.all(wanted).then(() => undefined)
}
