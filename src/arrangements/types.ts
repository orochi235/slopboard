import type { LayoutResult, LayoutItem, Size as WeSize } from 'windease'
import type { Projection } from '@/params.ts'

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

/** Where the 3D scene's camera starts, and under which projection. */
export type Camera = { projection: Projection; fovDeg: number; z: number }

/** slopboard's own channel vocabulary. windease carries these and never reads them. */
export type SlopChannels = {
  z: number
  opacity: number
  rotX: number
  rotY: number
  rotZ: number
  saturation?: number
  blur?: number
  lod?: number
  /** How loudly the item is asking to be looked at, 0..1. */
  emphasis?: number
}

export type SlopStrategy = {
  name: string
  layout(input: {
    items: LayoutItem[]
    container: WeSize
    state: undefined
    options: Record<string, unknown>
  }): LayoutResult
}

export type Arrangement2D = {
  name: string
  dims: 2
  arrange(items: Item[], viewport: Size, t: number): Placement[]
}

export type Arrangement3D = {
  name: string
  dims: 3
  camera?: Camera
  strategy: SlopStrategy
}

export type Arrangement = Arrangement2D | Arrangement3D
