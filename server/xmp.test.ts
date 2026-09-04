import { describe, expect, it } from 'vitest'
import { buildXmp, readXmp } from './xmp.ts'

describe('buildXmp', () => {
  it('writes the caption where other tools look, as well as where we look', () => {
    const packet = buildXmp({ caption: 'the sky, turned' })
    // Preview, Finder and Lightroom read dc:description; nothing but the wall
    // reads slop:caption.
    expect(packet).toContain('<dc:description>')
    expect(packet).toContain('the sky, turned')
    expect(packet).toContain('slop:caption="the sky, turned"')
  })

  it('escapes a caption that would otherwise close a tag or an attribute', () => {
    const packet = buildXmp({ caption: 'a <b> & "c"' })
    expect(packet).not.toContain('<b>')
    expect(readXmp(packet).caption).toBe('a <b> & "c"')
  })

  it('leaves out what it was not given, rather than writing empty fields', () => {
    const packet = buildXmp({ zone: 'slopboard' })
    expect(packet).toContain('slop:zone="slopboard"')
    expect(packet).not.toContain('slop:repo')
    expect(packet).not.toContain('dc:description')
  })

  it('is a complete packet, so a tool can find and rewrite it in place', () => {
    const packet = buildXmp({ caption: 'x' })
    expect(packet.startsWith('<?xpacket begin=')).toBe(true)
    expect(packet.trimEnd().endsWith('<?xpacket end="w"?>')).toBe(true)
  })
})

describe('readXmp', () => {
  it('round-trips every field', () => {
    const stamp = { caption: 'a caption', zone: 'slopboard', repo: 'slopboard', sha: '6fc3f8e' }
    expect(readXmp(buildXmp(stamp))).toEqual(stamp)
  })

  it('falls back to dc:description when the private field is absent', () => {
    const packet = buildXmp({ caption: 'from dc' }).replace(/slop:caption="[^"]*"/, '')
    expect(readXmp(packet).caption).toBe('from dc')
  })

  it('reads nothing out of a packet that is not ours', () => {
    expect(readXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"></x:xmpmeta>')).toEqual({})
    expect(readXmp('')).toEqual({})
  })
})
