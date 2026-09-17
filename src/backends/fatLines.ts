import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'

/**
 * WebGL ignores `LineBasicMaterial.linewidth` — every line comes out one pixel
 * whatever it is set to. These draw a line as instanced quads instead, which is
 * the only way a width slider can mean anything. The cost is that a material
 * has to be told the drawing buffer's size, since it works in screen pixels.
 */
export function createLoop(): LineSegments2 {
  const geometry = new LineSegmentsGeometry()
  const line = new LineSegments2(geometry, createLineMaterial())
  line.raycast = () => null
  return line
}

export function createLineMaterial(): LineMaterial {
  return new LineMaterial({ color: 0xffffff, linewidth: 1, transparent: true })
}

/** The four sides of a rectangle as eight endpoints, the layout
 *  `LineSegmentsGeometry` wants — pairs, not a path. */
export function loopPositions(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  z = 0,
): number[] {
  return [
    x0, y0, z, x1, y0, z,
    x1, y0, z, x1, y1, z,
    x1, y1, z, x0, y1, z,
    x0, y1, z, x0, y0, z,
  ]
}

/** A box's twelve edges as endpoint pairs: the back face, the front face, and
 *  the four edges joining them. */
export function boxPositions(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number[] {
  return [
    ...loopPositions(x0, y0, x1, y1, z0),
    ...loopPositions(x0, y0, x1, y1, z1),
    x0, y0, z0, x0, y0, z1,
    x1, y0, z0, x1, y0, z1,
    x1, y1, z0, x1, y1, z1,
    x0, y1, z0, x0, y1, z1,
  ]
}

/** Widths are in screen pixels, so every material needs the buffer size and
 *  needs it again whenever the canvas resizes. */
export function setResolution(material: LineMaterial, gl: THREE.WebGLRenderer): void {
  const size = gl.getDrawingBufferSize(new THREE.Vector2())
  if (material.resolution.x !== size.x || material.resolution.y !== size.y) {
    material.resolution.copy(size)
  }
}
