import type { Edge } from '@/textures/ratchet.ts'
import { ratchet } from '@/textures/ratchet.ts'
import { createTextureStore } from '@/textures/store.ts'

export type TextureManager<T> = {
  /** Reconcile against what this frame wants: `id → LOD edge`. */
  sync(want: ReadonlyMap<string, number>): void
  textureFor(id: string): T | undefined
  clear(): void
}

/**
 * Holds one texture per visible item at the edge its rank earned. `load` is
 * injected rather than imported so this runs with no GL context and no browser.
 */
export function createTextureManager<T>(opts: {
  budgetBytes: number
  urlFor: (id: string) => string
  load: (url: string, edge: number) => Promise<{ value: T; bytes: number } | null>
  dispose: (value: T) => void
  /** A texture has landed. A canvas that draws on demand has nothing else to
   *  tell it the card can now be drawn with its picture. */
  onLoad?: () => void
}): TextureManager<T> {
  const store = createTextureStore<T>({ budgetBytes: opts.budgetBytes, dispose: opts.dispose })
  const heldEdge = new Map<string, Edge>()
  const inFlight = new Set<string>()

  return {
    sync(want) {
      for (const id of [...heldEdge.keys()]) {
        if (want.has(id)) continue
        store.delete(id)
        heldEdge.delete(id)
      }

      for (const [id, requested] of want) {
        const next = ratchet(heldEdge.get(id), requested as Edge)
        if (next === 0) continue
        if (heldEdge.get(id) === next && store.get(id) !== undefined) continue
        if (inFlight.has(id)) continue

        inFlight.add(id)
        void opts.load(opts.urlFor(id), next).then((loaded) => {
          inFlight.delete(id)
          if (!loaded) return
          store.put(id, loaded.value, loaded.bytes)
          heldEdge.set(id, next)
          opts.onLoad?.()
        })
      }
    },
    textureFor: (id) => store.get(id),
    clear() {
      store.clear()
      heldEdge.clear()
      inFlight.clear()
    },
  }
}
