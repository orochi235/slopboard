import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { UNKNOWN, type Build } from '@shared/build.ts'

/** The checkout this file lives in, not the process's cwd: the daemon runs
 *  from a LaunchAgent, whose working directory is not the repo. */
const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const git = (...args: string[]): string =>
  execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()

/**
 * What this process is running, read once at start — which is the point. A
 * daemon that re-read the sha per request would report the code on disk rather
 * than the code it is executing, and the gap between those two is the whole
 * thing being measured.
 */
function read(): Build {
  try {
    return {
      sha: git('rev-parse', '--short', 'HEAD'),
      dirty: git('status', '--porcelain').length > 0,
      startedAt: Date.now(),
    }
  } catch {
    // No git, or no checkout — a published copy running from a tarball. The
    // wall compares unknowns as agreeing, so this reports nothing rather than
    // crying stale forever.
    return { ...UNKNOWN, startedAt: Date.now() }
  }
}

export const build: Build = read()
