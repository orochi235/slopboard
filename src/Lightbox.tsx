import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, MouseEvent, PointerEvent } from 'react'
import { metaOf, statusOf } from '@/lightbox-meta.ts'
import { actions } from '@/actions.ts'
import { createQuietGate } from '@/nav/quiet.ts'
import { sandboxFor } from '@/lightbox-sandbox.ts'
import { mountMesh } from '@/MeshView.ts'
import { KEY_MESSAGE } from '@shared/page-keys.ts'
import {
  barsOf,
  fitView,
  isPanorama,
  isZoomed,
  openView,
  togglePanorama,
  panBy,
  toggleScale,
  zoomByWheel,
  zoomTo,
  type Size,
  type View,
} from '@/lightbox/view.ts'
import type { Reply, Take, TakeApp, TakeLink, WallItem } from '@shared/protocol.ts'
import { countOf, nextOpen, posterTake } from '@shared/runs.ts'
import './lightbox.css'

/** What a question is, wherever it hangs: on a card, or on one take of a run. */
type Asked = {
  question?: string
  choices?: string[]
  why?: string
  reply?: Reply
}

/**
 * Where an artifact says to go next: the apps the daemon can open it in, and
 * the pages the sender says it is about. Under the question, because a verdict
 * is often not the end of it — the render is wrong and the next move is the
 * source file in the app that made it.
 */
function Outs({ id, apps, links }: { id: string; apps?: TakeApp[]; links?: TakeLink[] }) {
  if (!apps?.length && !links?.length) return null
  return (
    // A click here is not the wall's: it would close the lightbox under the
    // button that was just pressed.
    <div className="lightbox__outs" onClick={(e) => e.stopPropagation()}>
      {apps?.map((app, at) => (
        <button
          type="button"
          className="lightbox__out"
          key={`${app.name}-${at}`}
          onClick={() => actions.openInApp(id, at)}
        >
          Open in {app.name}
        </button>
      ))}
      {links?.map((link) => (
        <a
          className="lightbox__out"
          key={link.url}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

/**
 * The agent's question, over whichever kind of lightbox is open.
 *
 * The chip is the submit: clicking one — or pressing its number — sends the
 * verdict with whatever is in the comment box, empty or not. Text alone cannot
 * send, which is what makes advancing through a run unambiguous. A question
 * with no choices at all is the older shape and still a text box where Enter
 * sends and Shift+Enter breaks the line.
 *
 * Once it has a reply it stays, inert, showing what it got.
 */
function Ask({
  asked,
  closing,
  count,
  onAnswer,
  onDismiss,
}: {
  asked: Asked
  closing: boolean
  /** `3/12` while a run is being reviewed; absent for a card's own question. */
  count?: string
  onAnswer: (answer: { choice?: string; text: string }) => void
  onDismiss: () => void
}) {
  const [text, setText] = useState('')
  const typed = useRef('')
  typed.current = text
  const { question, choices, reply } = asked
  const open = question !== undefined && reply === undefined

  // The number keys, which the wall would otherwise read as its own. Held off
  // a text field unless a modifier is down: a digit typed into the comment box
  // is part of the comment, so `3` lands there and ⌘3 still votes.
  useEffect(() => {
    if (!open || !choices) return
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.altKey) return
      const target = e.target as HTMLElement | null
      const typing =
        target?.isContentEditable || target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT'
      if (typing !== (e.metaKey || e.ctrlKey)) return
      if (e.key === '0') {
        e.preventDefault()
        e.stopPropagation()
        onDismiss()
        return
      }
      const at = Number(e.key) - 1
      if (!Number.isInteger(at) || at < 0 || at >= choices.length) return
      e.preventDefault()
      e.stopPropagation()
      onAnswer({ choice: choices[at]!, text: typed.current })
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, choices, onAnswer, onDismiss])

  if (question === undefined) return null
  if (reply) {
    return (
      <div className="lightbox__ask" data-closed="" data-closing={closing ? '' : undefined}>
        <p className="lightbox__question">{question}</p>
        {choices && reply.status === 'answered' ? (
          <div className="lightbox__answers">
            {choices.map((choice) => (
              <span
                className="lightbox__choice"
                key={choice}
                data-chosen={choice === reply.choice ? '' : undefined}
              >
                {choice}
              </span>
            ))}
          </div>
        ) : null}
        {reply.status === 'answered' && reply.text ? (
          <p className="lightbox__reply lightbox__reply--closed">{reply.text}</p>
        ) : null}
        {reply.status !== 'answered' ? (
          <p className="lightbox__reply lightbox__reply--closed">{reply.status}</p>
        ) : (
          !choices && !reply.text && <p className="lightbox__reply lightbox__reply--closed">answered</p>
        )}
      </div>
    )
  }
  const box = choices ? asked.why : ''
  const send = () => {
    if (text.trim() !== '') onAnswer({ text })
  }
  return (
    // Neither a click nor a keystroke here is the wall's: a click would close
    // the lightbox, and `[` typed into the answer would change arrangement.
    <form
      className="lightbox__ask"
      data-closing={closing ? '' : undefined}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') e.stopPropagation()
      }}
      onSubmit={(e) => {
        e.preventDefault()
        send()
      }}
    >
      {count && <span className="lightbox__count">{count}</span>}
      <p className="lightbox__question">{question}</p>
      {box !== undefined && (
        <textarea
          className="lightbox__reply"
          value={text}
          rows={2}
          placeholder={box || undefined}
          autoFocus={!choices}
          aria-label={choices ? 'Comment' : 'Answer'}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') return e.currentTarget.blur()
            if (e.key === 'Enter' && !e.shiftKey && !choices) {
              e.preventDefault()
              send()
            }
          }}
        />
      )}
      <div className="lightbox__answers">
        {choices ? (
          choices.map((choice, at) => (
            <button
              type="button"
              className="lightbox__choice"
              key={choice}
              onClick={() => onAnswer({ choice, text })}
            >
              {choice}
              {at < 9 && <span className="lightbox__key">{at + 1}</span>}
            </button>
          ))
        ) : (
          <button type="submit" className="lightbox__choice" disabled={text.trim() === ''}>
            send
          </button>
        )}
        {/* Set off from the chips: dropping one without a verdict is not one of
            the outcomes, so it is not a key among them either. */}
        <button type="button" className="lightbox__skip" onClick={onDismiss}>
          dismiss
          {choices && <span className="lightbox__key">0</span>}
        </button>
      </div>
    </form>
  )
}

