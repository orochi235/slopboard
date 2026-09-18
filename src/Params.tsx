import { useRef, useState } from 'react'
import {
  CheckboxRow,
  ColorRow,
  NumberRow,
  PropertyList,
  PropertyRow,
  SelectRow,
  Slider,
} from '@weasel-js/ui'
import { controlsOf, formatStepped } from '@/params.controls.ts'
import { groupControls } from '@/params.groups.ts'
import { categoryOf } from '@/params.tabs.ts'
import { leafAt, setAt } from '@/params.paths.ts'
import { defaultParams, type StackParams } from '@/params.ts'
import { splitUnit } from '@/params.units.ts'
import { fromText, toText } from '@/params.transfer.ts'
import './params.css'

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
  only,
}: {
  params: StackParams
  onChange: (next: StackParams) => void
  /** Every group open. The corner panel is a column beside the wall and stays
   *  folded; the modal has the room, and folded groups waste it. */
  expanded?: boolean
  /** One area of the wall, every group in it open, and nothing else. The
   *  prefs sheet's tabs. */
  only?: string
}) {
  const groups = groupControls(
    controlsOf(params).filter((control) => only === undefined || categoryOf(control.path) === only),
  )
  return (
    <>
      <Transfer params={params} onChange={onChange} />
      {groups.map((group) => (
        <details
          className="params__group wzl-skin"
          key={group.name}
          // Where this body is delaminated, the cards are the layer the eye is
          // actually on, and a tied sibling sits a quarter-step off its
          // backing — under a pixel of travel. Inert outside a stage.
          data-dl-lift="3"
          open={expanded || only !== undefined || group.name === 'wall'}
        >
          <summary className="params__groupName">{group.name}</summary>
          <PropertyList>
            {group.controls.map((control) => {
              const value = leafAt(params, control.path) ?? 0
              const set = (next: number | string | boolean) =>
                onChange(setAt(params, control.path, next))
              const leaf = control.path.startsWith(`${group.name}.`)
                ? control.path.slice(group.name.length + 1)
                : control.path
              const { label, unit } = splitUnit(leaf)
              // The kit takes a symbol unit as JSX so the browser raises it.
              const unitNode = unit === '°' ? <sup>{unit}</sup> : unit

              switch (control.kind) {
                case 'slider': {
                  // Stored negative and read as a magnitude — see INVERTED in
                  // params.controls.ts. The sign never reaches the control.
                  const shown = control.invert ? -(value as number) : (value as number)
                  return (
                    // `PropertyRow` around a bare `Slider` rather than
                    // `SliderRow`: the row puts its readout up beside the
                    // label, and the readout belongs after the track it reads.
                    <PropertyRow key={control.path} label={label} layout="inline">
                      <Slider
                        className="params__slider"
                        thumbs={[{ value: shown }]}
                        min={control.min}
                        max={control.max}
                        step={control.step}
                        density="slim"
                        readoutPlacement="inline-after"
                        renderReadout={(thumb) => (
                          <>
                            {formatStepped(thumb.value, control.step)}
                            {unitNode && <span className="params__unit">{unitNode}</span>}
                          </>
                        )}
                        ariaLabel={label}
                        onInput={(next) => {
                          const v = next[0]?.value
                          if (v !== undefined) set(control.invert ? -v : v)
                        }}
                      />
                    </PropertyRow>
                  )
                }
                case 'choice':
                  return (
                    <SelectRow
                      key={control.path}
                      label={label}
                      layout="inline"
                      value={String(value)}
                      options={control.options.map((option) => ({
                        value: String(option),
                        label: String(option),
                      }))}
                      onChange={(raw) => {
                        const n = Number(raw)
                        set(raw !== '' && Number.isFinite(n) ? n : raw)
                      }}
                    />
                  )
                case 'color':
                  return (
                    <ColorRow key={control.path} label={label} value={String(value)} onChange={set} />
                  )
                case 'toggle':
                  return (
                    <CheckboxRow
                      key={control.path}
                      label={label}
                      value={value === true}
                      onChange={set}
                    />
                  )
                case 'number':
                  return (
                    <NumberRow
                      key={control.path}
                      label={label}
                      layout="inline"
                      unit={unitNode}
                      value={value as number}
                      onChange={(next) => {
                        if (Number.isFinite(next)) set(next)
                      }}
                    />
                  )
              }
            })}
          </PropertyList>
        </details>
      ))}
    </>
  )
}
