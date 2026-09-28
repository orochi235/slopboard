import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/textures/swatches.ts', () => ({
  swatches: () => ({ hatch: { url: 'data:image/png;base64,HATCH', aspect: 1 } }),
}))

const { BackdropSwatches } = await import('@/BackdropSwatches.tsx')

describe('BackdropSwatches', () => {
  it('masks a face with the drawn pattern, not a solid tint', () => {
    const html = renderToStaticMarkup(
      <BackdropSwatches label="pattern" value="hatch" tint="#0f0" onChange={() => {}} />,
    )
    expect(html).toContain('url(data:image/png;base64,HATCH)')
    expect(html).not.toContain('[object Object]')
  })
})
