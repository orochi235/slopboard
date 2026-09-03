import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { Rect } from 'windease'
import type { Arrangement3D, SlopChannels } from '@/arrangements/index.ts'
import { toStackItems } from '@/model.ts'
import { defaultParams } from '@/params.ts'
import { createTextureManager } from '@/textures/manager.ts'
import { loadBitmap } from '@/textures/source.ts'
import type { WallItem } from '@shared/protocol.ts'

type Props = {
  items: WallItem[]
  arrangement: Arrangement3D
  ttlMs: number
  clockOffset: number
}

/** One quad per item. Ranks past the fade get no texture and draw flat. */
function Wall({ items, arrangement, ttlMs, clockOffset }: Props) {
  const meshes = useRef(new Map<string, THREE.Mesh>())
  const { gl } = useThree()

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

  const [live, setLive] = useState<string[]>([])
  const liveRef = useRef<string[]>([])

  useFrame(() => {
    const current = latest.current
    const now = Date.now() + current.clockOffset
    const model = toStackItems(current.items, { now, ttlMs: current.ttlMs })
    const aspects = new Map(model.map((m) => [m.id, m.aspect]))

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
        >
          <meshBasicMaterial toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

export function WebglBackend(props: Props) {
  const camera = props.arrangement.camera ?? {
    fovDeg: defaultParams.camera.fovDeg,
    z: 0.5 / Math.tan((defaultParams.camera.fovDeg * Math.PI) / 360),
  }
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ fov: camera.fovDeg, position: [0, 0, camera.z], near: 0.01, far: 100 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
    >
      <Wall {...props} />
    </Canvas>
  )
}
