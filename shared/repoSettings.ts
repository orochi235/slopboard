import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Ajv from 'ajv'
import { parseDocument } from 'yaml'
import { LEVELS, type Level } from './attention.ts'
import { parseDuration } from './duration.ts'

/** What a repo's `.transom.yaml` says. `transom.schema.json` is the definition;
 *  this is its shape for code. */
export type RepoSettings = {
  zone?: string
  show?: 'wall' | 'preview'
  defaults?: {
    ttl?: string | number
    apps?: (string | { name: string; path?: string })[]
  }
  attention?: { loudest?: Level; sound?: boolean }
  marks?: { unsent?: 'keep' }
}

export const SETTINGS_FILE = '.transom.yaml'

export const SCHEMA_URL = 'https://michaelbaker.tech/transom/schema/transom.json'

/** What `transom wire --repo` writes: every setting, commented out at its
 *  default, so the file changes nothing until someone uncomments a line. */
export const STARTER = `# yaml-language-server: $schema=${SCHEMA_URL}
#
# How transom treats renders sent from this repo. Every key is optional, and a
# flag on \`transom post\` beats this file.
#
# zone: my-zone          # default: this repo's directory name
# show: wall             # wall | preview (open renders locally instead)
# defaults:
#   ttl: 8h              # as --ttl
#   apps:                # as --app; a path is relative to the repo root
#     - LDView
#     - { name: Studio, path: parts/3001.dat }
# attention:
#   loudest: problem     # look | soon | urgent | problem
#   sound: true
# marks:
#   unsent: keep         # marks left when the sending session is gone
`

// Read rather than imported: this module also runs under bare `node`, from the
// send path and the hook, where a JSON import needs an attribute tsc rejects.
const schema = JSON.parse(readFileSync(new URL('./transom.schema.json', import.meta.url), 'utf8'))
const validate = new Ajv({ allErrors: true, allowUnionTypes: true }).compile(schema)

export type Parsed = { settings: RepoSettings; errors: string[] }

/** The file's settings, or everything wrong with it. A file with any error
 *  yields no settings at all: half a committed config is worse than none. */
export function parseRepoSettings(text: string): Parsed {
  const doc = parseDocument(text)
  if (doc.errors.length > 0) {
    return { settings: {}, errors: doc.errors.map((e) => e.message.split('\n')[0]!) }
  }
  const data = doc.toJS() ?? {}
  const errors: string[] = []
  if (!validate(data)) {
    for (const e of validate.errors ?? []) {
      const at = e.instancePath || '/'
      if (e.keyword === 'additionalProperties') {
        const key = (e.params as { additionalProperty: string }).additionalProperty
        errors.push(`${at === '/' ? '' : at}/${key}: not a setting`)
      } else if (e.keyword !== 'anyOf') {
        errors.push(`${at}: ${e.message}`)
      }
    }
  }
  const ttl = (data as RepoSettings).defaults?.ttl
  if (ttl !== undefined && parseDuration(String(ttl)) === null) {
    errors.push(`/defaults/ttl: not a duration (${ttl})`)
  }
  return errors.length > 0 ? { settings: {}, errors } : { settings: data as RepoSettings, errors }
}

/** The settings file governing `dir`: the nearest one up to the repo root. */
export function findSettingsFile(dir: string): string | null {
  for (let at = dir; ; at = dirname(at)) {
    const file = join(at, SETTINGS_FILE)
    if (existsSync(file)) return file
    if (existsSync(join(at, '.git')) || dirname(at) === at) return null
  }
}

/**
 * An `--attention` token lowered to `loudest`, keeping its hold: `urgent:30m`
 * under `soon` is `soon:30m`. A token naming no level asks for `look`, which
 * nothing is below, so it passes through.
 */
export function clampAttention(token: string, loudest: Level | undefined): string {
  if (!loudest) return token
  const cut = token.indexOf(':')
  const head = (cut === -1 ? token : token.slice(0, cut)).trim().toLowerCase()
  const level = LEVELS.indexOf(head as Level)
  if (level === -1 || level <= LEVELS.indexOf(loudest)) return token
  return cut === -1 ? loudest : `${loudest}${token.slice(cut)}`
}
