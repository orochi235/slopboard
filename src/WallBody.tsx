import { PropertyField, PropertyList } from '@weasel-js/ui'
import { ttlOptions } from '@/wall-settings.ts'
import './params.css'

/**
 * The wall's own settings, as opposed to how it is drawn: these go to the
 * daemon and hold for every browser, which is why they are a page of their own
 * rather than another group of params.
 */
export function WallBody({ ttlMs, onTtl }: { ttlMs: number; onTtl: (ms: number) => void }) {
  return (
    <div className="params__group" data-open="">
      <PropertyList>
        <PropertyField
          kind="enum"
          label="lifetime"
          layout="inline"
          value={String(ttlMs)}
          options={ttlOptions(ttlMs)}
          onChange={(raw) => {
            const ms = Number(raw)
            if (Number.isFinite(ms)) onTtl(ms)
          }}
        />
      </PropertyList>
      <p className="params__note">
        how long an artifact lives unless it was sent with its own <code>--ttl</code>, or rescued.
        Set on the daemon, so it holds for every wall and survives a restart.
      </p>
    </div>
  )
}
