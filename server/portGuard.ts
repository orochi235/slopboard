export type PortHolder = 'transom' | 'foreign'

/** `/api/health`'s shape. Checked structurally, because any server can answer
 *  200 with JSON and only this one answers with these fields. */
function isHealth(body: unknown): boolean {
  if (typeof body !== 'object' || body === null) return false
  const h = body as Record<string, unknown>
  return h.ok === true && typeof h.ttlMs === 'number'
}

/**
 * Who owns a port we failed to bind. Everything that is not demonstrably a
 * transom daemon is foreign, including a refused connection — the caller
 * exits either way, and the distinction only decides whether that is an error.
 */
export async function classifyPortHolder(
  port: number,
  fetchImpl: typeof fetch = fetch,
): Promise<PortHolder> {
  try {
    const res = await fetchImpl(`http://127.0.0.1:${port}/api/health`)
    if (!res.ok) return 'foreign'
    return isHealth(await res.json()) ? 'transom' : 'foreign'
  } catch {
    return 'foreign'
  }
}
