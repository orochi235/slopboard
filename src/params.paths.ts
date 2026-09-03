/** Every dotted path in `value` that addresses a number. Array indices are path
 *  segments, so `lod.0.edge` is editable like anything else. */
export function numberPathsOf(value: unknown, prefix = ''): string[] {
  if (typeof value === 'number') return [prefix]
  if (value === null || typeof value !== 'object') return []
  return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
    numberPathsOf(v, prefix ? `${prefix}.${k}` : k),
  )
}

export function getAt(root: unknown, path: string): number | undefined {
  const out = path.split('.').reduce<unknown>((acc, key) => {
    if (acc === null || typeof acc !== 'object') return undefined
    return (acc as Record<string, unknown>)[key]
  }, root)
  return typeof out === 'number' ? out : undefined
}

/** Structural copy along the path only. The frame loop reads this object every
 *  frame, so mutating in place would make a change invisible to React. */
export function setAt<T>(root: T, path: string, value: number): T {
  const [head, ...rest] = path.split('.')
  if (head === undefined) return root
  const src = root as unknown as Record<string, unknown>
  const next: unknown = rest.length === 0 ? value : setAt(src[head], rest.join('.'), value)
  if (Array.isArray(root)) {
    const copy = [...(root as unknown[])]
    copy[Number(head)] = next
    return copy as unknown as T
  }
  return { ...src, [head]: next } as unknown as T
}
