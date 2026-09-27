import { describe, expect, it } from 'vitest'
import { clampAttention, parseRepoSettings } from './repoSettings.ts'

describe('parseRepoSettings', () => {
  it('reads every setting', () => {
    const { settings, errors } = parseRepoSettings(`
zone: icons
show: preview
defaults:
  ttl: 30m
  apps:
    - LDView
    - { name: Studio, path: parts/3001.dat }
attention:
  loudest: soon
  sound: false
marks:
  unsent: keep
`)
    expect(errors).toEqual([])
    expect(settings).toEqual({
      zone: 'icons',
      show: 'preview',
      defaults: { ttl: '30m', apps: ['LDView', { name: 'Studio', path: 'parts/3001.dat' }] },
      attention: { loudest: 'soon', sound: false },
      marks: { unsent: 'keep' },
    })
  })

  it('takes an empty file as no settings', () => {
    expect(parseRepoSettings('')).toEqual({ settings: {}, errors: [] })
    expect(parseRepoSettings('# nothing yet\n')).toEqual({ settings: {}, errors: [] })
  })

  it('names a key it does not know, wherever it is', () => {
    const { errors } = parseRepoSettings('tll: 3m\ndefaults:\n  tll: 3m\n')
    expect(errors).toEqual(['/tll: not a setting', '/defaults/tll: not a setting'])
  })

  it('refuses a zone YAML reads as a number, rather than coercing it', () => {
    expect(parseRepoSettings('zone: 1.10\n').errors).toEqual(['/zone: must be string'])
  })

  it('refuses a ttl --ttl would not take', () => {
    expect(parseRepoSettings('defaults:\n  ttl: soon\n').errors).toEqual(['/defaults/ttl: not a duration (soon)'])
    expect(parseRepoSettings('defaults:\n  ttl: 90\n').errors).toEqual([])
  })

  it('gives no settings at all from a file with any error', () => {
    expect(parseRepoSettings('zone: ok\nshow: nope\n').settings).toEqual({})
  })

  it('reports broken YAML rather than throwing', () => {
    expect(parseRepoSettings('zone: [unclosed\n').errors.length).toBeGreaterThan(0)
  })
})

describe('clampAttention', () => {
  it('lowers a level above the ceiling and keeps its hold', () => {
    expect(clampAttention('urgent', 'soon')).toBe('soon')
    expect(clampAttention('problem:30m', 'look')).toBe('look:30m')
    expect(clampAttention('urgent:until-dismissed', 'soon')).toBe('soon:until-dismissed')
  })

  it('leaves a level at or under the ceiling alone', () => {
    expect(clampAttention('soon:5m', 'soon')).toBe('soon:5m')
    expect(clampAttention('look', 'urgent')).toBe('look')
  })

  it('leaves tokens naming no level, which ask for look', () => {
    expect(clampAttention('30m', 'look')).toBe('30m')
    expect(clampAttention('until-dismissed', 'look')).toBe('until-dismissed')
    expect(clampAttention('', 'look')).toBe('')
  })

  it('does nothing without a ceiling', () => {
    expect(clampAttention('problem', undefined)).toBe('problem')
  })
})
