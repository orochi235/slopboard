import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { Slider } from '@weasel-js/ui'
import { ago } from '@/age.ts'
import { BUCKETS, bucketRange, histogram, spanOf, type Range } from '@/nav/time-filter.ts'
import { SORTS, type SortKey } from '@/nav/sort.ts'
import type { WallItem } from '@shared/protocol.ts'
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
  arrangement,
  count,
  connected,
  plan,
  axes,
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
}) {
  const bornAts = useMemo(() => items.map((i) => i.bornAt), [items])
  const span = useMemo(() => spanOf(bornAts, now), [bornAts, now])
  const bins = useMemo(() => histogram(bornAts, span, BINS), [bornAts, span])
  const tallest = Math.max(1, ...bins)

  const value: [number, number] = [range?.from ?? span.from, range?.to ?? span.to]
  const kept = range ? bornAts.filter((t) => t >= range.from && t <= range.to).length : bornAts.length

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

  return (
    <header className="topbar" ref={band} aria-label="Wall filters">
      <fieldset className="topbar__block">
        {/* The whole top edge: the title holds one end and the keys the other,
            both cut into the border rather than sitting under it. */}
        <legend className="topbar__legend topbar__legend--row">
          <span className="topbar__name">time</span>
          <span className="topbar__count">
            {kept}/{bornAts.length}
          </span>

          {/* The run of border the legend displaces between the two ends. */}
          <span className="topbar__rule" aria-hidden="true" />

          <div className="topbar__buckets topbar__buckets--end">
            {BUCKETS.map((bucket) => {
              const b = bucketRange(bucket.key, now)
              const on = !!range && Math.abs(range.from - b.from) < 1000 && range.to >= b.to - 1000
              return (
                <button
                  key={bucket.key}
                  type="button"
                  className={`topbar__bucket ${on ? 'topbar__bucket--on' : ''}`}
                  aria-pressed={on}
                  onClick={() => onRange(on ? null : b)}
                >
                  {bucket.label}
                </button>
              )
            })}
          </div>

        </legend>

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
      </fieldset>

      {/* One key, both places: the zones on the wall and the flag list in the
          sidebar. */}
      <fieldset className="topbar__block topbar__block--tight">
        <legend className="topbar__name topbar__legend">sort</legend>
        <div className="topbar__buckets topbar__buckets--stack">
          {SORTS.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`topbar__bucket ${sort === option.key ? 'topbar__bucket--on' : ''}`}
              aria-pressed={sort === option.key}
              onClick={() => onSort(option.key)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      {/* Where you are, held against the right edge and away from what you are
          filtering. */}
      <fieldset className="topbar__block topbar__block--tight topbar__block--pushed">
        <legend className="topbar__name topbar__legend">view</legend>
        <div className="topbar__view">
          <span className="topbar__where">{where ?? 'wall'}</span>
          <span className="topbar__arrangement">{arrangement}</span>
          <span className="topbar__tally">
            <span className="topbar__count">{count}</span> {count === 1 ? 'item' : 'items'}
          </span>
          {!connected && <span className="topbar__offline">offline</span>}
        </div>
      </fieldset>
      {plan && (
        <fieldset className="topbar__block topbar__block--tight">
          <legend className="topbar__name topbar__legend">map</legend>
          {plan}
        </fieldset>
      )}
      {axes && (
        <fieldset className="topbar__block topbar__block--tight">
          <legend className="topbar__name topbar__legend">axes</legend>
          {axes}
        </fieldset>
      )}
    </header>
  )
}
