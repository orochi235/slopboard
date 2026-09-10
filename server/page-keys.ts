import { FORWARDED_KEYS, KEY_MESSAGE } from '@shared/page-keys.ts'

const SCRIPT = `<script>
(function () {
  var keys = ${JSON.stringify(Object.fromEntries(FORWARDED_KEYS.map((k) => [k, 1])))}
  addEventListener('keydown', function (e) {
    if (!keys[e.key]) return
    // Text entry keeps its own keys; a focused button has no use for these.
    var el = e.target
    if (el && el.closest && el.closest('input, select, textarea, [contenteditable]')) return
    try { parent.postMessage({ type: ${JSON.stringify(KEY_MESSAGE)}, key: e.key }, '*') } catch (_) {}
  })
})()
</script>`

/**
 * The page as the lightbox frames it. `/orig` keeps serving the file byte for
 * byte, because that is what a right-click save and a drag to Finder hand over.
 */
export function withKeyForwarder(html: string): string {
  const close = html.toLowerCase().lastIndexOf('</body>')
  if (close === -1) return html + SCRIPT
  return html.slice(0, close) + SCRIPT + html.slice(close)
}
