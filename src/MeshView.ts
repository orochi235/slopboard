import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { distanceFor, MESH_VIEW } from '@shared/mesh.ts'

/** How far a drag turns the model, and how much a wheel notch closes on it. */
const RAD_PER_PX = 0.008
const ZOOM_PER_NOTCH = 0.0015
/** How close and how far the camera may be pushed, as a share of the distance
 *  the model was framed at. Nearer than the first and it is inside the model. */
const ZOOM_RANGE = [0.35, 4] as const
/** Straight down and straight up both gimbal-lock the orbit, so the pitch
 *  stops just short of each. */
const PITCH_LIMIT = Math.PI / 2 - 0.05

export type MeshView = {
  /** Frees the GL context, the geometry and the listeners. The modal unmounts
   *  with the wall still rendering behind it, so a leak here is a leak per
   *  mesh opened. */
  dispose: () => void
}

/**
 * The real model, orbited under the pointer, mounted into `host`.
 *
 * Imperative three rather than `@react-three/fiber`: this is one scene holding
 * one object for as long as a modal is open, and the wall's own canvas is the
 * only place the reconciler earns its keep.
 *
 * Framed and lit exactly as the poster was — see `shared/mesh.ts` — so opening
 * a card shows the picture on it turning, rather than some other view of the
 * same file.
 */
export function mountMesh(
  host: HTMLElement,
  url: string,
  // `stl` rather than a sniff of the URL: an `/orig/<id>` from an older card has no extension,
  // and the wrong loader reads an ASCII mesh as JSON and says so.
  { stl, onError }: { stl: boolean; onError: (message: string) => void },
): MeshView {
  const scene = new THREE.Scene()
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  const camera = new THREE.PerspectiveCamera(MESH_VIEW.fov, 1, 0.01, 1000)
  let framed = 1
  let disposed = false

  const size = () => {
    const { clientWidth: w, clientHeight: h } = host
    renderer.setPixelRatio(window.devicePixelRatio)
    // The CSS size set too, not only the drawing buffer: left off, the canvas
    // element lays out at its device-pixel width and spills out of its box.
    renderer.setSize(w, h)
    camera.aspect = w / Math.max(1, h)
    camera.updateProjectionMatrix()
    draw()
  }

  const draw = () => {
    if (!disposed) renderer.render(scene, camera)
  }

  renderer.setClearAlpha(0)
  host.appendChild(renderer.domElement)
  scene.add(new THREE.HemisphereLight(MESH_VIEW.sky, MESH_VIEW.ground, MESH_VIEW.fill))
  const key = new THREE.DirectionalLight('#ffffff', MESH_VIEW.key)
  key.position.set(...MESH_VIEW.dir)
  scene.add(key)

  const loader = stl ? new STLLoader() : new GLTFLoader()
  loader.load(
    url,
    (loaded: unknown) => {
      if (disposed) return
      const object = stl
        ? matte(loaded as THREE.BufferGeometry)
        : (loaded as { scene: THREE.Object3D }).scene
      const sphere = new THREE.Box3()
        .setFromObject(object)
        .getBoundingSphere(new THREE.Sphere())
      object.position.sub(sphere.center)
      scene.add(object)
      camera.near = sphere.radius / 100
      camera.far = sphere.radius * 100
      framed = distanceFor(sphere.radius)
      camera.position.fromArray(MESH_VIEW.dir).normalize().multiplyScalar(framed)
      camera.lookAt(0, 0, 0)
      size()
    },
    undefined,
    (err: unknown) => onError((err as Error)?.message ?? 'could not be read'),
  )

  // Spherical coordinates rather than a quaternion: the pitch limit and the
  // zoom range are both read straight off them, where a free rotation would
  // have to be measured back out.
  const orbit = new THREE.Spherical()
  let dragging: number | null = null
  let last = { x: 0, y: 0 }

  const onDown = (e: PointerEvent) => {
    dragging = e.pointerId
    last = { x: e.clientX, y: e.clientY }
    renderer.domElement.setPointerCapture(e.pointerId)
  }
  const onMove = (e: PointerEvent) => {
    if (dragging !== e.pointerId) return
    orbit.setFromVector3(camera.position)
    orbit.theta -= (e.clientX - last.x) * RAD_PER_PX
    orbit.phi = clamp(
      orbit.phi + (e.clientY - last.y) * RAD_PER_PX,
      Math.PI / 2 - PITCH_LIMIT,
      Math.PI / 2 + PITCH_LIMIT,
    )
    last = { x: e.clientX, y: e.clientY }
    camera.position.setFromSpherical(orbit)
    camera.lookAt(0, 0, 0)
    draw()
  }
  const onUp = (e: PointerEvent) => {
    if (dragging === e.pointerId) dragging = null
  }
  const onWheel = (e: WheelEvent) => {
    // The wall pages a pile on a `window` wheel listener, and a wheel meant for
    // the model must not step out from under it.
    e.stopPropagation()
    e.preventDefault()
    orbit.setFromVector3(camera.position)
    orbit.radius = clamp(
      orbit.radius * (1 + e.deltaY * ZOOM_PER_NOTCH),
      framed * ZOOM_RANGE[0],
      framed * ZOOM_RANGE[1],
    )
    camera.position.setFromSpherical(orbit)
    camera.lookAt(0, 0, 0)
    draw()
  }

  const canvas = renderer.domElement
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerup', onUp)
  canvas.addEventListener('pointercancel', onUp)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  const resize = new ResizeObserver(size)
  resize.observe(host)
  size()

  return {
    dispose: () => {
      disposed = true
      resize.disconnect()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
      canvas.removeEventListener('wheel', onWheel)
      scene.traverse((node) => {
        const mesh = node as THREE.Mesh
        mesh.geometry?.dispose()
        const material = mesh.material
        if (Array.isArray(material)) for (const m of material) m.dispose()
        else material?.dispose()
      })
      renderer.dispose()
      canvas.remove()
    },
  }
}

/** The same matte an `.stl` is postered in, recomputed normals included: the
 *  format carries no material, and plenty are written with zero-length facet
 *  normals, which light as black. */
function matte(geometry: THREE.BufferGeometry): THREE.Mesh {
  geometry.computeVertexNormals()
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: MESH_VIEW.matte, roughness: 0.8 }),
  )
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n))
