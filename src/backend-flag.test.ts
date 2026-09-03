import { describe, expect, it } from 'vitest'
import { backendFrom } from '@/backend-flag.ts'

describe('backendFrom', () => {
  it('defaults to the DOM wall', () => {
    expect(backendFrom('')).toBe('dom')
    expect(backendFrom('?foo=1')).toBe('dom')
  })

  it('selects webgl only on an exact match', () => {
    expect(backendFrom('?backend=webgl')).toBe('webgl')
    expect(backendFrom('?a=1&backend=webgl&b=2')).toBe('webgl')
  })

  it('falls back rather than throwing on a value it does not know', () => {
    expect(backendFrom('?backend=vulkan')).toBe('dom')
    expect(backendFrom('?backend=')).toBe('dom')
  })
})
