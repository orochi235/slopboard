import * as THREE from 'three'

/** Typed so that writing a uniform the shader does not declare is a type error
 *  rather than an assignment into a fresh property that nothing ever reads. */
export type SkyUniforms = {
  uBase: { value: THREE.Color }
  uGlow: { value: THREE.Color }
  uSpread: { value: number }
  uAspect: { value: number }
  uOrient: { value: THREE.Matrix3 }
  uScale: { value: number }
  uOctaves: { value: number }
  uIntensity: { value: number }
  uContrast: { value: number }
  uStarDensity: { value: number }
  uStarIntensity: { value: number }
}

export type SkyMaterial = THREE.ShaderMaterial & { uniforms: SkyUniforms }

/**
 * An authored hex kept raw. three converts a colour into its linear working
 * space on the way in, and built-in materials convert back on the way out —
 * but this shader writes gl_FragColor straight to an sRGB framebuffer, so a
 * converted value renders several stops too dark. `Color.set` is the obvious
 * call and the wrong one.
 */
export function srgb(color: THREE.Color, hex: string): THREE.Color {
  return color.setStyle(hex, THREE.NoColorSpace)
}

/** Sky spread as the tangent of its half-angle, which is what the ray wants. */
export function spreadOf(degrees: number): number {
  return Math.tan((Math.max(1, Math.min(179, degrees)) * Math.PI) / 360)
}

/**
 * The wall's backdrop: procedural cloud and stars over a full-screen quad,
 * shaded by a view ray built from the camera's orientation rather than its
 * projection. Nothing about it is in the scene's space, so it cannot be
 * clipped by the orthographic slab, picked, or occlude a card.
 */
export function createSkyMaterial(): SkyMaterial {
  return new THREE.ShaderMaterial({
    depthTest: false,
    depthWrite: false,
    uniforms: {
      uBase: { value: srgb(new THREE.Color(), '#05060a') },
      uGlow: { value: srgb(new THREE.Color(), '#2b3f6b') },
      uSpread: { value: spreadOf(90) },
      uAspect: { value: 1 },
      uOrient: { value: new THREE.Matrix3() },
      uScale: { value: 1.6 },
      uOctaves: { value: 4 },
      uIntensity: { value: 0.45 },
      uContrast: { value: 1.7 },
      uStarDensity: { value: 0.35 },
      uStarIntensity: { value: 0.5 },
    },
    // The quad is already in clip space, so neither matrix is consulted. That
    // is also why the mesh needs no camera-relative position of its own.
    vertexShader: /* glsl */ `
      varying vec2 vNdc;
      void main() {
        vNdc = position.xy;
        gl_Position = vec4(position.xy, 1.0, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uBase;
      uniform vec3 uGlow;
      uniform float uSpread;
      uniform float uAspect;
      uniform mat3 uOrient;
      uniform float uScale;
      uniform float uOctaves;
      uniform float uIntensity;
      uniform float uContrast;
      uniform float uStarDensity;
      uniform float uStarIntensity;
      varying vec2 vNdc;

      float hash(vec3 p) {
        return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float vnoise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float n000 = hash(i);
        float n100 = hash(i + vec3(1.0, 0.0, 0.0));
        float n010 = hash(i + vec3(0.0, 1.0, 0.0));
        float n110 = hash(i + vec3(1.0, 1.0, 0.0));
        float n001 = hash(i + vec3(0.0, 0.0, 1.0));
        float n101 = hash(i + vec3(1.0, 0.0, 1.0));
        float n011 = hash(i + vec3(0.0, 1.0, 1.0));
        float n111 = hash(i + vec3(1.0, 1.0, 1.0));
        return mix(
          mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
          mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y),
          f.z
        );
      }

      // Fixed trip count with a runtime cutoff: a loop bounded by a uniform
      // will not compile on every driver this has to run on.
      float fbm(vec3 p) {
        float sum = 0.0;
        float weight = 0.0;
        float amp = 0.5;
        vec3 q = p;
        for (int i = 0; i < 6; i++) {
          if (float(i) >= uOctaves) break;
          sum += amp * vnoise(q);
          weight += amp;
          q *= 2.02;
          amp *= 0.5;
        }
        return weight > 0.0 ? sum / weight : 0.0;
      }

      /** A sparse point per cell of the sky shell, sized to a pixel or two. */
      float stars(vec3 dir) {
        if (uStarDensity <= 0.0) return 0.0;
        vec3 g = dir * 180.0;
        vec3 cell = floor(g);
        float pick = hash(cell + 17.0);
        if (pick > uStarDensity * 0.08) return 0.0;
        vec3 at = cell + vec3(hash(cell + 1.0), hash(cell + 2.0), hash(cell + 3.0));
        float d = length(g - at);
        return smoothstep(0.5, 0.0, d) * (0.4 + 0.6 * hash(cell + 5.0));
      }

      void main() {
        vec3 dir = normalize(uOrient * vec3(vNdc.x * uAspect * uSpread, vNdc.y * uSpread, -1.0));

        float cloud = pow(clamp(fbm(dir * uScale * 3.0), 0.0, 1.0), uContrast);
        vec3 color = mix(uBase, uGlow, cloud * uIntensity);
        color += uGlow * stars(dir) * uStarIntensity;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }) as SkyMaterial
}
