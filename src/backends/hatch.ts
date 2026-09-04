import * as THREE from 'three'

/**
 * A zone's backdrop: flat fill, or lines ruled in world space so the hatch
 * reads at one density across the wall however the cells are sized. Procedural
 * rather than a tiled texture, so it stays crisp at any zoom and costs the
 * texture budget nothing.
 */
export function createBackdropMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color('#64748b') },
      uOpacity: { value: 0.14 },
      uSpacing: { value: 0.014 },
      uWidth: { value: 0.001 },
      uAngle: { value: Math.PI / 4 },
      uSolid: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vWorld;
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vWorld = world.xy;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      uniform float uSpacing;
      uniform float uWidth;
      uniform float uAngle;
      uniform float uSolid;
      varying vec2 vWorld;

      void main() {
        float cover = 1.0;
        if (uSolid < 0.5) {
          float d = vWorld.x * cos(uAngle) + vWorld.y * sin(uAngle);
          // Distance to the nearest ruled line, in world units.
          float gap = abs(fract(d / uSpacing) - 0.5) * uSpacing;
          float aa = max(fwidth(d), 1e-6);
          cover = 1.0 - smoothstep(uWidth * 0.5 - aa, uWidth * 0.5 + aa, gap);
        }
        if (cover <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * cover);
      }
    `,
  })
}
