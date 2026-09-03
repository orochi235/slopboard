export type BackendName = 'dom' | 'webgl'

/**
 * Read once at startup. One backend per window for its life, so the DOM wall
 * and the 3D wall can run on two monitors at once without a shared toggle.
 */
export function backendFrom(search: string): BackendName {
  return new URLSearchParams(search).get('backend') === 'webgl' ? 'webgl' : 'dom'
}
