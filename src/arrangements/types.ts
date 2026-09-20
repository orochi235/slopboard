import type { LayoutResult, LayoutItem, Size as WeSize } from 'windease'
import type { Projection } from '@/params.ts'

export type Size = { w: number; h: number }

/** Where the scene's camera starts, and under which projection. */
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

export type Arrangement = {
  name: string
  /** Zones are not a level of this wall: the renderer draws no zone cells,
   *  labels or counts, and a card opens straight from the wall. */
  flat?: boolean
  camera?: Camera
  strategy: SlopStrategy
}
