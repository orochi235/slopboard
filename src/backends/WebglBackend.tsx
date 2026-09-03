import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { type Dispatch, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { Arrangement3D, SlopChannels } from '@/arrangements/index.ts'
import { framePose, type Pose } from '@/camera/frame.ts'
import { type Move, poseAt } from '@/camera/move.ts'
import { Lightbox } from '@/Lightbox.tsx'
import { toStackItems } from '@/model.ts'
import { neighbourOf } from '@/nav/neighbour.ts'
import { unionOf, zoneCellsOf } from '@/nav/zone-cells.ts'
import { defaultParams } from '@/params.ts'
import { createTextureManager } from '@/textures/manager.ts'
import { loadBitmap } from '@/textures/source.ts'
import { reduceView, type ViewAction, type ViewState, WALL } from '@/view-state.ts'
import type { WallItem } from '@shared/protocol.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement3D
  ttlMs: number
  clockOffset: number
}

type WallProps = Props & { view: ViewState; dispatch: Dispatch<ViewAction> }

/** One quad per item. Ranks past the fade get no texture and draw flat. */
function Wall({ items, arrangement, ttlMs, clockOffset, view, dispatch }: WallProps) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl, camera } = useThree()

  const textures = useMemo(
    () =>
      createTextureManager<THREE.Texture>({
        budgetBytes: defaultParams.textureBudgetBytes,
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
    [],
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

  const latest = useRef({ items, ttlMs, clockOffset })
  latest.current = { items, ttlMs, clockOffset }

  const cells = useRef<Map<string, Rect>>(new Map())
  const zoneById = useRef<Map<string, string>>(new Map())
  const move = useRef<Move | null>(null)
  const pose = useRef<Pose>({ x: 0, y: 0, z: 2 })

  const [live, setLive] = useState<string[]>([])
  const liveRef = useRef<string[]>([])

  // Retargeted every frame rather than only on a level change: the cells are
  // not known until the first layout runs, and zones arrive and leave under a
  // camera that is already parked. A new move only starts when the target has
  // actually moved, so a steady wall is not re-eased every frame.
  const retarget = (kind: ViewState['kind'], zone: string | null) => {
    const aspect = window.innerWidth / window.innerHeight
    // The union of what is drawn, not the nominal container: a pile's cards are
    // centre-anchored on its cell and overhang it, so framing the container
    // crops them.
    const wall = unionOf([...cells.current.values()]) ?? { x: 0, y: 0, z: 0, w: aspect, h: 1 }
    const box = kind === 'wall' || !zone ? wall : (cells.current.get(zone) ?? wall)
    const margin =
      kind === 'wall' ? defaultParams.camera.wallMargin : defaultParams.camera.stackMargin
    const target = framePose(box, { fovDeg: defaultParams.camera.fovDeg, aspect, margin })

    const held = move.current?.to
    const moved =
      !held ||
      Math.abs(held.x - target.x) > 1e-3 ||
      Math.abs(held.y - target.y) > 1e-3 ||
      Math.abs(held.z - target.z) > 1e-3
    if (!moved) return

    move.current = {
      from: { ...pose.current },
      to: target,
      startedAt: performance.now(),
      durationMs: defaultParams.camera.moveMs,
    }
  }

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

      // The rect is the square slot; the image is letterboxed inside it.
      mesh.scale.set(aspect >= 1 ? side : side * aspect, aspect >= 1 ? side / aspect : side, 1)
      // The single flip between windease's downward-growing rect space and
      // three's upward-growing world. Nothing else here negates y.
      mesh.position.set(rect.x, -rect.y, rect.z)
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
    camera.position.set(pose.current.x, -pose.current.y, pose.current.z)
    camera.lookAt(pose.current.x, -pose.current.y, 0)
  })

  return (
    <group>
      {live.map((id) => (
        <mesh
          key={id}
          geometry={geometry}
          ref={(m) => {
            if (m) meshes.current.set(id, m)
            else meshes.current.delete(id)
          }}
          onClick={(e) => {
            e.stopPropagation()
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
        </mesh>
      ))}
    </group>
  )
}

export function WebglBackend(props: Props) {
  const [view, dispatch] = useReducer(reduceView, WALL)
  const fov = props.arrangement.camera?.fovDeg ?? defaultParams.camera.fovDeg

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ fov, position: [0, 0, 2], near: 0.01, far: 100 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Wall {...props} view={view} dispatch={dispatch} />
      </Canvas>
      {view.kind === 'lightbox' && (
        <Lightbox id={view.id} onClose={() => dispatch({ type: 'escape' })} />
      )}
    </>
  )
}
