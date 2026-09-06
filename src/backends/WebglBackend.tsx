import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { Arrangement3D, SlopChannels } from '@/arrangements/index.ts'
import { framePose, type Pose } from '@/camera/frame.ts'
import { type Move, poseAt } from '@/camera/move.ts'
import { orbitOffset } from '@/camera/orbit.ts'
import { Lightbox } from '@/Lightbox.tsx'
import { Sky } from '@/backends/Sky.tsx'
import { ZoneOverlay } from '@/backends/ZoneOverlay.tsx'
import { toStackItems } from '@/model.ts'
import { Minimap, type Plan } from '@/nav/Minimap.tsx'
import { createLoop, loopPositions, setResolution } from '@/backends/fatLines.ts'
import { CHROME_ORDER } from '@/backends/order.ts'
import { badgeTexture } from '@/textures/badge.ts'
import { loadFaces, stackFor } from '@/typeface.ts'
import type { Level } from '@shared/attention.ts'
import { createGestureRail } from '@/nav/gesture.ts'
import { directionFor, isForAControl } from '@/nav/keys.ts'
import { neighbourOf } from '@/nav/neighbour.ts'
import { zoneAt } from '@/nav/pick.ts'
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
  arrangement: Arrangement3D
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
}: WallProps) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl, camera } = useThree()
  const cardEdges = params.overlay.cardEdges
  const cardEdgeColor = params.colors.cardEdge
  const family = stackFor(params.typeface)
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
        budgetBytes: params.textureBudgetBytes,
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
    [params.textureBudgetBytes],
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
    const byId = new Map<string, { sprite: THREE.Sprite; key: string; aspect: number }>()
    return {
      byId,
      /** Rebuilt only when what it draws changes, so a per-frame call is free. */
      sync(id: string, key: string, text: string, plate: string, ink: string, font: string) {
        let held = byId.get(id)
        if (!held) {
          // Signage, not scenery: it composites over the wall rather than
          // sorting into it, so a nearer pile cannot bury the thing that is
          // asking to be looked at.
          const sprite = new THREE.Sprite(
            new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false }),
          )
          sprite.renderOrder = CHROME_ORDER
          // The badge is a shortcut to its own artifact, so it takes a pick.
          sprite.userData.slopId = id
          sprite.userData.slopBadge = true
          held = { sprite, key: '', aspect: 1 }
          byId.set(id, held)
        }
        if (held.key !== key) {
          held.sprite.material.map?.dispose()
          const { texture, aspect } = badgeTexture(text, plate, ink, font)
          held.sprite.material.map = texture
          held.sprite.material.needsUpdate = true
          held.key = key
          held.aspect = aspect
        }
        return held
      },
    }
  }, [])
  useEffect(
    () => () => {
      for (const { sprite } of badges.byId.values()) {
        sprite.material.map?.dispose()
        sprite.material.dispose()
      }
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
    for (const { sprite } of badges.byId.values()) if (sprite.visible) targets.push(sprite)
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
    for (const { sprite } of badges.byId.values()) if (sprite.visible) targets.push(sprite)
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
  const act = useRef({ chainAt, navigate, hoverAt })
  act.current = { chainAt, navigate, hoverAt }

  // Bound to the canvas, not to a mesh, so the empty space between piles turns
  // the scene. A press that never travels is a click, and picks a rung.
  useEffect(() => {
    const el = gl.domElement
    let active = false
    let last = { x: 0, y: 0 }

    const onDown = (e: PointerEvent) => {
      if (e.button !== 0) return
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
      active = false
      el.classList.remove('scene--turning')
      const over = act.current.hoverAt(e.clientX, e.clientY)
      hovered.current = over
      el.classList.toggle('scene--pointing', over !== null)
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
      if (turned || e.button !== 0) return
      act.current.navigate(act.current.chainAt(e.clientX, e.clientY))
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    el.addEventListener('pointercancel', onUp)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointercancel', onUp)
    }
  }, [gl, onParams])

  // On the window rather than the canvas, so the gesture keeps working under
  // the lightbox, which covers it.
  useEffect(() => {
    const rail = createGestureRail(params.nav)
    const onWheel = (e: WheelEvent) => {
      if ((e.target as Element | null)?.closest?.('.params, .minimap, .prefs')) return
      // A trackpad pinch is a wheel event with ctrlKey set; left alone it zooms
      // the page instead of the wall.
      e.preventDefault()
      const step = rail.feed({ deltaY: e.deltaY, ctrlKey: e.ctrlKey }, e.timeStamp)
      if (!step) return
      if (step === 'out') dispatch({ type: 'out' })
      else act.current.navigate(act.current.chainAt(e.clientX, e.clientY))
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel)
  }, [params.nav, dispatch])

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

  useFrame(() => {
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
      mat.opacity = ch.opacity ?? 1
      mat.transparent = true

      const badge = badges.byId.get(id)
      const wearsBadge = emphasis > 0 && !!flag?.note
      if (badge || wearsBadge) {
        const level = flag?.level ?? 'look'
        const plate = levelColors[level]
        // White carries the loud plates; the quiet ones ink themselves in the
        // wall's own dark, which lime and amber are far too bright to take.
        // Only the red plate is dark enough to need white; lime, amber and
        // orange all read best with black on them.
        const ink = level === 'problem' ? params.colors.badgeInk : params.colors.badgeInkQuiet
        const held = badges.sync(
          id,
          `${flag?.note ?? ''}|${plate}|${ink}|${family}|${fontsReady}`,
          flag?.note ?? '',
          plate,
          ink,
          family,
        )
        held.sprite.visible = wearsBadge
        if (wearsBadge) {
          const h = params.attention.badgeSize
          const w = h * held.aspect
          held.sprite.scale.set(w, h, 1)
          // Sitting on the top border, left edges flush, so it reads as welded
          // to the card rather than floating over it.
          held.sprite.position.set(
            rect.x + w / 2,
            -rect.y + h / 2,
            rect.z + tier.lift * emphasis + BADGE_LIFT,
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
        edge.material.opacity = halo ? Math.max(mat.opacity, emphasis) : mat.opacity
        setResolution(edge.material, gl)
      }
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
        return held ? <primitive key={`badge-${id}`} object={held.sprite} /> : null
      })}
      <ZoneOverlay
        cells={bases}
        zones={zoneNames}
        focus={zoneOf(view)}
        settings={params.zones}
        colors={params.colors}
        hued={huedColors}
        family={family}
        fontsReady={fontsReady}
      />
    </group>
  )
}

export function WebglBackend(props: Props) {
  const [view, dispatch] = useReducer(reduceView, WALL)
  const [plan, setPlan] = useState<Plan>({ cells: [], extent: null })
  // Read live rather than from the arrangement's descriptor: the panel is the
  // camera's tuning surface, and the arrangement is rebuilt only for layout.
  const { fovDeg: fov, projection } = props.params.camera
  const card = cardOf(view)

  // Opening a card is the thing the flag was asking for, so looking at it is
  // what clears it. Fire-and-forget: the daemon broadcasts the change, and a
  // dismissal that fails costs a halo that is still accurate.
  useEffect(() => {
    if (card === null) return
    void fetch(`/api/items/${card}/dismiss`, { method: 'POST' }).catch(() => {})
  }, [card])
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
        <Wall {...props} view={view} dispatch={dispatch} onPlan={setPlan} />
        <Sky settings={props.params.sky} colors={props.params.colors} />
      </Canvas>
      <Minimap
        cells={plan.cells}
        extent={plan.extent}
        focus={zoneOf(view)}
        onFocus={(zone) => dispatch({ type: 'to', path: [zone] })}
      />
      {card !== null && (
        <Lightbox
          id={card}
          caption={props.items.find((i) => i.id === card)?.name}
          onClose={() => dispatch({ type: 'out' })}
        />
      )}
    </>
  )
}
