import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { Arrangement, SlopChannels } from '@/arrangements/index.ts'
import { framePose, type Pose } from '@/camera/frame.ts'
import { type Move, poseAt } from '@/camera/move.ts'
import { orbitOffset } from '@/camera/orbit.ts'
import { Lightbox } from '@/Lightbox.tsx'
import { CardMenu, type MenuAt } from '@/menu/CardMenu.tsx'
import { targetOf, type Action } from '@/menu/items.ts'
import { Sidebar } from '@/Sidebar.tsx'
import { TopBar } from '@/TopBar.tsx'
import { keptBy, type Range } from '@/nav/time-filter.ts'
import { fakeFlags, type FakeFlag } from '@/debug-flags.ts'
import { Sky } from '@/backends/Sky.tsx'
import { ZoneOverlay } from '@/backends/ZoneOverlay.tsx'
import { toStackItems } from '@/model.ts'
import { Minimap, type Plan } from '@/nav/Minimap.tsx'
import { Axes } from '@/nav/Axes.tsx'
import { createLoop, loopPositions, setResolution } from '@/backends/fatLines.ts'
import { CHROME_ORDER } from '@/backends/order.ts'
import { badgeTexture } from '@/textures/badge.ts'
import { loadFaces, stackFor } from '@/typeface.ts'
import { LEVELS, type Level } from '@shared/attention.ts'
import type { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { createGestureRail } from '@/nav/gesture.ts'
import { directionFor, isForAControl } from '@/nav/keys.ts'
import { neighbourOf } from '@/nav/neighbour.ts'
import { zoneAt } from '@/nav/pick.ts'
import { choose, makeGrid, mark, score, type Box } from '@/nav/whitespace.ts'
import { stepFromDrag } from '@/nav/step-drag.ts'
import { stepToward } from '@/nav/step.ts'
import { baseCellsOf, unionOf, withHeadroom, zoneCellsOf } from '@/nav/zone-cells.ts'
import type { StackParams } from '@/params.ts'
import { createTextureManager } from '@/textures/manager.ts'
import { loadBitmap } from '@/textures/source.ts'
import {
  cardOf,
  depthOf,
  reduceView,
  type ViewAction,
  type ViewState,
  WALL,
  zoneOf,
} from '@/view-state.ts'
import type { WallItem } from '@shared/protocol.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement
  ttlMs: number
  clockOffset: number
  params: StackParams
  onParams: Dispatch<SetStateAction<StackParams>>
  /** Published by the daemon: a zone's project colour, where it has a `.hued`. */
  zoneColors: Record<string, string>
}

type WallProps = Props & {
  view: ViewState
  dispatch: Dispatch<ViewAction>
  onPlan: (plan: Plan) => void
  /** A right-click, already resolved to what it was over. The pick lives in
   *  here with the raycaster; the menu is DOM and lives outside the canvas. */
  onMenu: (at: MenuAt) => void
  /** Excluded by the band's filters. Still drawn, still in rank — faded, so
   *  what was cut stays legible against what was kept. */
  dimmed: ReadonlySet<string>
}

/** The plan view is a diagram, not an animation: republishing it a few times a
 *  second keeps React out of the frame loop. */
const PLAN_MS = 250

/** How far the scene turns per pixel dragged. */
const DEG_PER_PX = 0.25

/** Clear of its own card, so the plate never z-fights the border it sits on. */
const BADGE_LIFT = 0.002

/** Movement past this is an orbit; anything less is the click it looks like. */
const DRAG_SLOP_PX = 4

/** `PointerEvent.button` for the wheel pressed as a button. */
const MIDDLE_BUTTON = 1

/** The corners of a unit quad, for turning a plane into a screen rectangle. */
const CORNERS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const

/** Where a plate is willing to look, in its own card's plane. Up first, so a
 *  tie on an empty wall reads the way the welded badge did. */
const SEEK_DIRS = [
  [0, 1],
  [-1, 1],
  [1, 1],
  [1, 0],
  [-1, 0],
  [-1, -1],
  [1, -1],
  [0, -1],
] as const

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** The framing slack for a rung, the last entry serving every rung past it. */
const marginFor = (margins: readonly number[], depth: number) =>
  margins[Math.min(depth, margins.length - 1)] ?? 1

