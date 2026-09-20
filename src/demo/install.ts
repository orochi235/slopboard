import { installActions } from '@/actions.ts'
import { installTransport } from '@/transport.ts'
import { createDemoDaemon } from '@/demo/daemon.ts'

/**
 * Imported for its effect, and only under `VITE_SLOP_DEMO`. Kept as its own
 * module so the one `import()` that pulls the demo in is a statement rollup
 * can see is unreachable, and the pictures go with it.
 */
const demo = createDemoDaemon()
installTransport(demo.transport)
installActions(demo.actions)
