import chokidar from 'chokidar'
import { readFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { config } from './config.ts'
import { parseHued } from '../shared/hued.ts'

const bindingsPath = join(config.root, 'bindings.json')

type Binding = { zone: string }

/**
 * A colour per zone, taken from the `.hued` file of the project bound to it.
 * The browser cannot read either file, so the daemon owns this and publishes
 * it; a zone with no binding or no `.hued` simply has no entry, and the wall
 * falls back to its own palette.
 */
export async function readZoneColors(): Promise<Record<string, string>> {
  let bindings: Record<string, Binding>
  try {
    bindings = JSON.parse(await readFile(bindingsPath, 'utf8'))
  } catch {
    return {}
  }

  const out: Record<string, string> = {}
  await Promise.all(
    Object.entries(bindings).map(async ([path, binding]) => {
      const zone = binding?.zone ?? basename(path)
      try {
        const hued = parseHued(await readFile(join(path, '.hued'), 'utf8'))
        if (hued.background) out[zone] = hued.background
      } catch {
        // No .hued, or an unreadable project directory. Not an error: most
        // zones are not bound to a project at all.
      }
    }),
  )
  return out
}

/** Re-reads whenever the bindings or any bound project's `.hued` changes, so
 *  recolouring a project reaches the wall without restarting the daemon. */
export function watchZoneColors(onChange: (colors: Record<string, string>) => void) {
  let watcher: ReturnType<typeof chokidar.watch> | null = null

  const rescan = async () => {
    const colors = await readZoneColors()
    onChange(colors)

    let bindings: Record<string, Binding> = {}
    try {
      bindings = JSON.parse(await readFile(bindingsPath, 'utf8'))
    } catch {
      bindings = {}
    }
    const hueds = Object.keys(bindings).map((path) => join(path, '.hued'))
    await watcher?.close()
    watcher = chokidar.watch([bindingsPath, ...hueds], { ignoreInitial: true })
    watcher.on('all', () => void rescan())
  }

  void rescan()
  return () => void watcher?.close()
}
