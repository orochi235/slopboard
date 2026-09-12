/**
 * A control's label and the unit its value is in, split out of the leaf name.
 *
 * The paths carry the unit as a suffix — `shoveMs`, `camera.fovDeg` — and a
 * label is the leaf verbatim, so the panel read `SHOVEMS`. The kit's rows take
 * a unit beside the readout, which is where it belongs and where it stops
 * being read as part of the name.
 */
const UNITS: ReadonlyArray<readonly [suffix: string, unit: string]> = [
  ['Ms', 'ms'],
  ['Deg', '°'],
  ['Px', 'px'],
  ['Bytes', 'B'],
]

export function splitUnit(leaf: string): { label: string; unit: string | null } {
  for (const [suffix, unit] of UNITS) {
    // Longer than the suffix, so a control actually named `ms` keeps its name.
    if (leaf.length > suffix.length && leaf.endsWith(suffix)) {
      return { label: leaf.slice(0, -suffix.length), unit }
    }
  }
  return { label: leaf, unit: null }
}
