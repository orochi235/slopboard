import { useEffect, useState } from 'react'
import { usePersistedFlag } from '@/usePersistedFlag.ts'
import type { Dispatch, SetStateAction } from 'react'
import { ParamsBody } from '@/Params.tsx'
import { ago } from '@/age.ts'
import { ALERTS, emphasisAt, LEVELS, type Level } from '@shared/attention.ts'
import { sortFlags, type SortKey } from '@/nav/sort.ts'
import type { StackParams } from '@/params.ts'
import type { WallItem } from '@shared/protocol.ts'
import './sidebar.css'

function Section({
  name,
  storageKey,
  children,
}: {
  name: string
  storageKey: string
  children: React.ReactNode
}) {
  const [open, setOpen] = usePersistedFlag(storageKey, true)
  return (
    <details className="sidebar__section" open={open}>
      <summary
        className="sidebar__sectionName"
        onClick={(e) => {
          e.preventDefault()
          setOpen((was) => !was)
        }}
      >
        {name}
      </summary>
      <div className="sidebar__sectionBody">{children}</div>
    </details>
  )
}

function Flags({
  items,
  now,
  sort,
  onOpen,
  onDismiss,
}: {
  items: readonly WallItem[]
  now: number
  /** The band's key, read and never set here: the list and the wall agree
   *  about what is at the top because neither owns the order. */
  sort: SortKey
  onOpen: (item: WallItem) => void
  onDismiss: (id: string) => void
}) {
  const flagged = sortFlags(
    items.filter((i) => i.attention),
    sort,
    now,
  )
  if (flagged.length === 0) return <p className="sidebar__empty">nothing is asking</p>

  return (
    <ul className="sidebar__flags">
      {flagged.map((item) => (
        <li
          className={`sidebar__flag ${
            emphasisAt(item.attention, item.bornAt, now) > 0 ? '' : 'sidebar__flag--lapsed'
          }`}
          key={item.id}
        >
          {/* The row is the target, not the <li>: a list item's box and role
              belong to the list. */}
          <div
            className="sidebar__flagRow"
            role="button"
            tabIndex={0}
            onClick={() => onOpen(item)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              onOpen(item)
            }}
          >
            {/* The level's color is already a custom property on the root,
                written by applyColors from the same params the scene reads. */}
            <span className={`sidebar__dot sidebar__dot--${item.attention?.level ?? 'look'}`} />
            {/* Never the level's name: a level is a treatment, and reading it
                back as text is the substitution the badge refuses to make. */}
            <span className="sidebar__flagNote">{item.note ?? item.name}</span>
            <span className="sidebar__flagWhere">
              {item.zone} · {ago(now - item.bornAt)}
            </span>
          </div>
          <button
            type="button"
            className="sidebar__dismiss"
            onClick={() => onDismiss(item.id)}
            aria-label={`Dismiss ${item.note ?? item.name}`}
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  )
}

type Plan = { sound: boolean; notify: boolean; raise: 'none' | 'front' | 'start' }

/** What a plan did, in the words of the things that happened. */
const readPlan = (level: Level, plan: Plan, opened: boolean): string => {
  const did = [
    plan.sound ? 'sound' : null,
    plan.notify ? 'notification' : null,
    plan.raise === 'front' ? 'window forward' : plan.raise === 'start' ? 'window started' : null,
    opened ? 'lightbox' : null,
  ].filter(Boolean)
  return did.length === 0 ? `${level}: nothing beyond the badge` : `${level}: ${did.join(' · ')}`
}

/**
 * One button per level, firing that level's whole treatment.
 *
 * Three of the four effects are the daemon's, so unlike `fakeFlags` this
 * cannot be faked in the page: the route runs the same `alert` an arrival
 * runs. The fourth, the lightbox, is the wall's own, so it opens here — on a
 * real artifact, because a lightbox over an item that resolves to no file
 * shows the level's treatment as a broken image.
 */
function AlertButtons({
  items,
  onOpen,
}: {
  items: readonly WallItem[]
  onOpen: (item: WallItem) => void
}) {
  const [said, setSaid] = useState<string | null>(null)

  const fire = async (level: Level) => {
    setSaid(`${level}…`)
    const shown = ALERTS[level].lightbox ? items[Math.floor(Math.random() * items.length)] : undefined
    try {
      const res = await fetch(`/api/debug/alert/${level}`, { method: 'POST' })
      const body = (await res.json()) as { ok: boolean; plan?: Plan }
      if (!body.ok || !body.plan) return setSaid(`${level}: the daemon refused it`)
      if (shown) onOpen(shown)
      setSaid(readPlan(level, body.plan, !!shown))
    } catch {
      setSaid(`${level}: no daemon`)
    }
  }

  return (
    <>
      <div className="sidebar__buttons">
        {LEVELS.map((level) => (
          <button
            key={level}
            type="button"
            className={`params__button sidebar__alert sidebar__alert--${level}`}
            onClick={() => void fire(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <p className="sidebar__empty">{said ?? 'fires the real treatment — the daemon runs it'}</p>
    </>
  )
}

/**
 * The HUD the corners cannot hold. A column over the wall rather than beside
 * it: the scene is framed to the window, and narrowing the canvas would
 * re-frame every pile the moment the panel opened.
 */
export function Sidebar({
  items,
  clockOffset,
  sort,
  params,
  onParams,
  onOpen,
  onDismiss,
  fakeCount,
  onGenerate,
  onClearFakes,
  open,
  setOpen,
}: {
  items: readonly WallItem[]
  clockOffset: number
  sort: SortKey
  params: StackParams
  onParams: Dispatch<SetStateAction<StackParams>>
  onOpen: (item: WallItem) => void
  onDismiss: (id: string) => void
  /** How many flags on the wall are the debug panel's own. */
  fakeCount: number
  onGenerate: () => void
  onClearFakes: () => void
  /** Owned by the wall, which frames around the panel while it is up. */
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}) {
  // Ticks the ages rather than the wall: the rows read a clock, and the scene
  // has its own frame loop that this must not join.
  const [now, setNow] = useState(() => Date.now() + clockOffset)
  useEffect(() => {
    if (!open) return
    const id = setInterval(() => setNow(Date.now() + clockOffset), 1000)
    return () => clearInterval(id)
  }, [open, clockOffset])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '\\') setOpen((was) => !was)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])

  if (!open) {
    return (
      <button
        type="button"
        className="sidebar__tab"
        onClick={() => setOpen(true)}
        aria-label="Open sidebar"
      >
        ‹
      </button>
    )
  }

  return (
    <aside className="sidebar" aria-label="Wall sidebar">
      <header className="sidebar__head">
        <span className="sidebar__title">slopboard</span>
        <button
          type="button"
          className="sidebar__close"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        >
          ×
        </button>
      </header>

      <Section name="flags" storageKey="slopboard.sidebar.flags.v1">
        <Flags items={items} now={now} sort={sort} onOpen={onOpen} onDismiss={onDismiss} />
      </Section>

      <Section name="debug" storageKey="slopboard.sidebar.debug.v1">
        <div className="sidebar__buttons">
          <button type="button" className="params__button" onClick={onGenerate}>
            flag 8 random
          </button>
          <button
            type="button"
            className="params__button"
            onClick={onClearFakes}
            disabled={fakeCount === 0}
          >
            clear {fakeCount > 0 ? fakeCount : ''}
          </button>
        </div>
        <p className="sidebar__empty">
          fabricated in this tab only — the daemon never sees them
        </p>
        <AlertButtons items={items} onOpen={onOpen} />
      </Section>

      <Section name="params" storageKey="slopboard.sidebar.params.v1">
        <ParamsBody params={params} onChange={onParams} />
      </Section>
    </aside>
  )
}
