import { getAt, numberPathsOf, setAt } from '@/params.paths.ts'
import type { StackParams } from '@/params.ts'
import './params.css'

/** Every number in StackParams, editable live. Tuning by editing source and
 *  reloading does not converge, which is the whole reason this exists. */
export function ParamsPanel({
  params,
  onChange,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
}) {
  return (
    <details className="params">
      <summary className="params__summary">params</summary>
      <div className="params__grid">
        {numberPathsOf(params).map((path) => (
          <label key={path} className="params__row">
            <span className="params__name">{path}</span>
            <input
              className="params__input"
              type="number"
              step="any"
              value={getAt(params, path) ?? 0}
              onChange={(e) => {
                const n = Number(e.target.value)
                if (Number.isFinite(n)) onChange(setAt(params, path, n))
              }}
            />
          </label>
        ))}
      </div>
    </details>
  )
}
