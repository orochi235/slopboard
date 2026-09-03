import { controlsOf } from '@/params.controls.ts'
import { leafAt, setAt } from '@/params.paths.ts'
import type { StackParams } from '@/params.ts'
import './params.css'

/** Enough digits to read a small step without turning every row into noise. */
const show = (n: number) => (Math.abs(n) >= 1000 ? n.toExponential(2) : String(Number(n.toFixed(4))))

/** Every parameter, editable live. Tuning by editing source and reloading does
 *  not converge, which is the whole reason this exists. */
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
        {controlsOf(params).map((control) => {
          const value = leafAt(params, control.path) ?? 0
          const set = (next: number | string | boolean) =>
            onChange(setAt(params, control.path, next))
          return (
            <label key={control.path} className="params__row">
              <span className="params__name">{control.path}</span>
              {control.kind === 'slider' && (
                <>
                  <input
                    className="params__slider"
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={value as number}
                    onChange={(e) => set(Number(e.target.value))}
                  />
                  <span className="params__value">{show(value as number)}</span>
                </>
              )}
              {control.kind === 'choice' && (
                <select
                  className="params__wide"
                  value={String(value)}
                  onChange={(e) => {
                    const raw = e.target.value
                    const n = Number(raw)
                    set(raw !== '' && Number.isFinite(n) ? n : raw)
                  }}
                >
                  {control.options.map((option) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)}
                    </option>
                  ))}
                </select>
              )}
              {control.kind === 'toggle' && (
                <input
                  className="params__toggle"
                  type="checkbox"
                  checked={value === true}
                  onChange={(e) => set(e.target.checked)}
                />
              )}
              {control.kind === 'number' && (
                <input
                  className="params__wide"
                  type="number"
                  step="any"
                  value={value as number}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) set(n)
                  }}
                />
              )}
            </label>
          )
        })}
      </div>
    </details>
  )
}
