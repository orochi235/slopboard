import type { Level } from '@shared/attention.ts'
import type { ZoneSettings } from '@shared/protocol.ts'
import type { Lifetime } from '@shared/lifetime.ts'

/** What the daemon decided to do about one attention level. */
export type Plan = { sound: boolean; notify: boolean; raise: 'none' | 'front' | 'start' }

/** One write to a zone's overrides. A field left out is untouched; a field
 *  passed as null goes back to inheriting the wall's. */
export type ZonePatch = {
  color?: string | null
  backdrop?: ZoneSettings['backdrop'] | null
  spacing?: number | null
  period?: number | null
  angle?: number | null
  lifetime?: Lifetime | null
}

/**
 * Every write the wall makes, in one place. Nothing here holds state
 * optimistically: the daemon answers each of these with the `ServerMessage`
 * every connected wall reads, and that message is what moves the picture.
 *
 * It is an interface rather than nine `fetch` calls because the demo wall has
 * no daemon to answer, and reduces these against a script instead.
 */
export type Actions = {
  /** Rescue an artifact, or let it go again. */
  keep: (id: string, on: boolean) => void
  /** Take one artifact now, ahead of its clock. */
  expire: (id: string) => void
  /** Stop it asking to be looked at. `question` closes a question rather than
   *  clearing a flag, which is the one dismissal a viewer must ask for. */
  dismiss: (id: string, question?: 'close', take?: string) => void
  /** Answer the question on a card, or on one take of a run. The chip is the
   *  submit, so `choice` is what a question offering choices answers with and
   *  `text` is whatever was in the free-text box, empty or not. */
  answer: (id: string, answer: { choice?: string; text?: string; take?: string }) => void
  /** Hand the original to whatever the OS opens it with. The browser cannot,
   *  so the daemon does. `app` is a take's offered app by position — never a
   *  name and never a path, so a page cannot name either. */
  openInApp: (id: string, app?: number) => void
  /** Put back what the last expiry took, one deep. Resolves to the ids
   *  restored, so a wall with a card open can follow it back. */
  undo: () => Promise<string[]>
  /** Take a whole zone at once. */
  expireZone: (zone: string) => void
  /** Hold a zone at the top of the wall, or let it back into the order. */
  pinZone: (zone: string, on: boolean) => void
  /** Set one zone's overrides. */
  setZoneSettings: (zone: string, patch: ZonePatch) => void
  /** Set how long an artifact lives from now on. */
  setTtl: (ms: number) => void
  /** Ask the daemon to play one attention level, for the sidebar's row of
   *  buttons. Resolves to what it decided to do, or null if it refused. */
  fireAlert: (level: Level) => Promise<Plan | null>
  /** Have the daemon fabricate an artifact to look at: a run of takes, a card
   *  with a question, or one already answered. A real send, so every gesture on
   *  it is the real gesture. Resolves false if the daemon refused. */
  synth: (what: 'run' | 'ask' | 'answered', takes?: number) => Promise<boolean>
}

/** A write whose only failure mode is that the picture does not change. Every
 *  one of these is answered by a broadcast, so a dropped call is visible. */
const post = (path: string, body?: unknown) => {
  void fetch(path, {
    method: 'POST',
    ...(body === undefined
      ? {}
      : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
  }).catch(() => {})
}

const zone = (name: string) => `/api/zones/${encodeURIComponent(name)}`

const live: Actions = {
  keep: (id, on) => post(`/api/items/${id}/keep?on=${on ? '1' : '0'}`),
  expire: (id) => post(`/api/items/${id}/expire`),
  dismiss: (id, question, take) => {
    const query = new URLSearchParams()
    if (question === 'close') query.set('question', 'close')
    if (take !== undefined) query.set('take', take)
    post(`/api/items/${id}/dismiss${query.size > 0 ? `?${query}` : ''}`)
  },
  answer: (id, answer) => post(`/api/items/${id}/answer`, answer),
  openInApp: (id, app) => post(`/api/items/${id}/open${app === undefined ? '' : `?app=${app}`}`),
  undo: async () => {
    try {
      const res = await fetch('/api/undo', { method: 'POST' })
      const body = (await res.json()) as { restored?: string[] }
      return body.restored ?? []
    } catch {
      return []
    }
  },
  expireZone: (name) => post(`${zone(name)}/expire`),
  pinZone: (name, on) => post(`${zone(name)}/pin?on=${on ? '1' : '0'}`),
  setZoneSettings: (name, patch) => post(`${zone(name)}/settings`, patch),
  setTtl: (ms) => post('/api/settings/ttl', { ms }),
  fireAlert: async (level) => {
    const res = await fetch(`/api/debug/alert/${level}`, { method: 'POST' })
    const body = (await res.json()) as { ok: boolean; plan?: Plan }
    return body.ok && body.plan ? body.plan : null
  },
  synth: async (what, takes) => {
    try {
      const res = await fetch('/api/debug/synth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ what, ...(takes === undefined ? {} : { takes }) }),
      })
      return ((await res.json()) as { ok?: boolean }).ok === true
    } catch {
      return false
    }
  },
}

let current: Actions = live

/** Points every write at something other than the daemon. The demo wall calls
 *  this once, before the first render. */
export const installActions = (next: Actions) => {
  current = next
}

/** The wall writes through this and never through `fetch` directly. Read per
 *  call rather than bound once, so an install after module load still takes. */
export const actions: Actions = {
  keep: (id, on) => current.keep(id, on),
  expire: (id) => current.expire(id),
  dismiss: (id, question, take) => current.dismiss(id, question, take),
  answer: (id, answer) => current.answer(id, answer),
  openInApp: (id, app) => current.openInApp(id, app),
  undo: () => current.undo(),
  expireZone: (name) => current.expireZone(name),
  pinZone: (name, on) => current.pinZone(name, on),
  setZoneSettings: (name, patch) => current.setZoneSettings(name, patch),
  setTtl: (ms) => current.setTtl(ms),
  fireAlert: (level) => current.fireAlert(level),
  synth: (what, takes) => current.synth(what, takes),
}
