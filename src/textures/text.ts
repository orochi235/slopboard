/**
 * Greedy word wrap with a hard stop, for text drawn to a canvas.
 *
 * Canvas has no layout engine — `fillText` runs off the edge and says nothing —
 * so anything drawn into a fixed box has to be broken and cut by hand. Weasel's
 * text package does this properly, but it is built on its own geometry, measure
 * and run model; importing it to break two short strings would cost far more
 * than it saves.
 *
 * A word longer than the line is broken mid-word rather than allowed to
 * overflow: a URL or a hash is exactly the kind of thing that lands in a note.
 */
export function wrapLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const fits = (s: string) => ctx.measureText(s).width <= maxWidth
  const lines: string[] = []
  let line = ''

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const joined = line === '' ? word : `${line} ${word}`
    if (fits(joined)) {
      line = joined
      continue
    }
    if (line !== '') lines.push(line)
    // A word that cannot fit a line of its own is cut into ones that do: a URL
    // or a hash is exactly the kind of thing that lands in a note.
    let rest = word
    while (!fits(rest) && rest.length > 1) {
      let cut = rest.length
      while (cut > 1 && !fits(rest.slice(0, cut))) cut--
      lines.push(rest.slice(0, cut))
      rest = rest.slice(cut)
    }
    line = rest
  }
  if (line !== '') lines.push(line)

  // Wrapped in full and then cut, rather than stopped at the limit: stopping
  // early cannot tell "ended here" from "ran out of room", which is the whole
  // difference between a complete note and a truncated one.
  if (lines.length <= maxLines) return lines.length > 0 ? lines : ['']

  const kept = lines.slice(0, maxLines)
  const last = kept.at(-1) ?? ''
  // The ellipsis has to fit too, so the line gives back room for it.
  let cut = last.length
  while (cut > 0 && !fits(`${last.slice(0, cut)}…`)) cut--
  kept[kept.length - 1] = `${last.slice(0, cut)}…`
  return kept
}
