/** What a page gets when its pusher said nothing: it runs, but it is not
 *  same-origin, so it cannot read the wall's stored tuning. */
const DEFAULT = 'allow-scripts'

/**
 * The `sandbox` attribute for a page, or null for no attribute at all.
 *
 * Whoever pushes an artifact is responsible for saying what it may do; the
 * wall applies what it was told and does not second-guess it. `none` is how a
 * pusher says the page needs the full run of the frame.
 */
export function sandboxFor(asked: string | undefined): string | null {
  const text = (asked ?? '').trim()
  if (text === '') return DEFAULT
  if (text === 'none') return null
  return text
}
