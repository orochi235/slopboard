import { describe, expect, it } from 'vitest'
import { sandboxFor } from '@/lightbox-sandbox.ts'

describe('sandboxFor', () => {
  it('runs a page that asked for nothing, without giving it the wall', () => {
    expect(sandboxFor(undefined)).toBe('allow-scripts')
  })

  it('takes what the pusher asked for', () => {
    expect(sandboxFor('allow-scripts allow-forms')).toBe('allow-scripts allow-forms')
  })

  it('lets a pusher turn the sandbox off outright', () => {
    expect(sandboxFor('none')).toBe(null)
  })

  it('treats an empty string as nothing asked for', () => {
    expect(sandboxFor('')).toBe('allow-scripts')
    expect(sandboxFor('   ')).toBe('allow-scripts')
  })
})
