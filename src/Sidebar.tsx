import { useEffect, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import { ParamsBody } from '@/Params.tsx'
import { ago } from '@/age.ts'
import { emphasisAt } from '@shared/attention.ts'
import type { StackParams } from '@/params.ts'
import type { WallItem } from '@shared/protocol.ts'
import './sidebar.css'

/** Storage throws rather than returning null in a private window, so the wall
 *  opens with a default rather than not at all. */
function usePersistedFlag(key: string, initial: boolean) {
  const [on, setOn] = useState(() => {
    try {
      const raw = localStorage.getItem(key)
      return raw === null ? initial : raw === '1'
    } catch {
      return initial
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(key, on ? '1' : '0')
    } catch {
      // A refused store costs the panel's memory, not the panel.
    }
  }, [key, on])
  return [on, setOn] as const
}

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
  onOpen,
  onDismiss,
}: {
  items: readonly WallItem[]
  now: number
  onOpen: (item: WallItem) => void
  onDismiss: (id: string) => void
}) {
  const flagged = items.filter((i) => i.attention)
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

/**
 * The HUD the corners cannot hold. A column over the wall rather than beside
 * it: the scene is framed to the window, and narrowing the canvas would
 * re-frame every pile the moment the panel opened.
 */
export function Sidebar({
  items,
  clockOffset,
  params,
  onParams,
  onOpen,
  onDismiss,
  fakeCount,
  onGenerate,
  onClearFakes,
}: {
  items: readonly WallItem[]
  clockOffset: number
  params: StackParams
  onParams: Dispatch<SetStateAction<StackParams>>
  onOpen: (item: WallItem) => void
  onDismiss: (id: string) => void
  /** How many flags on the wall are the debug panel's own. */
  fakeCount: number
  onGenerate: () => void
  onClearFakes: () => void
}) {
  const [open, setOpen] = usePersistedFlag('slopboard.sidebar.open.v1', false)
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
        <Flags items={items} now={now} onOpen={onOpen} onDismiss={onDismiss} />
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
      </Section>

      <Section name="params" storageKey="slopboard.sidebar.params.v1">
        <ParamsBody params={params} onChange={onParams} />
      </Section>
    </aside>
  )
}
