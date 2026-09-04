import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { createSkyMaterial, spreadOf, srgb } from '@/backends/sky.ts'
import type { StackParams } from '@/params.ts'

/**
 * The wall's backdrop. Rendered after the wall so its frame callback reads a
 * camera the wall has already aimed this frame, and behind everything by
 * render order rather than by position — the quad never leaves clip space.
 */
export function Sky({
  settings,
  colors,
}: {
  settings: StackParams['sky']
  colors: StackParams['colors']
}) {
  const { gl, camera } = useThree()

  const mesh = useMemo(() => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), createSkyMaterial())
    // Its vertices are already clip coordinates, so culling it against the
    // frustum would cull it from the one place it belongs.
    m.frustumCulled = false
    m.raycast = () => null
    // One behind the zone backdrops.
    m.renderOrder = -2
    return m
  }, [])

  // Scratch, because this runs every frame the wall draws.
  const scratch = useMemo(() => new THREE.Matrix4(), [])

  useEffect(
    () => () => {
      mesh.geometry.dispose()
      mesh.material.dispose()
    },
    [mesh],
  )

  useFrame(() => {
    mesh.visible = settings.enabled
    if (!settings.enabled) return

    const u = mesh.material.uniforms
    srgb(u.uBase.value, colors.skyBase)
    srgb(u.uGlow.value, colors.skyGlow)
    u.uSpread.value = spreadOf(settings.spreadDeg)
    u.uAspect.value = gl.domElement.clientWidth / Math.max(1, gl.domElement.clientHeight)
    u.uScale.value = settings.scale
    u.uOctaves.value = settings.octaves
    u.uIntensity.value = settings.intensity
    u.uContrast.value = settings.contrast
    u.uStarDensity.value = settings.starDensity
    u.uStarIntensity.value = settings.starIntensity

    // From the quaternion rather than the world matrix: `lookAt` writes the
    // quaternion synchronously, while the matrix is not recomputed until the
    // renderer walks the scene, a frame after the camera moved.
    u.uOrient.value.setFromMatrix4(scratch.makeRotationFromQuaternion(camera.quaternion))
  })

  return <primitive object={mesh} />
}