/** One quad per item. Ranks past the fade get no texture and draw flat. */
function Wall({
  items,
  arrangement,
  ttlMs,
  clockOffset,
  params,
  onParams,
  zoneColors,
  view,
  dispatch,
  onPlan,
  onMenu,
  dimmed,
}: WallProps) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl, camera } = useThree()
  const cardEdges = params.overlay.cardEdges
  const cardEdgeColor = params.colors.cardEdge
  const labelFamily = stackFor(params.typeface.label)
  const badgeFamily = stackFor(params.typeface.badge)
  // Canvas text falls back silently for a face the document has not finished
  // loading, so everything drawn to a canvas is rebuilt once they are in.
  const [fontsReady, setFontsReady] = useState(false)
  useEffect(() => {
    let live = true
    void loadFaces().then(() => live && setFontsReady(true))
    return () => {
      live = false
    }
  }, [])

  const levelColors: Record<Level, string> = {
    look: params.colors.attentionLook,
    soon: params.colors.attentionSoon,
    urgent: params.colors.attentionUrgent,
    problem: params.colors.attentionProblem,
  }
  // Which artifacts are asking, and what their badges say. Off the items
  // rather than the channels: a level is a name and a note is a sentence,
  // and `SlopChannels` carries numbers.
  const flagged = useMemo(() => {
    const out = new Map<string, { level: Level; note?: string }>()
    for (const i of items) {
      if (!i.attention) continue
      out.set(i.id, { level: i.attention.level, ...(i.note ? { note: i.note } : {}) })
    }
    return out
  }, [items])
  const huedCardEdge = params.zones.huedCardEdge
  // Parsed once per colour rather than per card per frame.
  const huedColors = useMemo(() => {
    const out = new Map<string, THREE.Color>()
    for (const [zone, css] of Object.entries(zoneColors)) {
      try {
        out.set(zone, new THREE.Color(css))
      } catch {
        // hued allows any CSS colour name; anything three cannot read is
        // simply a zone that keeps the palette.
      }
    }
    return out
  }, [zoneColors])

  const textures = useMemo(
    () =>
      createTextureManager<THREE.Texture>({
        budgetBytes: params.lod.budgetBytes,
        urlFor: (id) => `/img/${id}`,
        load: async (url, edge) => {
          const bitmap = await loadBitmap(url, edge)
          if (!bitmap) return null
          const tex = new THREE.Texture(bitmap as unknown as HTMLImageElement)
          tex.colorSpace = THREE.SRGBColorSpace
          tex.needsUpdate = true
          return { value: tex, bytes: edge * edge * 4 }
        },
        dispose: (tex) => tex.dispose(),
      }),
    [params.lod.budgetBytes],
  )

  // A lost context invalidates every GPU handle; rebuilding from an empty store
  // is the only safe response, and the manager re-uploads next frame.
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = (e: Event) => {
      e.preventDefault()
      textures.clear()
    }
    canvas.addEventListener('webglcontextlost', onLost)
    return () => canvas.removeEventListener('webglcontextlost', onLost)
  }, [gl, textures])

  useEffect(() => () => textures.clear(), [textures])

  const geometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  useEffect(() => () => geometry.dispose(), [geometry])

  // A unit square the card mesh's own scale stretches to the drawn image, so
  // the outline needs none of the position corrections the card needed.
  // One loop per card. The unit square is stretched by the card's own scale,
  // and the width stays in screen pixels regardless — which is the point of a
  // width slider.
  const edges = useMemo(() => {
    const byId = new Map<string, ReturnType<typeof createLoop>>()
    return {
      byId,
      for(id: string) {
        let line = byId.get(id)
        if (!line) {
          line = createLoop()
          line.geometry.setPositions(loopPositions(-0.5, -0.5, 0.5, 0.5))
          byId.set(id, line)
        }
        return line
      },
    }
  }, [])
  useEffect(
    () => () => {
      for (const line of edges.byId.values()) {
        line.geometry.dispose()
        line.material.dispose()
      }
      edges.byId.clear()
    },
    [edges],
  )

  const badges = useMemo(() => {
    const quad = new THREE.PlaneGeometry(1, 1)
    const byId = new Map<string, { plate: THREE.Mesh; key: string; w: number; h: number }>()
    return {
      quad,
      byId,
      /** Rebuilt only when what it draws changes, so a per-frame call is free. */
      sync(
        id: string,
        key: string,
        text: string,
        fill: string,
        ink: string,
        font: string,
        lineHeight: number,
        maxWidth: number,
      ) {
        let held = byId.get(id)
        if (!held) {
          // A plane rather than a sprite, so the badge lies in its artifact's
          // own plane and turns with the wall. A sprite always faces the
          // camera, which peeled it off the card as soon as the scene rotated.
          const plate = new THREE.Mesh(
            quad,
            // Signage, not scenery: it composites over the wall rather than
            // sorting into it, so a nearer pile cannot bury the thing that is
            // asking to be looked at.
            new THREE.MeshBasicMaterial({
              transparent: true,
              depthTest: false,
              depthWrite: false,
              toneMapped: false,
              side: THREE.DoubleSide,
            }),
          )
          plate.renderOrder = CHROME_ORDER
          // The badge is a shortcut to its own artifact, so it takes a pick.
          plate.userData.slopId = id
          plate.userData.slopBadge = true
          held = { plate, key: '', w: 0, h: 0 }
          byId.set(id, held)
        }
        if (held.key !== key) {
          const material = held.plate.material as THREE.MeshBasicMaterial
          material.map?.dispose()
          const { texture, width, height } = badgeTexture(
            text,
            fill,
            ink,
            font,
            lineHeight,
            maxWidth,
          )
          material.map = texture
          material.needsUpdate = true
          held.key = key
          held.w = width
          held.h = height
        }
        return held
      },
    }
  }, [])
  /** One line object per level rather than one per badge: a LineMaterial has a
   *  single color, and four draw calls is cheaper than one per flag. */
  const leaders = useMemo(() => {
    const byLevel = new Map<Level, LineSegments2>()
    for (const level of LEVELS) {
      const line = createLoop()
      line.material.depthTest = false
      line.material.depthWrite = false
      line.renderOrder = CHROME_ORDER
      byLevel.set(level, line)
    }
    return byLevel
  }, [])
  useEffect(
    () => () => {
      for (const line of leaders.values()) {
        line.geometry.dispose()
        line.material.dispose()
      }
    },
    [leaders],
  )

  useEffect(
    () => () => {
      for (const { plate } of badges.byId.values()) {
        const material = plate.material as THREE.MeshBasicMaterial
        material.map?.dispose()
        material.dispose()
      }
      badges.quad.dispose()
      badges.byId.clear()
    },
    [badges],
  )

  const flaggedRef = useRef(flagged)
  flaggedRef.current = flagged
  /** The flagged artifact under the pointer, badge included. */
  const hovered = useRef<string | null>(null)

  const latest = useRef({ items, ttlMs, clockOffset })
  latest.current = { items, ttlMs, clockOffset }

  const cells = useRef<Map<string, Rect>>(new Map())
  /** Each pile's front card. The zone chrome is drawn on this rather than on
   *  the drawn union, so a tall pile does not outline more of the wall than its
   *  neighbour; the camera still frames the union, which is what is drawn. */
  const bases = useRef<Map<string, Rect>>(new Map())
  const zoneById = useRef<Map<string, string>>(new Map())
  const move = useRef<Move | null>(null)
  const pose = useRef<Pose>({ x: 0, y: 0, distance: 2, halfHeight: 0.5 })

  const [live, setLive] = useState<string[]>([])
  const liveRef = useRef<string[]>([])
  const planAt = useRef(0)
  const dragged = useRef(false)
  const [zoneNames, setZoneNames] = useState<string[]>([])
  const zoneNamesRef = useRef<string[]>([])
  /** Each pile front to back, so the arrows can page it from the lightbox. */
  const cardsByZone = useRef<Map<string, string[]>>(new Map())
  /** The deepest z each pile reaches, so its backdrop can sit behind it. */
  const viewRef = useRef(view)
  viewRef.current = view

  // Retargeted every frame rather than only on a level change: the cells are
  // not known until the first layout runs, and zones arrive and leave under a
  // camera that is already parked. A new move only starts when the target has
  // actually moved, so a steady wall is not re-eased every frame.
  const retarget = (depth: number, zone: string | null) => {
    const aspect = window.innerWidth / window.innerHeight
    // The union of what is drawn, not the nominal container: a pile's deep
    // ranks step past its cell, so framing the container crops them.
    const wall = unionOf([...cells.current.values()]) ?? { x: 0, y: 0, z: 0, w: aspect, h: 1 }
    const framed = !zone ? wall : (cells.current.get(zone) ?? wall)
    // A label hangs above its cell, so framing the cells alone crops it.
    const headroom =
      (params.zones.labels ? params.zones.labelSize * 1.6 : 0) + params.attention.badgeSize
    const box = withHeadroom(framed, headroom)
    const margin = marginFor(params.camera.margins, depth)
    const target = framePose(box, {
      projection: params.camera.projection,
      fovDeg: params.camera.fovDeg,
      standoff: params.camera.standoff,
      aspect,
      margin,
    })

    const held = move.current?.to
    const moved =
      !held ||
      Math.abs(held.x - target.x) > 1e-3 ||
      Math.abs(held.y - target.y) > 1e-3 ||
      Math.abs(held.distance - target.distance) > 1e-3 ||
      Math.abs(held.halfHeight - target.halfHeight) > 1e-3
    if (!moved) return

    move.current = {
      from: { ...pose.current },
      to: target,
      startedAt: performance.now(),
      durationMs: params.camera.moveMs,
    }
  }

  /** Set by the pick when what it hit was flagged, read and cleared by the
   *  navigate that follows it. */
  const jumpTo = useRef<readonly string[] | null>(null)
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const zeroPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 0, 1), 0), [])

  /**
   * The full path under the pointer — the pile, plus the card if one is hit.
   * A card is a mesh and a pile is not: its footprint is hit-tested against the
   * cells behind, which answers for a pile with no cards in it and needs no
   * invisible plane fighting the pile's own depth for the pick.
   */
  const chainAt = (clientX: number, clientY: number): string[] => {
    const rect = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    )

    const targets: THREE.Object3D[] = [...meshes.current.values()]
    for (const { plate } of badges.byId.values()) if (plate.visible) targets.push(plate)
    const hit = raycaster.intersectObjects(targets, false)[0]
    const id = hit?.object.userData.slopId as string | undefined
    const hitZone = id ? zoneById.current.get(id) : undefined
    if (id && hitZone) {
      // Anything wearing a flag is a shortcut, not a rung: it goes straight to
      // its artifact rather than spending the gesture descending one level.
      // The badge and the card it is welded to behave identically.
      if (hit?.object.userData.slopBadge || flaggedRef.current.has(id)) {
        jumpTo.current = [hitZone, id]
      }
      return [hitZone, id]
    }

    const point = new THREE.Vector3()
    if (!raycaster.ray.intersectPlane(zeroPlane, point)) return []
    // The renderer is the only place that undoes windease's downward y.
    const zone = zoneAt({ x: point.x, y: -point.y }, cells.current)
    return zone ? [zone] : []
  }

  /**
   * The flagged artifact under the pointer, or null. A badge counts as part of
   * its own artifact's frame — it is welded to the border, so hitting it has to
   * mean the same thing as hitting the card.
   *
   * Its own test rather than a read of `chainAt`, which answers for the whole
   * wall and would report every card on it.
   */
  const hoverAt = (clientX: number, clientY: number): string | null => {
    const flags = flaggedRef.current
    if (flags.size === 0) return null
    const targets: THREE.Object3D[] = []
    for (const [id, mesh] of meshes.current) if (flags.has(id)) targets.push(mesh)
    for (const { plate } of badges.byId.values()) if (plate.visible) targets.push(plate)
    if (targets.length === 0) return null

    const rect = gl.domElement.getBoundingClientRect()
    raycaster.setFromCamera(
      new THREE.Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      ),
      camera,
    )
    const hit = raycaster.intersectObjects(targets, false)[0]
    return (hit?.object.userData.slopId as string | undefined) ?? null
  }

  /** One rung per gesture: across if the cursor is over another branch, down
   *  otherwise. Both the click and the wheel spend themselves through here. */
  const navigate = (chain: readonly string[]) => {
    const jump = jumpTo.current
    jumpTo.current = null
    if (jump) return void dispatch({ type: 'to', path: jump })
    const next = stepToward(viewRef.current.path, chain)
    if (next) dispatch({ type: 'to', path: next })
  }

  // Held by ref so the listeners below bind once and still see this render's
  // view: rebinding a wheel listener would drop the gesture rail's charge.
  /** How many ranks back a card sits in its own pile, or null if the pointer
   *  is not over one. The divisor that turns a dragged card into a per-rank
   *  step — and the front card, at rank 0, has nothing to spread over. */
  const rankAt = (clientX: number, clientY: number): number | null => {
    const chain = chainAt(clientX, clientY)
    const zone = chain[0]
    const id = chain[1]
    if (!zone || !id) return null
    const rank = cardsByZone.current.get(zone)?.indexOf(id) ?? -1
    return rank < 0 ? null : rank
  }

  /** Where each plate has chosen to sit, as an offset in its own card's plane.
   *  Held between hunts so the plate stays put while the grid is stale. */
  const plateAt = useRef(new Map<string, { dx: number; dy: number; ring: number }>())
  /** Where each plate actually is, and how fast, as the spring drives it
   *  toward the spot above. Separate from the target so a plate that has just
   *  changed its mind travels rather than teleports. */
  const plateMotion = useRef(new Map<string, { x: number; y: number; vx: number; vy: number }>())
  const seekAt = useRef(0)
  const grid = useMemo(() => makeGrid(48, 27), [])

  /** The rank of the card under a live drag, or null. Read by the wheel. */
  const movingRank = useRef<number | null>(null)
  const stepDrag = useRef(params.nav.dragCardSetsStep)
  stepDrag.current = params.nav.dragCardSetsStep

  const act = useRef({ chainAt, navigate, hoverAt, rankAt })
  act.current = { chainAt, navigate, hoverAt, rankAt }

  // Bound to the canvas, not to a mesh, so the empty space between piles turns
  // the scene. A press that never travels is a click, and picks a rung.
  useEffect(() => {
    const el = gl.domElement
    let active = false
    let last = { x: 0, y: 0 }
    /** The card being dragged, and where the drag began. Null while the
     *  gesture is an orbit. Mirrored into a ref so the wheel listener, which
     *  is bound elsewhere, can tell a depth nudge from a rung of navigation. */
    let moving: { rank: number; from: { x: number; y: number } } | null = null
    const setMoving = (next: typeof moving) => {
      moving = next
      movingRank.current = next?.rank ?? null
    }

    const onDown = (e: PointerEvent) => {
      // The wheel button moves a pile; the left button turns the wall and
      // picks. Two buttons rather than a modifier, so neither gesture has to
      // be held down wrong to find out which one it was.
      const wheelDown = e.button === MIDDLE_BUTTON
      if (e.button !== 0 && !wheelDown) return
      if (wheelDown) {
        // Suppresses the platform's own middle-click behavior — autoscroll on
        // Windows, paste on X11 — which would otherwise fire under the drag.
        e.preventDefault()
        if (!stepDrag.current) return
        const rank = act.current.rankAt(e.clientX, e.clientY)
        if (rank === null) return
        setMoving({ rank, from: { x: e.clientX, y: e.clientY } })
      }
      active = true
      dragged.current = false
      last = { x: e.clientX, y: e.clientY }
      el.setPointerCapture(e.pointerId)
    }
    const onMove = (e: PointerEvent) => {
      if (!active) {
        // A flagged artifact is a control, so it says so under the pointer.
        // Only while idle: mid-orbit the cursor belongs to the drag.
        const over = act.current.hoverAt(e.clientX, e.clientY)
        hovered.current = over
        el.classList.toggle('scene--pointing', over !== null)
        return
      }
      const dx = e.clientX - last.x
      const dy = e.clientY - last.y
      if (!dragged.current && Math.hypot(dx, dy) < DRAG_SLOP_PX) return
      dragged.current = true
      last = { x: e.clientX, y: e.clientY }
      if (moving) {
        el.classList.add('scene--moving')
        // Against the drag's own origin rather than the last frame, so the
        // pile tracks the hand exactly instead of accumulating rounding.
        const dxTotal = e.clientX - moving.from.x
        const dyTotal = e.clientY - moving.from.y
        moving.from = { x: e.clientX, y: e.clientY }
        // The camera sees `2 * halfHeight` of world over the canvas's height,
        // whichever projection it is using.
        const worldPerPx = (pose.current.halfHeight * 2) / el.clientHeight
        onParams((p) => ({
          ...p,
          step: stepFromDrag({
            base: p.step,
            dxPx: dxTotal,
            dyPx: dyTotal,
            rank: moving!.rank,
            worldPerPx,
            yawDeg: p.camera.yawDeg,
            pitchDeg: p.camera.pitchDeg,
          }),
        }))
        return
      }
      el.classList.add('scene--turning')
      onParams((p) => ({
        ...p,
        camera: {
          ...p.camera,
          // The camera orbits opposite the drag, so the scene follows the hand.
          yawDeg: clamp(p.camera.yawDeg - dx * DEG_PER_PX, -90, 90),
          pitchDeg: clamp(p.camera.pitchDeg + dy * DEG_PER_PX, -90, 90),
        },
      }))
    }
    const onUp = (e: PointerEvent) => {
      const turned = dragged.current
      const moved = moving !== null
      active = false
      setMoving(null)
      el.classList.remove('scene--turning')
      el.classList.remove('scene--moving')
      const over = act.current.hoverAt(e.clientX, e.clientY)
      hovered.current = over
      el.classList.toggle('scene--pointing', over !== null)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (turned || moved || e.button !== 0) return
      act.current.navigate(act.current.chainAt(e.clientX, e.clientY))
    }

    // Chrome starts autoscroll from mousedown, not pointerdown, so the
    // suppression has to be on both.
    const onAux = (e: MouseEvent) => {
      if (e.button === MIDDLE_BUTTON) e.preventDefault()
    }
    // Only over the canvas: the lightbox is a real <img> so that the browser's
    // own menu can save and copy it, and taking that away would cost more than
    // the menu adds.
    const onContext = (e: MouseEvent) => {
      e.preventDefault()
      const chain = act.current.chainAt(e.clientX, e.clientY)
      onMenu({ target: targetOf(chain), x: e.clientX, y: e.clientY })
    }
    el.addEventListener('contextmenu', onContext)
    el.addEventListener('mousedown', onAux)
    el.addEventListener('auxclick', onAux)
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('contextmenu', onContext)
      el.removeEventListener('mousedown', onAux)
      el.removeEventListener('auxclick', onAux)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [gl, onParams, onMenu])

  // On the window rather than the canvas, so the gesture keeps working under
  // the lightbox, which covers it.
  useEffect(() => {
    const rail = createGestureRail(params.nav)
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.('.params, .minimap, .prefs')) return
      // A trackpad pinch is a wheel event with ctrlKey set; left alone it zooms
      // the page instead of the wall.
      e.preventDefault()
      // Mid-drag the wheel is the third axis, not a rung. A drag reaches only
      // the two axes facing the camera, and orbiting to find the third is a
      // detour when the hand is already on the pile.
      // Scrolling with the wheel button held is the third axis: a drag reaches
      // only the two facing the camera, and orbiting to find the last one is a
      // detour when the hand is already on the pile.
      const rank = movingRank.current
      if (rank !== null) {
        const notches = e.deltaY / 100
        return void onParams((p) => ({
          ...p,
          step: { ...p.step, z: p.step.z - (notches * p.nav.dragDepthPerNotch) / Math.max(1, rank) },
        }))
      }
      const step = rail.feed({ deltaY: e.deltaY, ctrlKey: e.ctrlKey }, e.timeStamp)
      if (!step) return
      if (step === 'out') dispatch({ type: 'out' })
      else act.current.navigate(act.current.chainAt(e.clientX, e.clientY))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [params.nav, dispatch, onParams])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isForAControl(e.target)) return
      if (e.key === 'Escape') return dispatch({ type: 'out' })
      const direction = directionFor(e)
      if (!direction) return
      const zone = zoneOf(viewRef.current)
      if (!zone) return

      const card = cardOf(viewRef.current)
      if (card) {
        // Inside a card the arrows page the pile it came from. Up and down have
        // no second axis here, so they stay the zone grid's.
        if (direction !== 'left' && direction !== 'right') return
        const pile = cardsByZone.current.get(zone) ?? []
        const from = pile.indexOf(card)
        // Left is toward the front of the pile, which is its newest card. The
        // ends clamp: a pile is a stack, not a carousel.
        const next = pile[direction === 'left' ? from - 1 : from + 1]
        if (from !== -1 && next) dispatch({ type: 'to', path: [zone, next] })
        return
      }

      const next = neighbourOf(cells.current, zone, direction)
      if (next) dispatch({ type: 'to', path: [next] })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])

  useFrame((_state, delta) => {
    const current = latest.current
    const now = Date.now() + current.clockOffset
    const model = toStackItems(current.items, { now, ttlMs: current.ttlMs })
    const aspects = new Map(model.map((m) => [m.id, m.aspect]))
    const zoneFor = new Map(model.map((m) => [m.id, m.zone]))
    zoneById.current = zoneFor

    const result = arrangement.strategy.layout({
      items: model,
      container: { w: window.innerWidth / window.innerHeight, h: 1 },
      state: undefined,
      options: { now },
    })

    const channels = (result.channels ?? new Map()) as Map<string, SlopChannels>
    const wantLod = new Map<string, number>()
    for (const [id, ch] of channels) wantLod.set(id, ch.lod ?? 0)
    textures.sync(wantLod)

    cells.current = zoneCellsOf(result.placements as Map<string, Rect>, zoneFor)

    bases.current = baseCellsOf(result.placements as Map<string, Rect>, zoneFor)

    const tick = performance.now()
    if (tick - planAt.current > PLAN_MS) {
      planAt.current = tick
      onPlan({
        cells: [...bases.current].map(([zone, box]) => ({ zone, box })),
        extent: unionOf([...cells.current.values()]),
      })
    }

    const names = [...cells.current.keys()]
    const sameZones =
      names.length === zoneNamesRef.current.length &&
      names.every((n, i) => zoneNamesRef.current[i] === n)
    if (!sameZones) {
      zoneNamesRef.current = names
      setZoneNames(names)
    }

    // Ordered by depth rather than by arrival: an arrangement that puts every
    // card at z 0 keeps insertion order, and the stack's ranks sort themselves.
    const ranked = new Map<string, { id: string; z: number }[]>()
    for (const [id, rect] of result.placements as Map<string, Rect>) {
      const zone = zoneFor.get(id)
      if (zone === undefined) continue
      const list = ranked.get(zone)
      if (list) list.push({ id, z: rect.z })
      else ranked.set(zone, [{ id, z: rect.z }])
    }
    cardsByZone.current = new Map(
      [...ranked].map(([zone, list]) => [zone, list.sort((a, b) => b.z - a.z).map((e) => e.id)]),
    )
    // Which shelf slot each floating badge takes, the front of the pile first.
    // Assigned over the pile rather than per card, because the collision this
    // fixes is between two plates that belong to different cards.
    const shelf = new Map<string, number>()
    // The bottom plate of a pile whose front card is the flagged one is already
    // sitting on that card: it gets no line, because there is nothing for a
    // line to disambiguate. Only a plate that has had to climb needs one.
    const noLeader = new Set<string>()
    if (params.attention.float) {
      for (const ids of cardsByZone.current.values()) {
        let slot = 0
        for (const id of ids) {
          if (!flagged.get(id)?.note) continue
          if ((channels.get(id)?.emphasis ?? 0) <= 0) continue
          if (slot === 0 && id === ids[0]) noLeader.add(id)
          shelf.set(id, slot++)
        }
      }
    }
    const leaderPoints = new Map<Level, number[]>()

    // Where the plates go, hunted on a cadence rather than per frame: the
    // answer moves with the camera, and re-asking every frame would have them
    // crawling around the wall while it turns. Reads the meshes as the last
    // frame left them, which is a frame stale and invisible at this rate.
    const nowMs = performance.now()
    if (
      params.attention.seek &&
      params.attention.float &&
      nowMs - seekAt.current > params.attention.seekMs
    ) {
      seekAt.current = nowMs
      grid.cells.fill(0)
      const scratch = new THREE.Vector3()
      const boxOfPlane = (
        object: THREE.Object3D,
        hw: number,
        hh: number,
        dx: number,
        dy: number,
      ): Box => {
        let x0 = Infinity
        let y0 = Infinity
        let x1 = -Infinity
        let y1 = -Infinity
        for (const [ox, oy] of CORNERS) {
          scratch
            .set((ox as number) * hw + dx, (oy as number) * hh + dy, 0)
            .applyEuler(object.rotation)
            .add(object.position)
            .project(camera)
          const sx = (scratch.x + 1) / 2
          const sy = (1 - scratch.y) / 2
          if (sx < x0) x0 = sx
          if (sx > x1) x1 = sx
          if (sy < y0) y0 = sy
          if (sy > y1) y1 = sy
        }
        return { x0, y0, x1, y1 }
      }

      for (const mesh of meshes.current.values()) {
        if (!mesh.visible) continue
        mark(grid, boxOfPlane(mesh, mesh.scale.x / 2, mesh.scale.y / 2, 0, 0))
      }

      // In pile order, so the answer is the same every pass and an earlier
      // plate is something a later one has to avoid.
      for (const ids of cardsByZone.current.values()) {
        for (const id of ids) {
          if (!shelf.has(id)) continue
          const mesh = meshes.current.get(id)
          const held = badges.byId.get(id)
          if (!mesh || !held) continue
          const hw = mesh.scale.x / 2
          const hh = mesh.scale.y / 2
          const gap = params.attention.floatGap
          const offsets: { dx: number; dy: number; ring: number; box: Box; cost: number }[] = []
          for (const [ux, uy] of SEEK_DIRS) {
            for (let d = 1; d <= params.attention.seekReach; d++) {
              const dx = (ux as number) * (hw + held.w / 2 + gap) * d
              const dy = (uy as number) * (hh + held.h / 2 + gap) * d
              // Straight up and touching is the one spot that needs no line
              // back to the artifact, so it is the only one that does not pay
              // for one. A plate stays welded unless moving buys more.
              const welded = (ux as number) === 0 && (uy as number) === 1 && d === 1
              offsets.push({
                dx,
                dy,
                ring: d,
                box: boxOfPlane(mesh, held.w / 2, held.h / 2, dx, dy),
                cost:
                  Math.hypot(dx, dy) * params.attention.seekPull +
                  (welded ? 0 : params.attention.seekLineCost),
              })
            }
          }
          const pick = choose(
            grid,
            offsets.map((o) => ({ box: o.box, cost: o.cost })),
          )
          const won = offsets[pick]
          if (!won) continue

          // What it would cost to stay put. A plate only moves for a spot that
          // is better by a margin, so two near-equal spots cannot trade it back
          // and forth every pass.
          const holding = plateAt.current.get(id)
          const holdBox = holding
            ? boxOfPlane(mesh, held.w / 2, held.h / 2, holding.dx, holding.dy)
            : null
          const holdWelded = holding ? holding.ring === 1 && holding.dx === 0 && holding.dy > 0 : false
          const holdCost =
            holdBox && holding
              ? score(grid, holdBox) +
                Math.hypot(holding.dx, holding.dy) * params.attention.seekPull +
                (holdWelded ? 0 : params.attention.seekLineCost)
              : Infinity
          const wonCost = score(grid, won.box) + won.cost
          const moves = wonCost + params.attention.seekHysteresis < holdCost
          if (moves || !holding) plateAt.current.set(id, { dx: won.dx, dy: won.dy, ring: won.ring })
          mark(grid, moves || !holdBox ? won.box : holdBox, params.attention.seekPlateCost)
        }
      }

      // A wall that runs all day sheds artifacts constantly, and neither map
      // is keyed on anything that expires on its own.
      for (const id of plateAt.current.keys()) {
        if (shelf.has(id)) continue
        plateAt.current.delete(id)
        plateMotion.current.delete(id)
      }
    }

    const liveZones = [...new Set(model.map((m) => m.zone))]
    const focused = zoneOf(view)
    if (focused && !liveZones.includes(focused)) {
      dispatch({ type: 'prune', live: liveZones })
    }

    const placed = [...result.placements.keys()]
    const changed =
      placed.length !== liveRef.current.length || placed.some((id, i) => liveRef.current[i] !== id)
    if (changed) {
      liveRef.current = placed
      setLive(placed)
    }

    for (const [id, rect] of result.placements as Map<string, Rect>) {
      const mesh = meshes.current.get(id)
      if (!mesh) continue
      const ch = channels.get(id) ?? ({} as SlopChannels)
      const aspect = aspects.get(id) ?? 1
      const side = rect.w

      // The rect is the square slot; the image is fit inside it.
      const drawnW = aspect >= 1 ? side : side * aspect
      const drawnH = aspect >= 1 ? side / aspect : side
      const emphasis = ch.emphasis ?? 0
      const flag = flagged.get(id)
      const tier = params.attention.levels[flag?.level ?? 'look']
      // Breathing, so a flag is findable on a wall the eye is scanning. Scaled
      // by emphasis, so an unflagged artifact is exactly as still as it ever was.
      const pulse =
        1 +
        params.attention.pulse *
          tier.pulseAmp *
          emphasis *
          Math.sin((tick / 1000) * 2 * Math.PI * tier.pulseHz)
      // In place, so hovering never reorders what is in front of what.
      const swell = hovered.current === id ? params.attention.hoverScale : 1
      mesh.scale.set(drawnW * pulse * swell, drawnH * pulse * swell, 1)
      // A rect's x/y is its top-left, three positions a plane by its centre, and
      // windease's rect space grows y downward where three's world grows it up.
      // All three corrections happen here and nowhere else.
      // The lift rides on top of the rect's z: an item asking to be looked at
      // stands out in front of its own pile rather than in its rank.
      mesh.position.set(
        rect.x + drawnW / 2,
        -(rect.y + drawnH / 2),
        rect.z + tier.lift * emphasis,
      )
      mesh.rotation.set(ch.rotX ?? 0, ch.rotY ?? 0, ch.rotZ ?? 0)

      const mat = mesh.material as THREE.MeshBasicMaterial
      const tex = textures.textureFor(id) ?? null
      if (mat.map !== tex) {
        mat.map = tex
        mat.needsUpdate = true
      }
      const cut = dimmed.has(id) ? params.overlay.filterDim : 1
      mat.opacity = (ch.opacity ?? 1) * cut
      mat.transparent = true

      const badge = badges.byId.get(id)
      const wearsBadge = emphasis > 0 && !!flag?.note
      if (badge || wearsBadge) {
        const level = flag?.level ?? 'look'
        const fill = levelColors[level]
        const ink = params.colors.badgeInk
        // A badge may run past its own artifact's right edge, as far as the
        // next zone begins — a note is worth more than the tidiness of a plate
        // that stops where the picture does.
        const base = zoneFor.get(id) ? bases.current.get(zoneFor.get(id)!) : undefined
        const floats = params.attention.float && shelf.has(id) && !!base
        // A floating plate is measured from its zone's left edge, where the
        // shelf stands. Measuring from the card would give a deep rank almost
        // no width at all, since its rect has already stepped most of the way
        // across the cell.
        const runsFrom = floats && base ? base.x : rect.x
        const runsTo = base ? base.x + base.w + params.zoneGrid.gap : rect.x + side
        const held = badges.sync(
          id,
          `${flag?.note ?? ''}|${fill}|${ink}|${badgeFamily}|${fontsReady}|${params.attention.badgeSize}`,
          flag?.note ?? '',
          fill,
          ink,
          badgeFamily,
          params.attention.badgeSize,
          Math.max(params.attention.badgeSize, runsTo - runsFrom),
        )
        held.plate.visible = wearsBadge
        const slot = shelf.get(id)
        if (wearsBadge && slot !== undefined && base) {
          const { w, h } = held
          held.plate.scale.set(w, h, 1)
          // Coplanar with its card, always. The shelf moves the plate for
          // legibility, but it moves it *within* the card's own plane: the
          // offset is measured flat and then turned by the card's rotation, so
          // the plate reads as a face of the artifact rather than as a sticker
          // floating in front of the wall.
          held.plate.rotation.copy(mesh.rotation)
          // Where the hunt put it, if it ran. Otherwise the shelf: plates
          // stacked on the zone's top border, left edges flush with the zone's,
          // which is the arrangement the hunt falls back to on an empty wall
          // anyway because "up" is the first direction it tries.
          const hunted = params.attention.seek ? plateAt.current.get(id) : undefined
          let eased: { x: number; y: number } | undefined
          if (hunted) {
            let m = plateMotion.current.get(id)
            if (!m) {
              // Born on its own card, so a new plate grows out of the artifact
              // rather than appearing somewhere else on the wall.
              m = { x: 0, y: 0, vx: 0, vy: 0 }
              plateMotion.current.set(id, m)
            }
            // Clamped: a tab that has been asleep hands back a delta measured
            // in seconds, and the spring would fling the plate off the wall.
            const dt = Math.min(delta, 1 / 30)
            const k = params.attention.seekStiffness
            const c = params.attention.seekDamping
            m.vx += ((hunted.dx - m.x) * k - m.vx * c) * dt
            m.vy += ((hunted.dy - m.y) * k - m.vy * c) * dt
            m.x += m.vx * dt
            m.y += m.vy * dt
            eased = m
          }
          const shelfY =
            -base.y + params.attention.floatLift + slot * (h + params.attention.floatGap) + h / 2
          const offset = (
            eased
              ? new THREE.Vector3(eased.x, eased.y, BADGE_LIFT)
              : new THREE.Vector3(
                  base.x + w / 2 - mesh.position.x,
                  shelfY - mesh.position.y,
                  BADGE_LIFT,
                )
          ).applyEuler(mesh.rotation)
          held.plate.position.copy(mesh.position).add(offset)
          const plateMat = held.plate.material as THREE.MeshBasicMaterial
          plateMat.transparent = true
          plateMat.opacity = cut
          // Down to the top of the card, so the line says which artifact is
          // asking even when the plate has climbed clear of the pile. Read off
          // the mesh rather than the rect: a flagged card stands `tier.lift`
          // forward of its rank, and a line drawn to the rect's own z lands
          // behind the card it is pointing at.
          // A plate resting directly on top of its own card needs no line:
          // there is nothing for one to disambiguate. Anything that has moved
          // off the card gets one, however it got there.
          const resting = hunted
            ? hunted.ring === 1 && hunted.dx === 0 && Math.abs(eased?.x ?? 0) < h / 4
            : noLeader.has(id)
          if (!resting) {
            // From the plate's own bottom edge, wherever its card's plane put
            // it, to the top of the card. Read off the meshes rather than the
            // rects: a flagged card stands `tier.lift` forward of its rank, and
            // a line drawn to the rect's own z lands behind the card it points
            // at.
            // The edge of the plate that faces its card, so the line never
            // crosses the plate it comes from.
            const foot = new THREE.Vector3(
              clamp(mesh.position.x - held.plate.position.x, -w / 2, w / 2),
              clamp(mesh.position.y - held.plate.position.y, -h / 2, h / 2),
              0,
            ).applyEuler(held.plate.rotation)
            const head = new THREE.Vector3(0, (drawnH * swell * pulse) / 2, 0).applyEuler(
              mesh.rotation,
            )
            const points = leaderPoints.get(level) ?? []
            points.push(
              held.plate.position.x + foot.x,
              held.plate.position.y + foot.y,
              held.plate.position.z + foot.z,
              mesh.position.x + head.x,
              mesh.position.y + head.y,
              mesh.position.z + head.z,
            )
            leaderPoints.set(level, points)
          }
        } else if (wearsBadge) {
          const { w, h } = held
          held.plate.scale.set(w, h, 1)
          held.plate.rotation.copy(mesh.rotation)
          // Measured in the card's own frame and then turned with it, so the
          // badge stays welded to the top border from every angle rather than
          // sliding off it as the wall turns. Left edges flush.
          held.plate.position
            .copy(mesh.position)
            .add(
              new THREE.Vector3(
                (w - drawnW * swell) / 2,
                (drawnH * swell + h) / 2,
                BADGE_LIFT,
              ).applyEuler(mesh.rotation),
            )
        }
      }

      // Set here rather than in the memo, which cannot see a zone that arrived
      // since, and which does not know how far the card has faded.
      const edge = edges.byId.get(id)
      if (edge) {
        // The halo wins the line where both want it: a flagged card is not
        // also reporting its slot extent.
        const halo = emphasis > 0 && tier.haloWidth > 0
        edge.visible = halo || cardEdges
        const zone = zoneFor.get(id)
        const own = huedCardEdge && zone ? huedColors.get(zone) : undefined
        if (halo) edge.material.color.set(levelColors[flag?.level ?? 'look'])
        else if (own) edge.material.color.copy(own)
        else edge.material.color.set(cardEdgeColor)
        const thicken = hovered.current === id ? params.attention.hoverEdge : 1
        edge.material.linewidth = halo
          ? tier.haloWidth * thicken
          : params.overlay.cardEdgeWidth
        // The halo is the one thing the depth falloff must not mute.
        edge.material.opacity = (halo ? Math.max(ch.opacity ?? 1, emphasis) : (ch.opacity ?? 1)) * cut
        setResolution(edge.material, gl)
      }
    }

    for (const [level, line] of leaders) {
      const points = leaderPoints.get(level)
      line.visible = !!points
      if (!points) continue
      line.geometry.setPositions(points)
      // setPositions leaves the instance count from whichever frame had the
      // most segments, so a frame with fewer draws past the end of its own
      // buffer. Six numbers is one segment: two endpoints.
      line.geometry.instanceCount = points.length / 6
      line.material.color.set(levelColors[level])
      line.material.linewidth = params.attention.leaderWidth
      setResolution(line.material, gl)
    }

    retarget(depthOf(view), zoneOf(view))
    if (move.current) pose.current = poseAt(move.current, performance.now())

    const { x, y, distance, halfHeight } = pose.current
    const eye = orbitOffset(params.camera.yawDeg, params.camera.pitchDeg, distance)
    camera.position.set(x + eye.x, -y + eye.y, eye.z)
    camera.lookAt(x, -y, 0)

    // The orthographic frustum is what frames, so it is retargeted where a
    // perspective camera would have moved. Live-tunable angles land the same way.
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      const ortho = camera as THREE.OrthographicCamera
      const aspect = window.innerWidth / window.innerHeight
      ortho.top = halfHeight
      ortho.bottom = -halfHeight
      ortho.right = halfHeight * aspect
      ortho.left = -halfHeight * aspect
      ortho.updateProjectionMatrix()
    }
  })

  // Held by reference so a plan republish reconciles nothing: React skips a
  // child whose element is the one it already rendered.
  const quads = useMemo(
    () =>
      live.map((id) => (
        <mesh
          key={id}
          geometry={geometry}
          ref={(m) => {
            if (m) {
              // What the raycast reads back: the pick has to name a card, and
              // the alternative is a reverse scan of every mesh on the wall.
              m.userData.slopId = id
              meshes.current.set(id, m)
            } else meshes.current.delete(id)
          }}
        >
          <meshBasicMaterial toneMapped={false} />
          {/* Always mounted, shown per frame: the attention halo reuses this
              line, so its presence cannot depend on the diagnostic toggle. */}
          <primitive object={edges.for(id)} />
        </mesh>
      )),
    [live, geometry, edges],
  )

  return (
    <group>
      {quads}
      {live.map((id) => {
        const held = badges.byId.get(id)
        return held ? <primitive key={`badge-${id}`} object={held.plate} /> : null
      })}
      {[...leaders].map(([level, line]) => (
        <primitive key={`leader-${level}`} object={line} />
      ))}
      <ZoneOverlay
        cells={bases}
        zones={zoneNames}
        focus={zoneOf(view)}
        settings={params.zones}
        colors={params.colors}
        hued={huedColors}
        family={labelFamily}
        fontsReady={fontsReady}
      />
    </group>
  )
}

