/**
 * How a mesh is framed and lit, wherever one is drawn: the daemon's poster
 * viewer and the lightbox both read this, so a model looks the same on the
 * card as it does opened.
 *
 * The viewer is served to Chrome as plain JavaScript and cannot import this,
 * so the route inlines `MESH_VIEW` into the page and the viewer repeats the
 * one line of `distanceFor`. Change either and change both; `mesh.test.ts`
 * pins the formula.
 */
export const MESH_VIEW = {
  /** Three-quarter from above: an elevation reads as a picture of a drawing
   *  rather than as an object. Normalized where it is used. */
  dir: [1, 0.65, 1] as const,
  fov: 35,
  /** How much of the frame the model leaves empty. A model filling its card
   *  edge to edge reads as cropped. */
  margin: 1.25,
  /** The wall's own light, never the file's: two models side by side are then
   *  in the same room. */
  sky: '#e8eefc',
  ground: '#26303f',
  fill: 0.85,
  key: 1.15,
  /** What an `.stl` wears, having no material of its own. */
  matte: '#c3ccd8',
} as const

/**
 * How far back the camera sits to hold a sphere of `radius` in frame. The
 * vertical field is the binding one for a square shot, which is the only shape
 * the poster is taken in.
 */
export function distanceFor(radius: number, fovDeg: number = MESH_VIEW.fov): number {
  return (radius * MESH_VIEW.margin) / Math.sin((fovDeg * Math.PI) / 360)
}
