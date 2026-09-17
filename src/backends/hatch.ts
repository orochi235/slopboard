import * as THREE from 'three'

/**
 * A zone's backdrop: flat fill, or line art ruled in world space so the
 * pattern reads at one density across the wall however the cells are sized.
 * Procedural rather than a tiled texture, so it stays crisp at any zoom and
 * costs the texture budget nothing. `uPattern` picks the case, indexed by
 * `PATTERN_INDEX` in `src/backdrops.ts`; spacing, width and angle apply to
 * every pattern the same way.
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
      uPattern: { value: 1 },
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
      uniform int uPattern;
      varying vec2 vWorld;

      // Cover of lines ruled every \`spacing\` along \`d\`, \`width\` wide, antialiased.
      float lines(float d, float spacing, float width) {
        float gap = abs(fract(d / spacing) - 0.5) * spacing;
        float aa = max(fwidth(d), 1e-6);
        return 1.0 - smoothstep(width * 0.5 - aa, width * 0.5 + aa, gap);
      }

      void main() {
        float c = cos(uAngle);
        float s = sin(uAngle);
        // The wall turned by the angle: u runs across the ruling, v along it.
        float u = vWorld.x * c + vWorld.y * s;
        float v = -vWorld.x * s + vWorld.y * c;
        float cover = 1.0;
        if (uPattern == 1) {
          cover = lines(u, uSpacing, uWidth);
        } else if (uPattern == 2) {
          cover = max(lines(u, uSpacing, uWidth), lines(v, uSpacing, uWidth));
        } else if (uPattern == 3) {
          // Crosshatch turned a further 45 degrees.
          float a = (u + v) * 0.70710678;
          float b = (u - v) * 0.70710678;
          cover = max(lines(a, uSpacing, uWidth), lines(b, uSpacing, uWidth));
        } else if (uPattern == 4) {
          // Courses one spacing tall, bricks two long, each course shifted by
          // half a brick. The mortar is the line art.
          float row = floor(v / uSpacing);
          float shift = mod(row, 2.0) * uSpacing;
          cover = max(lines(v, uSpacing, uWidth), lines(u + shift, 2.0 * uSpacing, uWidth));
        } else if (uPattern == 5) {
          // A dot at the center of every cell. Never thinner than the line
          // width, never smaller than a tenth of the cell.
          vec2 cell = (vec2(fract(u / uSpacing), fract(v / uSpacing)) - 0.5) * uSpacing;
          float r = length(cell);
          float rad = max(uWidth, uSpacing * 0.12);
          float aa = max(fwidth(r), 1e-6);
          cover = 1.0 - smoothstep(rad - aa, rad + aa, r);
        } else if (uPattern == 6) {
          cover = mod(floor(u / uSpacing) + floor(v / uSpacing), 2.0);
        }
        if (cover <= 0.001) discard;
        gl_FragColor = vec4(uColor, uOpacity * cover);
      }
    `,
  })
}