export function WebglBackend(props: Props) {
  const [view, dispatch] = useReducer(reduceView, WALL)
  const [plan, setPlan] = useState<Plan>({ cells: [], extent: null })
  // Flags the wall never received, merged in below. Held here rather than in
  // App so that a fake reaches the scene by exactly the route a real one does.
  const [fakes, setFakes] = useState<Record<string, FakeFlag>>({})
  const [range, setRange] = useState<Range | null>(null)
  // The daemon's clock, ticking, so the band's axis ends at the same `now`
  // every age on the wall is measured against.
  const [now, setNow] = useState(() => Date.now() + props.clockOffset)
  const offset = props.clockOffset
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now() + offset), 1000)
    return () => clearInterval(id)
  }, [offset])
  // Read live rather than from the arrangement's descriptor: the panel is the
  // camera's tuning surface, and the arrangement is rebuilt only for layout.
  const { fovDeg: fov, projection } = props.params.camera
  const card = cardOf(view)

  const items = useMemo(() => {
    if (Object.keys(fakes).length === 0) return props.items
    return props.items.map((i) => {
      const fake = fakes[i.id]
      return fake ? { ...i, attention: fake.attention, note: fake.note } : i
    })
  }, [props.items, fakes])

  // Excluded rather than removed: the arrangement never sees the filter, so
  // nothing reshuffles and a pile keeps the shape you learned.
  const dimmed = useMemo(() => {
    const out = new Set<string>()
    if (!range) return out
    for (const i of items) if (!keptBy(i.bornAt, range)) out.add(i.id)
    return out
  }, [items, range])

  const dropFake = useCallback((id: string) => {
    setFakes((was) => {
      if (!(id in was)) return was
      const { [id]: _gone, ...rest } = was
      return rest
    })
  }, [])

  // Opening a card is the thing the flag was asking for, so looking at it is
  // what clears it. Fire-and-forget: the daemon broadcasts the change, and a
  // dismissal that fails costs a halo that is still accurate.
  useEffect(() => {
    if (card === null) return
    dropFake(card)
    void fetch(`/api/items/${card}/dismiss`, { method: 'POST' }).catch(() => {})
  }, [card, dropFake])

  // The daemon has no record of a fabricated flag, so the row's × has to clear
  // it here; a real one still goes the one route that exists for it.
  const dismiss = useCallback(
    (id: string) => {
      dropFake(id)
      void fetch(`/api/items/${id}/dismiss`, { method: 'POST' }).catch(() => {})
    },
    [dropFake],
  )

  /** The item the lightbox is showing. From `props.items` rather than the
   *  fake-flag overlay, so the meta line reports the wall, not the rehearsal. */
  const lit = card === null ? null : (props.items.find((i) => i.id === card) ?? null)

  const [menu, setMenu] = useState<MenuAt | null>(null)
  /** Set by the first expiry this client asks for. The daemon holds one undo,
   *  and the wall cannot see whether it is still loaded — so this only says
   *  that something has been expired from here, and the route answers for the
   *  rest. */
  const [expired, setExpired] = useState(false)
  const onMenu = useCallback((at: MenuAt) => setMenu(at), [])

  const menuTarget = menu?.target
  const menuItem =
    menuTarget?.kind === 'card' ? items.find((i) => i.id === menuTarget.id) : undefined

  const undo = useCallback(() => {
    void fetch('/api/undo', { method: 'POST' }).catch(() => {})
  }, [])

  const act = useCallback(
    (action: Action) => {
      setMenu(null)
      if (action === 'undo') return undo()
      const target = menu?.target
      if (target?.kind !== 'card') return
      const id = target.id
      if (action === 'open') return void dispatch({ type: 'to', path: [target.zone, id] })
      if (action === 'dismiss') return dismiss(id)
      if (action === 'copyPath' && menuItem)
        return void navigator.clipboard?.writeText(menuItem.path).catch(() => {})
      if (action === 'keep' || action === 'release') {
        const on = action === 'keep' ? '1' : '0'
        return void fetch(`/api/items/${id}/keep?on=${on}`, { method: 'POST' }).catch(() => {})
      }
      if (action === 'expire') {
        setExpired(true)
        return void fetch(`/api/items/${id}/expire`, { method: 'POST' }).catch(() => {})
      }
    },
    [menu, menuItem, dispatch, dismiss, undo],
  )

  // Cmd-Z is what a hand reaches for, and the wall has nothing else to undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'z') return
      if (isForAControl(e.target)) return
      e.preventDefault()
      undo()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [undo])
  // An orthographic camera sees a slab, not a cone, so `far` has to clear the
  // standoff plus everything the rank cap can put behind the wall.
  const far = props.params.camera.standoff * 2 + 100

  return (
    <>
      <Canvas
        key={projection}
        className="scene"
        dpr={[1, 2]}
        orthographic={projection === 'orthographic'}
        camera={{ fov, position: [0, 0, props.params.camera.standoff], near: 0.01, far }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Wall
          {...props}
          items={items}
          view={view}
          dispatch={dispatch}
          onPlan={setPlan}
          onMenu={onMenu}
          dimmed={dimmed}
        />
        <Sky settings={props.params.sky} colors={props.params.colors} />
      </Canvas>
      <Minimap
        cells={plan.cells}
        extent={plan.extent}
        focus={zoneOf(view)}
        onFocus={(zone) => dispatch({ type: 'to', path: [zone] })}
      />
      <div className="axes">
        <Axes yawDeg={props.params.camera.yawDeg} pitchDeg={props.params.camera.pitchDeg} />
      </div>
      <TopBar items={items} now={now} range={range} onRange={setRange} />
      <Sidebar
        items={items.filter((i) => keptBy(i.bornAt, range))}
        clockOffset={props.clockOffset}
        params={props.params}
        onParams={props.onParams}
        onOpen={(item) => dispatch({ type: 'to', path: [item.zone, item.id] })}
        onDismiss={dismiss}
        fakeCount={Object.keys(fakes).length}
        onGenerate={() => setFakes(fakeFlags(items.map((i) => i.id)))}
        onClearFakes={() => setFakes({})}
      />
      {menu && (
        <CardMenu
          at={menu}
          item={menuItem}
          canUndo={expired}
          onAct={act}
          onClose={() => setMenu(null)}
        />
      )}
      {lit && <Lightbox item={lit} now={now} onClose={() => dispatch({ type: 'out' })} />}
    </>
  )
}
