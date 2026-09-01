export type Size = { w: number; h: number }

export type Item = {
  id: string
  aspect: number
  /** 0 at arrival, 1 at expiry. */
  age01: number
  zone: string
  pinned: boolean
  hovered: boolean
}

/**
 * x/y are 0..1 of the viewport and address the item's center. `scale` is the
 * side of the square the item is fit inside, as a fraction of the viewport's
 * shorter edge — so an arrangement never has to know the pixel size or aspect
 * of the wall it is running on.
 */
export type Placement = {
  id: string
  x: number
  y: number
  scale: number
  /** 0 = front, 1 = back. z-index in the DOM backend, Z position in r3f. */
  depth: number
  opacity: number
  blur?: number
  saturation?: number
}

export type Arrangement = {
  name: string
  needs3d: boolean
  arrange(items: Item[], viewport: Size, t: number): Placement[]
}