const portOf = (): Size => ({ w: window.innerWidth, h: window.innerHeight })

/** Below this a pointer press is a click, above it a pan. Matches the wall's
 *  own slop, so a hand that is steady enough to pick a card there is steady
 *  enough to pick one here. */
const DRAG_SLOP_PX = 4

/**
 * A DOM overlay, not a GL quad: full resolution costs the texture budget
 * nothing here, and right-click-save, copy and drag-to-Finder keep working.
 *
 * The viewport under the image is the size of the window, because it is what
 * the pan is held inside — but that means it also covers the scrim, so closing
 * on a click outside the picture is its job rather than the backdrop's.
 */
function ImageLightbox({
  item,
  now,
  quietMs,
  closing,
  onClose,
}: {
  item: WallItem
  now: number
  quietMs: number
  closing: boolean
  onClose: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [image, setImage] = useState<Size>({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  /** Set by a discrete zoom — a key or a double-click — and cleared by anything
   *  continuous. Easing a wheel or a drag makes it lag the hand instead. */
  const [eased, setEased] = useState(false)
  const port = useRef<HTMLDivElement>(null)
  const img = useRef<HTMLImageElement>(null)
  /** The window size the current view was computed against. Read by the resize
   *  handler, which has to know whether the image was fitted before it moved. */
  const size = useRef<Size>(portOf())
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  /** False until the wheel stream has gone quiet once. The flick that opened
   *  this image is still arriving, and it has already been paid for. */
  const armed = useRef(false)
  /** The live view and the live `onClose`, for the wheel handler: it is bound
   *  once per image, and rebinding it per render would rebuild the quiet gate
   *  under a stream it is in the middle of reading. */
  const viewRef = useRef(view)
  viewRef.current = view
  const close = useRef(onClose)
  close.current = onClose

  // The id changes when the viewer moves between images without closing. The
  // view goes back to fit with it: paging a pile is no way to land inside the
  // corner of the next card.
  useEffect(() => {
    setLoaded(false)
    setImage({ w: 0, h: 0 })
    setView({ scale: 1, x: 0, y: 0 })
    armed.current = false
  }, [item.id])

  // The wheel is the lightbox's while the lightbox holds focus, and the wall's
  // otherwise — the browser's own arbitration rather than a mode of our own.
  // Not React's `onWheel`, which is attached passive at the root and cannot
  // call `preventDefault`. Stopping it here is also what keeps it from reaching
  // the wall's window listener, which would otherwise step out a rung under us.
  useEffect(() => {
    const el = port.current
    if (!el) return
    // `timeStamp` on a wheel event and `performance.now()` share the document's
    // time origin, so this effect's own start is a gap the tail cannot open.
    const gate = createQuietGate(quietMs, performance.now())
    const onWheel = (e: WheelEvent) => {
      if (!el.contains(document.activeElement)) return
      e.preventDefault()
      // Swallowed even while disarmed, or the tail reaches the wall's window
      // listener and steps a rung back out from under the image that opened.
      e.stopPropagation()
      const fresh = gate.feed(e.timeStamp)
      if (fresh) armed.current = true
      if (!armed.current) return
      setEased(false)
      // A pinch arrives as a wheel with `ctrlKey` set, so the modifier is the
      // zoom gesture on a trackpad as well as under a key.
      if (e.ctrlKey || e.metaKey) {
        setView((v) => zoomByWheel(v, e.deltaY, { x: e.clientX, y: e.clientY }, image, size.current))
        return
      }
      // Scroll moves the image while any of it is off screen — the window
      // panning over the picture, so the direction matches the bars and every
      // other scrollable thing.
      const bars = barsOf(viewRef.current, image, size.current)
      if (bars.x || bars.y) {
        setView((v) => panBy(v, -e.deltaX, -e.deltaY, image, size.current))
        return
      }
      // Whole on screen, there is nothing left to scroll, so an out-gesture
      // spends itself on the rung instead and the image closes — the inverse of
      // the flick that opened it. A fresh gesture only: a roll that pans to the
      // last edge stops there rather than carrying on out of the lightbox in
      // the same movement.
      if (fresh && e.deltaY > 0) close.current()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [image, quietMs])

  // The window is the viewport, so its size is half of every sum here. An image
  // that was fitted stays fitted; one that was zoomed keeps its scale and is
  // pulled back inside the new edges.
  useEffect(() => {
    const onResize = () => {
      const was = size.current
      const next = portOf()
      size.current = next
      setView((v) =>
        isZoomed(v, image, was)
          ? panBy(v, 0, 0, image, next)
          : // `openView`, not `fitView`: a panorama that was filled is at a
            // scale `isZoomed` reads as zoomed, so this arm only ever has an
            // image that was showing whole — and a panorama resized into a
            // window it now fits should still open filled rather than as a
            // sliver of the new one.
            openView(image, next),
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [image])

  const onLoad = useCallback(() => {
    const el = img.current
    if (!el) return
    const natural = { w: el.naturalWidth, h: el.naturalHeight }
    size.current = portOf()
    setImage(natural)
    setView(openView(natural, size.current))
    setLoaded(true)
    // A visible element can take focus, and until the first paint this one is
    // still transparent. Focus is what decides the wheel is ours.
    port.current?.focus()
  }, [])

  const zoomed = isZoomed(view, image, size.current)
  // How much of the image is off screen, per axis. Null on an axis that fits.
  const bars = barsOf(view, image, size.current)

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
    port.current?.focus()
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const from = drag.current
    // Only once zoomed. At fit the image is left alone so that dragging it to
    // Finder and saving it from the browser's own menu keep working, which is
    // the state every artifact opens in.
    if (!from || !zoomed) return
    const dx = e.clientX - from.x
    const dy = e.clientY - from.y
    if (!from.moved && Math.hypot(dx, dy) < DRAG_SLOP_PX) return
    if (!from.moved) port.current?.setPointerCapture(e.pointerId)
    from.moved = true
    from.x = e.clientX
    from.y = e.clientY
    setEased(false)
    setView((v) => panBy(v, dx, dy, image, size.current))
  }

  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    if (port.current?.hasPointerCapture(e.pointerId))
      port.current.releasePointerCapture(e.pointerId)
    // Held until the click that follows has been judged, and cleared by it.
    if (drag.current && !drag.current.moved) drag.current = null
  }

  // The viewport covers the scrim, so the click that lands beside the picture
  // lands here. A pan that ends outside the image must not read as one.
  const onClick = (e: MouseEvent<HTMLDivElement>) => {
    const panned = drag.current?.moved ?? false
    drag.current = null
    if (panned || e.target === img.current) return
    onClose()
  }

  const at = (e: { clientX: number; clientY: number }) => ({ x: e.clientX, y: e.clientY })
  /** The anchor for a zoom nobody pointed at — the middle of the window, so a
   *  toggle from the meta row keeps the middle of the picture in the middle. */
  const center = () => ({ x: size.current.w / 2, y: size.current.h / 2 })

  const onDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    setEased(true)
    setView((v) => zoomTo(v, toggleScale(v, image, size.current), at(e), image, size.current))
  }

  // Arrows and Escape are deliberately not here: they belong to the wall, which
  // pages the pile and closes the lightbox with them from its own listener.
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const middle = { x: size.current.w / 2, y: size.current.h / 2 }
    const step = (by: number) =>
      setView((v) => zoomTo(v, v.scale * by, middle, image, size.current))
    if (e.key === '0') {
      e.preventDefault()
      setEased(true)
      return setView(fitView(image, size.current))
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault()
      setEased(true)
      return step(1.25)
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault()
      setEased(true)
      return step(1 / 1.25)
    }
  }

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Full resolution image"
      data-closing={closing ? '' : undefined}
    >
      <div
        className="lightbox__port"
        ref={port}
        tabIndex={0}
        data-zoomed={zoomed ? '' : undefined}
        data-eased={eased ? '' : undefined}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={onClick}
        onDoubleClick={onDoubleClick}
        onKeyDown={onKeyDown}
        style={{
          // Numbers, not rules: the transform itself is in the stylesheet. A
          // pan and a zoom change every frame and cannot be a class.
          '--lb-scale': view.scale,
          '--lb-x': `${view.x}px`,
          '--lb-y': `${view.y}px`,
          '--lb-w': `${image.w}px`,
          '--lb-h': `${image.h}px`,
        } as CSSProperties}
      >
        <img
          className={`lightbox__img ${loaded ? 'lightbox__img--in' : ''}`}
          ref={img}
          src={`/orig/${item.id}`}
          alt=""
          // Suppressed only once the drag means a pan; at fit the native drag
          // to Finder is the more useful of the two.
          draggable={!zoomed}
          data-sharp={view.scale > 2 ? '' : undefined}
          onLoad={onLoad}
        />
        {/* What a scrollbar says and nothing it does: the image is placed by a
            transform, so there is no scroll offset for a real one to ride on.
            Drag, scroll and the keys are how it moves. */}
        {bars.x && (
          <div
            className="lightbox__bar lightbox__bar--x"
            aria-hidden="true"
            style={{ '--lb-bar': bars.x.size, '--lb-bar-at': bars.x.at } as CSSProperties}
          />
        )}
        {bars.y && (
          <div
            className="lightbox__bar lightbox__bar--y"
            aria-hidden="true"
            style={{ '--lb-bar': bars.y.size, '--lb-bar-at': bars.y.at } as CSSProperties}
          />
        )}
      </div>

      {/* Above the image, where the caption cannot go: what this is and how
          long it has left is context for the picture, not part of it. */}
      <div className="lightbox__meta">
        {statusOf(item).map((part) => (
          <span className="lightbox__metaPart lightbox__status" key={part}>
            {part}
          </span>
        ))}
        {metaOf(item, now).map((part) => (
          <span className="lightbox__metaPart" key={part}>
            {part}
          </span>
        ))}
        {/* Only where fitting makes a sliver. A panorama opens filled and this
            is the way to the whole of it; every other image is already whole,
            and a button offering to shrink it would mean nothing. */}
        {loaded && isPanorama(image, size.current) && (
          <button
            type="button"
            className="lightbox__metaPart lightbox__metaButton"
            onClick={() =>
              setView((v) =>
                zoomTo(v, togglePanorama(v, image, size.current), center(), image, size.current),
              )
            }
          >
            {isZoomed(view, image, size.current) ? 'whole' : 'fill'}
          </button>
        )}
        {/* Last in the row: it changes on every wheel notch, and anything after
            a readout that changes width is a control that shifts under the
            hand. */}
        {zoomed && (
          <span className="lightbox__metaPart lightbox__zoom">
            {Math.round(view.scale * 100)}%
          </span>
        )}
      </div>
      {item.name && <figcaption className="lightbox__caption">{item.name}</figcaption>}
    </div>
  )
}

/**
 * A page runs rather than being drawn: the same `/orig` an image lightbox
 * loads into an `<img>` is an HTML file here, so the frame shows the artifact
 * itself, live.
 *
 * None of the image path's pan, zoom, drag or resize state means anything for
 * a frame that scrolls itself, which is why this is a separate component and
 * not a branch inside one — a branch above those hooks would change the hook
 * count when the arrows page from an image to a page on the same element.
 */
function PageLightbox({
  item,
  now,
  closing,
  onClose,
}: {
  item: WallItem
  now: number
  closing: boolean
  onClose: () => void
}) {
  const sandbox = sandboxFor(item.sandbox)
  const root = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  // The wall navigates on a `window` wheel listener. A wheel inside a
  // same-origin frame never leaves it, but one over the margin around the
  // frame would, and the wall would step out a rung under the page.
  useEffect(() => {
    const el = root.current
    if (!el) return
    const onWheel = (e: WheelEvent) => e.stopPropagation()
    el.addEventListener('wheel', onWheel)
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // The keys the page hands back, replayed where the wall already listens for
  // them. The frame is an opaque origin, so `event.origin` is "null" for every
  // page alike and the frame's own window is the only thing worth checking.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return
      const data = e.data as { type?: string; key?: string; shiftKey?: boolean } | null
      if (data?.type !== KEY_MESSAGE || !data.key) return
      window.dispatchEvent(
        new KeyboardEvent('keydown', { key: data.key, shiftKey: !!data.shiftKey, bubbles: true }),
      )
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  return (
    <div
      className="lightbox"
      ref={root}
      role="dialog"
      aria-modal="true"
      aria-label="Page"
      data-closing={closing ? '' : undefined}
      // Every part of the surround, not just the margin: a click inside the
      // frame is delivered to the page's own document and never arrives here,
      // so anything that does arrive landed beside the page.
      onClick={(e) => {
        if (e.target !== frame.current) onClose()
      }}
    >
      <iframe
        className="lightbox__page"
        ref={frame}
        src={`/page/${item.id}`}
        title={item.name || 'page'}
        {...(sandbox === null ? {} : { sandbox })}
      />

      {/* The wall's Escape is a `window` listener, and a keystroke inside an
          opaque-origin frame never reaches it. Once the pointer is in the
          page this is the only way out that is visible. */}
      <button type="button" className="lightbox__close" onClick={onClose}>
        ✕ close
      </button>

      <div className="lightbox__meta">
        {statusOf(item).map((part) => (
          <span className="lightbox__metaPart lightbox__status" key={part}>
            {part}
          </span>
        ))}
        {metaOf(item, now).map((part) => (
          <span className="lightbox__metaPart" key={part}>
            {part}
          </span>
        ))}
      </div>
      {item.name && <figcaption className="lightbox__caption">{item.name}</figcaption>}
    </div>
  )
}

/**
 * A video plays rather than being drawn: `/orig` hands the file to a `<video>`,
 * which is why the wall holds only containers the browser can play.
 *
 * Separate for the same reason `PageLightbox` is — the image path's pan, zoom
 * and drag state means nothing for native video controls, and a branch above
 * those hooks would change the hook count when the arrows page from a picture
 * to a video on the same element.
 */
/** How tall the browser's own video controls stand at the foot of the element.
 *  Chrome draws about forty; the few extra keep a press aimed at the scrubber
 *  from landing on the picture instead. */
const CONTROLS_BAND = 48

function VideoLightbox({
  item,
  now,
  closing,
  onClose,
}: {
  item: WallItem
  now: number
  closing: boolean
  onClose: () => void
}) {
  const video = useRef<HTMLVideoElement>(null)
  // Muted on every mount, never remembered: a side monitor that makes noise
  // because of something you did yesterday is the failure this avoids. It is
  // also what keeps Chrome's autoplay policy from ever blocking the play, so
  // there is no case where the video sits on its first frame waiting for a
  // second click.
  const [muted, setMuted] = useState(true)
  // Off unless asked for. A render is usually a few seconds and a wall that
  // repeats one forever is a wall that will not let it finish — the loop is
  // worth having for a cycle somebody wants to watch twice, not by default.
  const [looping, setLooping] = useState(false)
  /** Whether the press this click ends began on the picture rather than on the
   *  control strip. See the handlers below. */
  const onPicture = useRef(false)

  // Space, ahead of the wall's own handler, which reads it as "go in" and
  // takes it before a focused video ever sees it. Bound to the window rather
  // than the element for the same reason the element is left unfocused: the
  // arrows belong to the pile, so the video never holds focus to receive a
  // key through it.
  useEffect(() => {
    // `KeyboardEvent` is React's in this file, so the DOM one is named.
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== ' ' || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      // Typing a space is typing a space — a question's answer box is open on
      // the same card.
      if (target?.isContentEditable) return
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) return
      const el = video.current
      if (!el) return
      e.preventDefault()
      e.stopPropagation()
      if (el.paused) void el.play()
      else el.pause()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Video"
      data-closing={closing ? '' : undefined}
      // The margin around the video, and nothing the viewer is aiming at: a
      // click on the element itself is either the controls or a play toggle.
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <video
        className="lightbox__video"
        ref={video}
        src={`/orig/${item.id}`}
        muted={muted}
        autoPlay
        loop={looping}
        playsInline
        controls
        // A click on the picture stops and starts it, the way a click on a
        // video anywhere else does. The native control strip is drawn inside
        // this same element and reports its clicks as the element's, so there
        // is no target to tell them apart by — the bottom band is left to the
        // controls by measure instead, or every press on play would arrive
        // here as well and undo itself.
        onPointerDown={(e) => {
          onPicture.current =
            e.clientY <= e.currentTarget.getBoundingClientRect().bottom - CONTROLS_BAND
        }}
        onClick={(e) => {
          const el = e.currentTarget
          // Both ends of the press, because a scrub dragged up out of the
          // strip releases over the picture and its click would otherwise
          // pause whatever the viewer just finished seeking to.
          if (!onPicture.current) return
          if (e.clientY > el.getBoundingClientRect().bottom - CONTROLS_BAND) return
          if (el.paused) void el.play()
          else el.pause()
        }}
        // Left unfocused on purpose: the wall's arrows page the pile, and a
        // focused video would take them for a seek before they got there.
        // Clicking it is how a viewer asks for that trade.
        tabIndex={-1}
      />

      <div className="lightbox__meta">
        {statusOf(item).map((part) => (
          <span className="lightbox__metaPart lightbox__status" key={part}>
            {part}
          </span>
        ))}
        {metaOf(item, now).map((part) => (
          <span className="lightbox__metaPart" key={part}>
            {part}
          </span>
        ))}
        <button
          type="button"
          className="lightbox__metaPart lightbox__metaButton"
          onClick={() => setMuted((m) => !m)}
        >
          {muted ? 'unmute' : 'mute'}
        </button>
        <button
          type="button"
          className="lightbox__metaPart lightbox__metaButton"
          aria-pressed={looping}
          onClick={() => setLooping((on) => !on)}
        >
          {looping ? 'once' : 'loop'}
        </button>
        {/* The browser cannot call `open`, so the daemon does. Worth having for
            anything long enough to want a real player's scrubbing and PiP. */}
        <button
          type="button"
          className="lightbox__metaPart lightbox__metaButton"
          onClick={() => actions.openInApp(item.id)}
        >
          open in app
        </button>
      </div>
      {item.name && <figcaption className="lightbox__caption">{item.name}</figcaption>}
    </div>
  )
}

/**
 * A mesh is the one artifact the lightbox draws rather than hands to the
 * browser: `/orig` serves the model and three turns it, framed and lit as the
 * card's poster was.
 *
 * Separate for the same reason `VideoLightbox` is — the image path's pan, zoom
 * and drag state means nothing for an orbit, and a branch above those hooks
 * would change the hook count when the arrows page from a picture to a mesh on
 * the same element.
 */
function MeshLightbox({
  item,
  now,
  closing,
  onClose,
}: {
  item: WallItem
  now: number
  closing: boolean
  onClose: () => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const [failed, setFailed] = useState<string | null>(null)

  useEffect(() => {
    const el = host.current
    if (!el) return
    const view = mountMesh(el, item.origUrl, {
      stl: /\.stl$/i.test(item.path),
      onError: setFailed,
    })
    return () => view.dispose()
  }, [item.origUrl, item.path])

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="Model"
      data-closing={closing ? '' : undefined}
      // The surround closes it; a press that lands on the canvas is an orbit.
      onClick={(e) => {
        if (e.target !== host.current?.firstChild) onClose()
      }}
    >
      <div className="lightbox__mesh" ref={host} />
      {failed && <p className="lightbox__meshFailed">this model {failed}</p>}

      <div className="lightbox__meta">
        {statusOf(item).map((part) => (
          <span className="lightbox__metaPart lightbox__status" key={part}>
            {part}
          </span>
        ))}
        {metaOf(item, now).map((part) => (
          <span className="lightbox__metaPart" key={part}>
            {part}
          </span>
        ))}
        {/* What the card cannot say: this one is turnable. */}
        <span className="lightbox__metaPart">drag to turn</span>
        <button
          type="button"
          className="lightbox__metaPart lightbox__metaButton"
          onClick={() => actions.openInApp(item.id)}
        >
          open in app
        </button>
      </div>
      {item.name && <figcaption className="lightbox__caption">{item.name}</figcaption>}
    </div>
  )
}

/** One take drawn as the picture it is: the run's own fields, with the take's
 *  pixels and its own name, and its question left to `Ask` to draw. */
function takeItem(item: WallItem, take: Take): WallItem {
  const { kind: _run, takes: _members, question: _q, choices: _c, reply: _r, ...card } = item
  return {
    ...card,
    id: take.id,
    url: take.url,
    origUrl: take.origUrl,
    name: take.name,
    path: take.path,
    bornAt: take.at,
    w: take.w,
    h: take.h,
    ...(take.apps ? { apps: take.apps } : {}),
    ...(take.links ? { links: take.links } : {}),
  }
}

/**
 * A run's carousel: one take at a time, paged with the arrows, each with its
 * own question. Opens on the take the card was drawing — the first unanswered —
 * so the picture the wall was asking about is the one that comes up.
 *
 * Answering advances to the next take still waiting rather than the next take,
 * which is what makes twelve verdicts twelve keystrokes.
 */
function RunLightbox({
  item,
  quietMs,
  closing,
  onAnswer,
  onDismiss,
  ...rest
}: {
  item: WallItem
  now: number
  quietMs: number
  closing: boolean
  onClose: () => void
  onAnswer: (answer: { choice?: string; text: string; take: string }) => void
  onDismiss: (take: string) => void
}) {
  const takes = item.takes ?? []
  const [atId, setAtId] = useState(() => posterTake(takes)?.id)
  const found = takes.findIndex((t) => t.id === atId)
  const at = found === -1 ? 0 : found
  const take = takes[at]
  const go = useCallback(
    (by: number) => {
      const next = takes[Math.min(takes.length - 1, Math.max(0, at + by))]
      if (next) setAtId(next.id)
    },
    [takes, at],
  )

  // The arrows page the run rather than leaving the card, the same way the
  // video lightbox claims the space bar: a capture listener, so the wall's own
  // handler never sees the key.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (target?.isContentEditable || target?.tagName === 'TEXTAREA' || target?.tagName === 'INPUT')
        return
      const by = e.key === 'ArrowLeft' || e.key === 'PageUp' ? -1 : e.key === 'ArrowRight' || e.key === 'PageDown' ? 1 : 0
      if (by === 0) return
      e.preventDefault()
      e.stopPropagation()
      go(by)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [go])

  if (!take) return null
  const answer = (answer: { choice?: string; text: string }) => {
    onAnswer({ ...answer, take: take.id })
    // Advanced from what the run will look like once this reply lands, since it
    // has not yet: the take just answered is otherwise still the first open one.
    const closed = takes.map((t) =>
      t.id === take.id ? { ...t, reply: { status: 'answered' as const, text: '', at: Date.now() } } : t,
    )
    const next = nextOpen(closed, take.id)
    if (next) setAtId(next.id)
  }
  return (
    <>
      {/* Keyed, so paging the carousel remounts the picture rather than
          leaving the previous take's zoom and pan over the next one. */}
      <ImageLightbox
        key={take.id}
        {...rest}
        item={takeItem(item, take)}
        closing={closing}
        quietMs={quietMs}
      />
      <Ask
        key={take.id}
        asked={take}
        closing={closing}
        count={countOf(item, at)}
        onAnswer={answer}
        onDismiss={() => {
          onDismiss(take.id)
          const closed = takes.map((t) =>
            t.id === take.id ? { ...t, reply: { status: 'dismissed' as const, text: '', at: Date.now() } } : t,
          )
          const next = nextOpen(closed, take.id)
          if (next) setAtId(next.id)
        }}
      />
      <Outs id={take.id} apps={take.apps} links={take.links} />
      {at > 0 && (
        <button
          type="button"
          className="lightbox__page lightbox__page--prev"
          aria-label="Previous take"
          onClick={(e) => {
            e.stopPropagation()
            go(-1)
          }}
        />
      )}
      {at < takes.length - 1 && (
        <button
          type="button"
          className="lightbox__page lightbox__page--next"
          aria-label="Next take"
          onClick={(e) => {
            e.stopPropagation()
            go(1)
          }}
        />
      )}
    </>
  )
}

/**
 * A DOM overlay either way, not a GL quad: full resolution costs the texture
 * budget nothing here, and right-click-save, copy and drag-to-Finder keep
 * working for a picture.
 *
 * One component per kind rather than one with a branch, so that paging a pile
 * across kinds unmounts one and mounts the other — which is also what stops an
 * iframe, or a playing video, surviving a move to the next artifact.
 */
export function Lightbox(props: {
  item: WallItem
  /** The zone's lifted project color. Absent for a zone with no `.hued`, which
   *  keeps the wall's own accent. */
  tint?: string
  now: number
  quietMs: number
  /** Playing its way out, after a reply. The caller unmounts it once done. */
  closing: boolean
  onClose: () => void
  onAnswer: (id: string, answer: { choice?: string; text: string; take?: string }) => void
  onDismiss: (id: string, take?: string) => void
}) {
  const { quietMs, onAnswer, onDismiss, closing, tint, ...rest } = props
  return (
    // One property for the lot: the frame, the keyline and the glow all read
    // it, and each falls back to the wall's accent where a zone has no color.
    <div
      className="lightbox__tint"
      style={tint ? ({ '--lb-accent': tint } as CSSProperties) : undefined}
    >
      {rest.item.kind === 'run' ? (
        // Keyed on the card, so opening another run starts on its own poster
        // rather than wherever the last one was left.
        <RunLightbox
          key={rest.item.id}
          {...rest}
          closing={closing}
          quietMs={quietMs}
          onAnswer={(answer) => onAnswer(rest.item.id, answer)}
          onDismiss={(take) => onDismiss(rest.item.id, take)}
        />
      ) : (
        <>
          {rest.item.kind === 'page' ? (
            <PageLightbox {...rest} closing={closing} />
          ) : rest.item.kind === 'mesh' ? (
            // Keyed like the video, so paging from one model to the next builds
            // a new scene rather than leaving the first one's geometry in it.
            <MeshLightbox key={rest.item.id} {...rest} closing={closing} />
          ) : rest.item.kind === 'video' ? (
            // Keyed, so paging from one video to the next remounts rather than
            // reusing: the mute is mount state, and without this the second
            // video inherits the first one's unmute and the wall makes a noise
            // nobody asked it for.
            <VideoLightbox key={rest.item.id} {...rest} closing={closing} />
          ) : (
            <ImageLightbox {...rest} closing={closing} quietMs={quietMs} />
          )}
          <Ask
            asked={rest.item}
            closing={closing}
            onAnswer={(answer) => onAnswer(rest.item.id, answer)}
            onDismiss={() => onDismiss(rest.item.id)}
          />
          <Outs id={rest.item.id} apps={rest.item.apps} links={rest.item.links} />
        </>
      )}
    </div>
  )
}
