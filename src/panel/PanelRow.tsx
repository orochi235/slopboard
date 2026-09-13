import type { ReactNode } from 'react'
import { Keys } from './Keys.tsx'
import './panel.css'

/**
 * A row inside a panel: what it says on the left, the keys that work it held
 * at the right edge.
 *
 * A button only where there is something to choose — a row that merely reports
 * is text, and text in a button reports its last line's baseline rather than
 * its first.
 */
export function PanelRow({
  label,
  keys,
  keysTitle,
  selected,
  onSelect,
  className,
  children,
}: {
  label?: ReactNode
  /** Key legends, in the order they read. */
  keys?: readonly string[]
  /** What the keys do, for a row where nothing else says so. */
  keysTitle?: string
  /** Painted as the one in force. Only meaningful with `onSelect`. */
  selected?: boolean
  onSelect?: () => void
  className?: string
  children?: ReactNode
}) {
  // Selection rides on `aria-pressed` rather than a class, so the class list
  // stays what a host like delamin8r may have added to it.
  const classes = ['panel__row', className ?? ''].filter(Boolean).join(' ')

  const inside = (
    <>
      {children ?? label}
      {keys && keys.length > 0 && <Keys labels={keys} title={keysTitle} />}
    </>
  )

  if (!onSelect) return <span className={classes}>{inside}</span>

  return (
    <button type="button" className={classes} aria-pressed={selected} onClick={onSelect}>
      {inside}
    </button>
  )
}

/** A list of rows, spread into the panel's own padding so a selected row's bar
 *  runs almost to its border. Each row gives the padding back as its own, so
 *  the labels stay where an unlisted row has them. */
export function PanelRows({ children }: { children: ReactNode }) {
  return <div className="panel__rows">{children}</div>
}
