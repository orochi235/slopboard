/** The daemon's port and the page's, for whatever runs under node. `libexec/agents`
 *  and `menubar.yaml` cannot import this and repeat the defaults. */
export const DAEMON_PORT = Number(process.env.TRANSOM_PORT ?? 8787)
export const CLIENT_PORT = Number(process.env.TRANSOM_CLIENT_PORT ?? 7750)
