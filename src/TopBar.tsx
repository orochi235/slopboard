import { useMemo } from 'react'
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
}: {
  items: readonly WallItem[]
  /** The daemon's clock, so the axis agrees with every age on the wall. */
  now: number
  range: Range | null
  onRange: (next: Range | null) => void
  sort: SortKey
  onSort: (next: SortKey) => void
}) {
  const bornAts = useMemo(() => items.map((i) => i.bornAt), [items])
  const span = useMemo(() => spanOf(bornAts, now), [bornAts, now])
  const bins = useMemo(() => histogram(bornAts, span, BINS), [bornAts, span])
  const tallest = Math.max(1, ...bins)

  const value: [number, number] = [range?.from ?? span.from, range?.to ?? span.to]
  const kept = range ? bornAts.filter((t) => t >= range.from && t <= range.to).length : bornAts.length

  return (
    <header className="topbar" aria-label="Wall filters">
      <section className="topbar__block">
        <div className="topbar__head">
          <h2 className="topbar__name">time</h2>
          <span className="topbar__count">
            {kept}/{bornAts.length}
          </span>
          {range && (
            <button type="button" className="topbar__clear" onClick={() => onRange(null)}>
              clear
            </button>
          )}
        </div>

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

        <div className="topbar__buckets">
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
      </section>

      {/* One key, both places: the zones on the wall and the flag list in the
          sidebar. */}
      <section className="topbar__block topbar__block--tight">
        <div className="topbar__head">
          <h2 className="topbar__name">sort</h2>
        </div>
        <div className="topbar__buckets">
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
      </section>
    </header>
  )
}
