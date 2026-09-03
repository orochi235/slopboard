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
import { ZoneOverlay } from '@/backends/ZoneOverlay.tsx'
import { toStackItems } from '@/model.ts'
import { Minimap, type MinimapCell } from '@/nav/Minimap.tsx'
import { neighbourOf } from '@/nav/neighbour.ts'
import { unionOf, withHeadroom, zoneCellsOf } from '@/nav/zone-cells.ts'
import type { StackParams } from '@/params.ts'
import { createTextureManager } from '@/textures/manager.ts'
import { loadBitmap } from '@/textures/source.ts'
import { reduceView, type ViewAction, type ViewState, WALL } from '@/view-state.ts'
import type { WallItem } from '@shared/protocol.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement3D
  ttlMs: number
  clockOffset: number
  params: StackParams
  onParams: Dispatch<SetStateAction<StackParams>>
}

type WallProps = Props & {
  view: ViewState
  dispatch: Dispatch<ViewAction>
  onPlan: (cells: MinimapCell[]) => void
}

/** The plan view is a diagram, not an animation: republishing it a few times a
 *  second keeps React out of the frame loop. */
const PLAN_MS = 250

/** How far the scene turns per pixel dragged. */
const DEG_PER_PX = 0.25

/** Movement past this is an orbit; anything less is the click it looks like. */
const DRAG_SLOP_PX = 4

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** One quad per item. Ranks past the fade get no texture and draw flat. */
function Wall({
  items,
  arrangement,
  ttlMs,
  clockOffset,
  params,
  onParams,
  view,
  dispatch,
  onPlan,
}: WallProps) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl, camera } = useThree()
  const cardEdges = params.overlay.cardEdges

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
  const edgeGeometry = useMemo(() => {
    const half = 0.5
    const g = new THREE.BufferGeometry()
    g.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(
        [-half, -half, 0, half, -half, 0, half, half, 0, -half, half, 0],
        3,
      ),
    )
    return g
  }, [])
  useEffect(() => () => edgeGeometry.dispose(), [edgeGeometry])

  const latest = useRef({ items, ttlMs, clockOffset })
  latest.current = { items, ttlMs, clockOffset }

  const cells = useRef<Map<string, Rect>>(new Map())
  const zoneById = useRef<Map<string, string>>(new Map())
  const move = useRef<Move | null>(null)
  const pose = useRef<Pose>({ x: 0, y: 0, distance: 2, halfHeight: 0.5 })

  const [live, setLive] = useState<string[]>([])
  const liveRef = useRef<string[]>([])
  const planAt = useRef(0)
  const dragged = useRef(false)
  const [zoneNames, setZoneNames] = useState<string[]>([])
  const zoneNamesRef = useRef<string[]>([])

  // Retargeted every frame rather than only on a level change: the cells are
  // not known until the first layout runs, and zones arrive and leave under a
  // camera that is already parked. A new move only starts when the target has
  // actually moved, so a steady wall is not re-eased every frame.
  const retarget = (kind: ViewState['kind'], zone: string | null) => {
    const aspect = window.innerWidth / window.innerHeight
    // The union of what is drawn, not the nominal container: a pile's deep
    // ranks step past its cell, so framing the container crops them.
    const wall = unionOf([...cells.current.values()]) ?? { x: 0, y: 0, z: 0, w: aspect, h: 1 }
    const framed = kind === 'wall' || !zone ? wall : (cells.current.get(zone) ?? wall)
    // A label hangs above its cell, so framing the cells alone crops it.
    const box = withHeadroom(framed, params.overlay.labels ? params.overlay.labelSize * 1.6 : 0)
    const margin =
      kind === 'wall' ? params.camera.wallMargin : params.camera.stackMargin
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

  // Bound to the canvas, not to a mesh, so the empty space between piles turns
  // the scene. A press that never travels stays the click the meshes handle.
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
      if (!active) return
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
      active = false
      el.classList.remove('scene--turning')
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return dispatch({ type: 'escape' })
      if (view.kind !== 'stack') return
      const map = {
        ArrowLeft: 'left',
        ArrowRight: 'right',
        ArrowUp: 'up',
        ArrowDown: 'down',
      } as const
      const direction = map[e.key as keyof typeof map]
      if (!direction) return
      const next = neighbourOf(cells.current, view.zone, direction)
      if (next) dispatch({ type: 'zoom', zone: next })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view, dispatch])

  useFrame(() => {
    const current = latest.current
    const now = Date.now() + current.clockOffset
    const model = toStackItems(current.items, { now, ttlMs: current.ttlMs })
    const aspects = new Map(model.map((m) => [m.id, m.aspect]))
    const zoneOf = new Map(model.map((m) => [m.id, m.zone]))
    zoneById.current = zoneOf

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

    cells.current = zoneCellsOf(result.placements as Map<string, Rect>, zoneOf)

    const tick = performance.now()
    if (tick - planAt.current > PLAN_MS) {
      planAt.current = tick
      onPlan([...cells.current].map(([zone, box]) => ({ zone, box })))
    }

    const names = [...cells.current.keys()]
    const sameZones =
      names.length === zoneNamesRef.current.length &&
      names.every((n, i) => zoneNamesRef.current[i] === n)
    if (!sameZones) {
      zoneNamesRef.current = names
      setZoneNames(names)
    }

    const liveZones = [...new Set(model.map((m) => m.zone))]
    if (view.kind !== 'wall' && !liveZones.includes(view.zone)) {
      dispatch({ type: 'zones', live: liveZones })
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
      mesh.scale.set(drawnW, drawnH, 1)
      // A rect's x/y is its top-left, three positions a plane by its centre, and
      // windease's rect space grows y downward where three's world grows it up.
      // All three corrections happen here and nowhere else.
      mesh.position.set(rect.x + drawnW / 2, -(rect.y + drawnH / 2), rect.z)
      mesh.rotation.set(ch.rotX ?? 0, ch.rotY ?? 0, ch.rotZ ?? 0)

      const mat = mesh.material as THREE.MeshBasicMaterial
      const tex = textures.textureFor(id) ?? null
      if (mat.map !== tex) {
        mat.map = tex
        mat.needsUpdate = true
      }
      mat.opacity = ch.opacity ?? 1
      mat.transparent = true
    }

    retarget(view.kind, view.kind === 'wall' ? null : view.zone)
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
            if (m) meshes.current.set(id, m)
            else meshes.current.delete(id)
          }}
          onClick={(e) => {
            e.stopPropagation()
            if (dragged.current) return
            // Same primitive at two levels: zoom to the pile, then open a card.
            if (view.kind === 'wall') {
              const zone = zoneById.current.get(id)
              if (zone) dispatch({ type: 'zoom', zone })
            } else if (view.kind === 'stack') {
              dispatch({ type: 'open', id })
            }
          }}
        >
          <meshBasicMaterial toneMapped={false} />
          {cardEdges && (
            <lineLoop geometry={edgeGeometry} raycast={() => null}>
              <lineBasicMaterial color="#22d3ee" toneMapped={false} />
            </lineLoop>
          )}
        </mesh>
      )),
    [live, geometry, edgeGeometry, cardEdges, view.kind, dispatch],
  )

  return (
    <group>
      {quads}
      <ZoneOverlay
        cells={cells}
        zones={zoneNames}
        focus={view.kind === 'wall' ? null : view.zone}
        overlay={params.overlay}
      />
    </group>
  )
}

export function WebglBackend(props: Props) {
  const [view, dispatch] = useReducer(reduceView, WALL)
  const [plan, setPlan] = useState<MinimapCell[]>([])
  // Read live rather than from the arrangement's descriptor: the panel is the
  // camera's tuning surface, and the arrangement is rebuilt only for layout.
  const { fovDeg: fov, projection } = props.params.camera
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
      </Canvas>
      <Minimap
        cells={plan}
        focus={view.kind === 'wall' ? null : view.zone}
        onFocus={(zone) => dispatch({ type: 'zoom', zone })}
      />
      {view.kind === 'lightbox' && (
        <Lightbox id={view.id} onClose={() => dispatch({ type: 'escape' })} />
      )}
    </>
  )
}
