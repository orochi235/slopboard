// The poster viewer, served to a headless Chrome and screenshotted. Plain
// JavaScript because it runs in a browser the daemon spawns, with no build
// step between here and there — see `shared/mesh.ts` for what it shares with
// the lightbox and what it has to repeat.
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { STLLoader } from 'three/addons/loaders/STLLoader.js'

const view = window.__MESH_VIEW__
const src = new URL(window.location.href).searchParams.get('src') ?? ''

const scene = new THREE.Scene()
// `preserveDrawingBuffer`, because this page exists to be screenshotted: the
// shot is taken well after the one render, and without it Chrome captures a
// buffer the compositor has already cleared — a transparent PNG of nothing.
const renderer = new THREE.WebGLRenderer({
  antialias: true,
  alpha: true,
  preserveDrawingBuffer: true,
})
renderer.setSize(window.innerWidth, window.innerHeight)
renderer.setClearAlpha(0)
document.body.appendChild(renderer.domElement)

scene.add(new THREE.HemisphereLight(view.sky, view.ground, view.fill))
const key = new THREE.DirectionalLight('#ffffff', view.key)
key.position.set(...view.dir)
scene.add(key)

/** An `.stl` carries geometry and nothing else, and plenty are written with
 *  zero-length facet normals — which light as black. Recomputing them is
 *  per-face on this geometry, which is the flat shading the format means. */
function matte(geometry) {
  geometry.computeVertexNormals()
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({ color: view.matte, roughness: 0.8 }),
  )
}

const load = (url) =>
  new Promise((resolve, reject) => {
    const stl = /\.stl(\?|$)/i.test(url)
    const loader = stl ? new STLLoader() : new GLTFLoader()
    loader.load(
      url,
      (loaded) =>
        resolve(stl ? matte(loaded) : loaded.scene),
      undefined,
      reject,
    )
  })

/** The one line `shared/mesh.ts` owns and this file repeats. */
const distanceFor = (radius) => (radius * view.margin) / Math.sin((view.fov * Math.PI) / 360)

try {
  const object = await load(`/view/mesh/file?src=${encodeURIComponent(src)}`)
  const box = new THREE.Box3().setFromObject(object)
  const sphere = box.getBoundingSphere(new THREE.Sphere())
  object.position.sub(sphere.center)
  scene.add(object)

  const camera = new THREE.PerspectiveCamera(view.fov, 1, sphere.radius / 100, sphere.radius * 100)
  camera.position
    .fromArray(view.dir)
    .normalize()
    .multiplyScalar(distanceFor(sphere.radius))
  camera.lookAt(0, 0, 0)
  renderer.render(scene, camera)
} catch (err) {
  // Nothing drawn, which is what the daemon checks the poster for: the shot
  // comes back empty and the artifact is declined rather than landing as a
  // blank card nobody can explain.
  console.error(`[meshview] ${src}: ${err?.message ?? err}`)
}
