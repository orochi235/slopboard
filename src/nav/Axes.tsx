import { axisScreens } from '@/nav/axes.ts'
import './axes.css'

const R = 26
/** Room for a label to sit outside its axis without leaving the box. */
const PAD = 12

/**
 * Which way x, y and z currently point. The wall turns, so which axis a change
 * moves along stops being obvious the moment the camera leaves head-on — and
 * naming the wrong one is how a tuning session argues with itself.
 */
export function Axes({ yawDeg, pitchDeg }: { yawDeg: number; pitchDeg: number }) {
  // Drawn far-to-near, so the axis pointing away is overdrawn by the ones in
  // front of it rather than the other way round.
  const axes = axisScreens(yawDeg, pitchDeg).sort((a, b) => b.depth - a.depth)
  const box = R + PAD

  return (
    <svg
      className="axes__svg"
      viewBox={`${-box} ${-box} ${box * 2} ${box * 2}`}
      aria-label="Which way the world axes point"
    >
      {axes.map((axis) => {
        // SVG y grows downward and the world's grows up.
        const x = axis.x * R
        const y = -axis.y * R
        // The label sits at the rim in the axis's own direction, however
        // short the axis projects — placing it at the end of a foreshortened
        // line would pile all three labels onto the origin.
        const flat = Math.hypot(axis.x, axis.y)
        const at =
          flat < 0.04
            ? { x: 0, y: box - 1 }
            : { x: ((axis.x / flat) * (R + 9)), y: ((-axis.y / flat) * (R + 9)) + 3 }
        return (
          <g className={`axes__axis axes__axis--${axis.name}`} key={axis.name}>
            <line x1={0} y1={0} x2={x} y2={y} />
            <text className="axes__label" x={at.x} y={at.y}>
              {axis.name}
            </text>
          </g>
        )
      })}
      <circle className="axes__origin" cx={0} cy={0} r={1.6} />
    </svg>
  )
}
