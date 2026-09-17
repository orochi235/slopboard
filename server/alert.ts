import { spawn } from 'node:child_process'
import { ALERTS, DEFAULT_HOLD, type Alerts, type Level } from '@shared/attention.ts'
import { config } from './config.ts'
import type { Alert, WallItem } from '@shared/protocol.ts'

/** What raising the wall means, which depends on whether it is running. */
export type Raise = 'none' | 'front' | 'start'

export type Plan = { sound: boolean; notify: boolean; raise: Raise }

/**
 * What the daemon does about an arrival. Pure, because the interesting part is
 * the decision: the effects are three `spawn` calls that can only be watched.
 *
 * `wallOpen` is the count of connected clients, not a guess about processes —
 * the daemon is the thing they are connected to.
 */
export function planFor(level: Level | null, wallOpen: boolean): Plan {
  const alerts: Alerts | undefined = level ? ALERTS[level] : undefined
  if (!alerts) return { sound: false, notify: false, raise: 'none' }
  return {
    sound: alerts.sound,
    notify: alerts.notify,
    raise: !alerts.raise ? 'none' : wallOpen ? 'front' : 'start',
  }
}

/**
 * A flagged arrival that never happened, for the sidebar's alert buttons. The
 * whole treatment is worth hearing rather than reasoning about, and three of
 * the four effects are the daemon's, so they cannot be faked in the page the
 * way `fakeFlags` fakes a badge.
 *
 * It is never broadcast, so nothing lands on the wall and the ids resolve to
 * no file. `alert` reads only the four fields below.
 */
export function debugItem(level: Level): WallItem {
  return {
    id: `debug-${level}`,
    url: '',
    origUrl: '',
    zone: 'debug',
    name: `debug ${level}`,
    bornAt: Date.now(),
    attention: { level, holdMs: DEFAULT_HOLD[level] },
    note: 'debug alert — nothing is actually wrong',
    path: '',
    w: 0,
    h: 0,
  }
}

/**
 * What the wall shows for a sound it just heard: nothing for a plan with no
 * sound, since a toast with no noise behind it is a second badge. The daemon
 * says this rather than the wall deriving it, so the toast and the sound can
 * never disagree about whether one happened.
 */
export function toastFor(item: WallItem, plan: Plan): Alert | null {
  if (!plan.sound || !item.attention) return null
  return {
    id: item.id,
    zone: item.zone,
    level: item.attention.level,
    asks: item.question ?? item.note ?? item.name,
    name: item.name,
    ...(item.repo ? { repo: item.repo } : {}),
    ...(item.sha ? { sha: item.sha } : {}),
  }
}

/** Detached and ignored. An alert that fails is not worth an arrival. */
function fire(argv: readonly [string, ...string[]]) {
  try {
    const [cmd, ...args] = argv
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
  } catch {
    // A missing binary costs the alert, never the ingest.
  }
}

const quote = (text: string) => text.replace(/["\\]/g, '\\$&')

export function alert(item: WallItem, wallOpen: boolean): Plan {
  const plan = planFor(item.attention?.level ?? null, wallOpen)
  if (plan.sound) fire(['afplay', config.alertSound])
  if (plan.notify) {
    const body = item.note ?? item.name
    fire([
      'osascript',
      '-e',
      `display notification "${quote(body)}" with title "${quote(item.zone)}" subtitle "slopboard"`,
    ])
  }
  // Starting it is the same command a person would type, which is why the URL
  // and the profile live in config rather than here.
  if (plan.raise === 'front') fire(['open', '-a', config.wallBrowser])
  if (plan.raise === 'start')
    fire([
      'open',
      '-na',
      config.wallBrowser,
      '--args',
      `--app=${config.wallUrl}`,
      `--user-data-dir=${config.wallProfile}`,
    ])
  return plan
}
