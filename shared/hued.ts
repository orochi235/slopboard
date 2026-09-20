/** What a project's `.hued` file says about its color. */
export type Hued = { background?: string; foreground?: string; accent?: string }

/**
 * `key=value` lines. Two traps: a value starts with `#` and so does a trailing
 * comment, so only whitespace-then-`#` ends a value; and a value need not be
 * hex at all — some projects say `background=yellow`.
 */
export function parseHued(text: string): Hued {
  const out: Hued = {}
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line === '' || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq === -1) continue
    const key = line.slice(0, eq).trim()
    if (key !== 'background' && key !== 'foreground' && key !== 'accent') continue

    // A comment only ends the value where whitespace precedes the hash;
    // `#b9a281` is the value itself.
    const value = line.slice(eq + 1).replace(/\s+#.*$/, '').trim()
    if (value !== '') out[key] = value
  }
  return out
}
