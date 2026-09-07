import { useRef, useState } from 'react'
import { controlsOf } from '@/params.controls.ts'
import { groupControls } from '@/params.groups.ts'
import { leafAt, setAt } from '@/params.paths.ts'
import { defaultParams, type StackParams } from '@/params.ts'
import { fromText, toText } from '@/params.transfer.ts'
import './params.css'

/** Enough digits to read a small step without turning every row into noise. */
const show = (n: number) => (Math.abs(n) >= 1000 ? n.toExponential(2) : String(Number(n.toFixed(4))))

/**
 * Moving a tuned set in and out. The clipboard is the fast path — what is
 * copied pastes straight into `src/params.ts` — and the file is for keeping a
 * few named sets around, which the clipboard cannot.
 */
function Transfer({
  params,
  onChange,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
}) {
  const [note, setNote] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  const flash = (text: string) => {
    setNote(text)
    setTimeout(() => setNote(''), 1400)
  }

  const apply = (text: string) => {
    const next = fromText(defaultParams, text)
    if (!next) return flash('not params')
    onChange(next)
    flash('loaded')
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toText(params))
      flash('copied')
    } catch {
      flash('clipboard refused')
    }
  }

  const paste = async () => {
    try {
      apply(await navigator.clipboard.readText())
    } catch {
      flash('clipboard refused')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([toText(params)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'slopboard-params.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="params__transfer">
      <button type="button" className="params__button" onClick={copy}>
        copy
      </button>
      <button type="button" className="params__button" onClick={paste}>
        paste
      </button>
      <button type="button" className="params__button" onClick={download}>
        save
      </button>
      <button type="button" className="params__button" onClick={() => picker.current?.click()}>
        load
      </button>
      <span className="params__note">{note}</span>
      <input
        ref={picker}
        className="params__file"
        type="file"
        accept="application/json,.json"
        onChange={async (e) => {
          const file = e.target.files?.[0]
          // Cleared so picking the same file twice in a row still fires.
          e.target.value = ''
          if (file) apply(await file.text())
        }}
      />
    </div>
  )
}

/**
 * Every parameter, editable live. Tuning by editing source and reloading does
 * not converge, which is the whole reason this exists. Rendered by the sidebar
 * and by the prefs modal both, so the two surfaces cannot drift apart while
 * prefs is still just a copy of params.
 */
export function ParamsBody({
  params,
  onChange,
  expanded = false,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
  /** Every group open. The corner panel is a column beside the wall and stays
   *  folded; the modal has the room, and folded groups waste it. */
  expanded?: boolean
}) {
  return (
    <>
      <Transfer params={params} onChange={onChange} />
      {groupControls(controlsOf(params)).map((group) => (
        <details className="params__group" key={group.name} open={expanded || group.name === 'wall'}>
          <summary className="params__groupName">{group.name}</summary>
          <div className="params__grid">
            {group.controls.map((control) => {
          const value = leafAt(params, control.path) ?? 0
          const set = (next: number | string | boolean) =>
            onChange(setAt(params, control.path, next))
          return (
            <label key={control.path} className="params__row">
              <span className="params__name" title={control.path}>
                {control.path.startsWith(`${group.name}.`)
                  ? control.path.slice(group.name.length + 1)
                  : control.path}
              </span>
              {control.kind === 'slider' && (
                <>
                  <input
                    className="params__slider"
                    type="range"
                    min={control.min}
                    max={control.max}
                    step={control.step}
                    value={control.invert ? -(value as number) : (value as number)}
                    onChange={(e) =>
                      set(control.invert ? -Number(e.target.value) : Number(e.target.value))
                    }
                  />
                  <span className="params__value">
                    {show(control.invert ? -(value as number) : (value as number))}
                  </span>
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
              {control.kind === 'color' && (
                <input
                  className="params__color"
                  type="color"
                  value={String(value)}
                  onChange={(e) => set(e.target.value)}
                />
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
      ))}
    </>
  )
}
