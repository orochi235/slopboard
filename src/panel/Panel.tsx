import type { ReactNode } from 'react'
import './panel.css'

/**
 * A titled panel whose name is cut into its own border.
 *
 * A fieldset for the notch as much as the grouping: a legend cuts the border
 * rather than covering it, so the panel can sit on a translucent ground
 * without a seam showing through the line.
 *
 * Colors come from the host: `--accent`, `--ink`, `--muted` and `--bg`, plus
 * `--band-line` for the border where the host sets one.
 */
export function Panel({
  name,
  end,
  tight,
  pushed,
  className,
  children,
}: {
  /** The title, cut into the top border. */
  name: string
  /** Held against the far end of the title's own line, with the run of border
   *  the legend displaces drawn between the two. Absent centers the title. */
  end?: ReactNode
  /** Only as wide as what it holds. */
  tight?: boolean
  /** Against the far edge of whatever row of panels this sits in. */
  pushed?: boolean
  className?: string
  children?: ReactNode
}) {
  const classes = [
    'panel',
    tight ? 'panel--tight' : '',
    pushed ? 'panel--pushed' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <fieldset className={classes}>
      {end === undefined ? (
        <legend className="panel__name panel__legend">{name}</legend>
      ) : (
        <legend className="panel__legend panel__legend--row">
          <span className="panel__name">{name}</span>
          {/* The run of border the legend displaces between the two ends. */}
          <span className="panel__rule" aria-hidden="true" />
          {end}
        </legend>
      )}
      {children}
    </fieldset>
  )
}
