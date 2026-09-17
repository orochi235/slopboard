import { describe, expect, it } from 'vitest'
import { ttlOptions } from '@/wall-settings.ts'

describe('ttlOptions', () => {
  it('labels each choice the way a person writes it, shortest first', () => {
    const labels = ttlOptions(28_800_000).map((o) => o.label)
    expect(labels[0]).toBe('15m')
    expect(labels).toContain('8h')
    expect(labels.at(-1)).toBe('7d')
  })

  it('carries a lifetime it does not offer, so a daemon set by hand reads true', () => {
    const options = ttlOptions(5 * 3_600_000)
    expect(options.map((o) => o.label)).toContain('5h')
    expect(options.findIndex((o) => o.label === '5h')).toBe(
      options.findIndex((o) => o.label === '4h') + 1,
    )
  })

  it('does not repeat a lifetime it already offers', () => {
    expect(ttlOptions(3_600_000).filter((o) => o.label === '1h')).toHaveLength(1)
  })
})
