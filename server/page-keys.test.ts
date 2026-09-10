import { describe, expect, it } from 'vitest'
import { withKeyForwarder } from './page-keys.ts'
import { FORWARDED_KEYS, KEY_MESSAGE } from '@shared/page-keys.ts'

describe('withKeyForwarder', () => {
  it('puts the script inside the body, where the page has one', () => {
    const out = withKeyForwarder('<html><body><p>hi</p></body></html>')
    expect(out).toMatch(/<p>hi<\/p><script>[\s\S]*<\/script><\/body>/)
  })

  it('appends to a fragment that never closes a body', () => {
    const out = withKeyForwarder('<p>hi</p>')
    expect(out.startsWith('<p>hi</p>')).toBe(true)
    expect(out).toContain('<script>')
  })

  it('uses the last body close, not one quoted earlier in the page', () => {
    const out = withKeyForwarder('<body><code>&lt;/body&gt;</code>x</body>')
    expect(out.indexOf('<script>')).toBeGreaterThan(out.indexOf('x') - 1)
    expect(out.endsWith('</body>')).toBe(true)
  })

  it('matches a shouted close tag', () => {
    expect(withKeyForwarder('<BODY>hi</BODY>')).toContain('<script>')
    expect(withKeyForwarder('<BODY>hi</BODY>').endsWith('</BODY>')).toBe(true)
  })

  it('forwards the keys the wall navigates with, and leaves the page its own', () => {
    const out = withKeyForwarder('')
    for (const key of FORWARDED_KEYS) expect(out).toContain(`"${key}"`)
    expect(out).not.toContain('ArrowUp')
    expect(out).not.toContain('ArrowDown')
  })

  it('names its messages, so another frame cannot be mistaken for the page', () => {
    expect(withKeyForwarder('')).toContain(KEY_MESSAGE)
  })

  it('leaves the page alone apart from the script', () => {
    const page = '<html><head><title>t</title></head><body><h1>keep me</h1></body></html>'
    const out = withKeyForwarder(page)
    expect(out.replace(/<script>[\s\S]*<\/script>/, '')).toBe(page)
  })
})
