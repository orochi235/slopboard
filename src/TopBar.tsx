import { useEffect, useMemo, useRef, type CSSProperties, type ReactNode } from 'react'
import { Slider } from '@weasel-js/ui'
import { delaminate } from 'delamin8r'
import { Panel, PanelRow, PanelRows } from '@/panel/index.ts'
import { ago } from '@/age.ts'
import { BUCKETS, bucketRange, histogram, spanOf, type Range } from '@/nav/time-filter.ts'
import { SORTS, type SortKey } from '@/nav/sort.ts'
import type { WallItem } from '@shared/protocol.ts'
import type { StackParams } from '@/params.ts'
import './topbar.css'

const BINS = 64

/**
 * The wall's filters. A band rather than a toolbar: each section is a block
 * with room for a real control, because a filter over time is a shape you read
 * before it is a value you set.
 */
export function TopBar({
  items,
  now,
  range,
  onRange,
  sort,
  onSort,
  where,
  whereColor,
  arrangement,
  count,
  connected,
  plan,
  axes,
  look,
  listed,
  onList,
}: {
  items: readonly WallItem[]
  /** The daemon's clock, so the axis agrees with every age on the wall. */
  now: number
  range: Range | null
  onRange: (next: Range | null) => void
  sort: SortKey
  onSort: (next: SortKey) => void
  /** The zone the view is inside, or null for the wall itself. */
  where: string | null
  /** That zone's project colour, where it has one. The wall's own accent
   *  stands for the wall itself and for a zone with no `.hued` behind it. */
  whereColor?: string
  /** How the wall is laid out, and how many artifacts are on it. */
  arrangement: string
  count: number
  /** Whether the daemon is still on the other end of the socket. */
  connected: boolean
  /** The wall's plan view and its axis gizmo. Passed in rather than built
   *  here: both read the live camera, which the band has no other reason to
   *  know about. */
  plan?: ReactNode
  axes?: ReactNode
  look: StackParams['band']
  /** Whether the lightbox pages the whole wall as one list. */
  listed: boolean
  onList: () => void
}) {
  const bornAts = useMemo(() => items.map((i) => i.bornAt), [items])
  const span = useMemo(() => spanOf(bornAts, now), [bornAts, now])
  const bins = useMemo(() => histogram(bornAts, span, BINS), [bornAts, span])
  const tallest = Math.max(1, ...bins)

  const value: [number, number] = [range?.from ?? span.from, range?.to ?? span.to]

  // Everything else fixed to the top clears the band by `--band`, and the band
  // is as tall as its own type — so it publishes what it measures rather than
  // a constant that has to be re-guessed whenever the chrome is resized.
  const band = useRef<HTMLElement>(null)
  useEffect(() => {
    const el = band.current
    if (!el) return
    const publish = () =>
      document.documentElement.style.setProperty('--band', `${el.getBoundingClientRect().height}px`)
    publish()
    const watch = new ResizeObserver(publish)
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  // delamin8r reads its options once, so a tuning change unwraps the band and
  // wraps it again. `window`, not `tilt`: a tilt injects a deck, and the flex
  // row would be left laying out one child.
  useEffect(() => {
    const el = band.current
    if (!el || !look.parallax) return
    const handle = delaminate(el, {
      mode: 'window',
      step: look.step,
      perspective: look.perspective,
      swing: look.swing,
      // Panels, what they hold, and the rows and buttons in that. Below is the
      // slider's own machinery and the chart's bars.
      maxDepth: 3,
    })
    if (import.meta.env.DEV) {
      for (const { el: flat, cause } of handle.diagnose()) console.warn(`[band] flat: ${cause}`, flat)
    }
    return () => handle.destroy()
  }, [look.parallax, look.step, look.perspective, look.swing])

  return (
    <header className="topbar" ref={band} aria-label="Wall filters">
      {/* Classes in here are static and state rides on attributes: delamin8r
          writes `dl-plane` onto these elements, and React setting `className`
          strips it. */}
      <Panel name="time">
        <div className="topbar__chart">
          <Slider
            className="topbar__range wzl-skin"
            thumbs={[{ value: value[0] }, { value: value[1] }]}
            min={span.from}
            max={span.to}
            step={Math.max(1000, Math.round((span.to - span.from) / 400))}
            constraint="ordered"
            trackClick="move-nearest"
            trackHeight={34}
            readoutPlacement="none"
            ariaLabel="Time range"
            onInput={(next) => onRange({ from: next[0].value, to: next[1].value })}
            renderTrack={() => (
              /* The shape of the day, so a burst is something you can see
                 before you go looking for it. Drawn inside the track rather
                 than beside it, so the bars and the thumbs cannot land on
                 different widths. */
              <svg
                className="topbar__hist"
                viewBox={`0 0 ${BINS} 100`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                {bins.map((n, i) => {
                  const start = span.from + ((span.to - span.from) * i) / BINS
                  const inside = !range || (start >= range.from && start <= range.to)
                  return (
                    <rect
                      key={i}
                      className={`topbar__bar ${inside ? '' : 'topbar__bar--out'}`}
                      x={i}
                      y={100 - (n / tallest) * 100}
                      width={0.86}
                      height={(n / tallest) * 100}
                    />
                  )
                })}
              </svg>
            )}
          />
        </div>

        <div className="topbar__scale">
          <span>{ago(now - span.from)} ago</span>
          <span>now</span>
        </div>

        {/* Under the span they set, where a preset reads as a shortcut to a
            range rather than as a filter of its own. */}
        <div className="topbar__buckets">
          {BUCKETS.map((bucket) => {
            const b = bucketRange(bucket.key, now)
            const on = !!range && Math.abs(range.from - b.from) < 1000 && range.to >= b.to - 1000
            return (
              <button
                key={bucket.key}
                type="button"
                className="topbar__bucket"
                aria-pressed={on}
                onClick={() => onRange(on ? null : b)}
              >
                {bucket.label}
              </button>
            )
          })}
        </div>
      </Panel>

      {/* One key, both places: the zones on the wall and the flag list in the
          sidebar. */}
      <Panel name="sort" tight>
        <PanelRows>
          {SORTS.map((option, i) => (
            <PanelRow
              key={option.key}
              label={option.label}
              keys={[`F${i + 1}`]}
              selected={sort === option.key}
              onSelect={() => onSort(option.key)}
            />
          ))}
        </PanelRows>
      </Panel>

      {/* Where you are, held against the right edge and away from what you are
          filtering. */}
      <Panel name="view" tight pushed>
        <div className="topbar__view">
          {/* A colour per zone cannot be a class, so the value rides in as a
              custom property and the stylesheet decides what to do with it. */}
          <span
            className="topbar__where"
            data-hued={whereColor ? '' : undefined}
            style={whereColor ? ({ '--where': whereColor } as CSSProperties) : undefined}
          >
            {where ?? 'wall'}
          </span>
          {/* The keys are the only thing that says the arrangement can be
              swapped at all — there is no control to find. */}
          <PanelRow
            label={arrangement}
            keys={['[', ']']}
            keysTitle="[ and ] swap the arrangement"
          />
          <PanelRow
            label="list"
            keys={['L']}
            keysTitle="L pages the whole wall as one list"
            selected={listed}
            onSelect={onList}
          />
          <span className="topbar__tally">
            <span className="topbar__count">{count}</span> {count === 1 ? 'item' : 'items'}
          </span>
          {!connected && <span className="topbar__offline">offline</span>}
        </div>
      </Panel>
      {plan && (
        <Panel name="map" tight>
          {plan}
        </Panel>
      )}
      {axes && (
        <Panel name="axes" tight>
          {axes}
        </Panel>
      )}
    </header>
  )
}
