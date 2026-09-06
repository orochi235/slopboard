import { spawn } from 'node:child_process'
import { ALERTS, type Alerts, type Level } from '@shared/attention.ts'
import { config } from './config.ts'
import type { WallItem } from '@shared/protocol.ts'

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
