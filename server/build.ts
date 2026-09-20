import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { DAEMON_PATHS, UNKNOWN, type Build } from '@shared/build.ts'

/** The checkout this file lives in, not the process's cwd: the daemon runs
 *  from a LaunchAgent, whose working directory is not the repo. */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const git = (...args: string[]): string =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/** The daemon's code as it stands on disk right now. */
export function stamp(): Build {
  try {
    return {
      sha: git('log', '-1', '--format=%h', '--', ...DAEMON_PATHS),
      dirty: git('status', '--porcelain', '--', ...DAEMON_PATHS).length > 0,
      startedAt: 0,
    }
  } catch {
    // No git, or no checkout — a published copy running from a tarball. The
    // wall compares unknowns as agreeing, so this reports nothing rather than
    // crying stale forever.
    return UNKNOWN
  }
}

/**
 * What this process is running, read once at start — which is the point. The
 * gap between this and `stamp()` read later is the whole thing being measured.
 */
export const build: Build = { ...stamp(), startedAt: Date.now() }
