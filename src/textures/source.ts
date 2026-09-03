export type Rgb = { r: number; g: number; b: number }

/** Injected so the loader is testable with no browser. */
export type Decoder = {
  fetch: typeof globalThis.fetch
  createImageBitmap: typeof globalThis.createImageBitmap
}

const browserDecoder = (): Decoder => ({
  fetch: globalThis.fetch.bind(globalThis),
  createImageBitmap: globalThis.createImageBitmap.bind(globalThis),
})

/**
 * Decode straight to `edge`, so a card that will be five pixels wide never
 * costs a full-size frame. Null rather than a throw: this runs under a frame
 * loop, where one dead image must not take the wall down.
 */
export async function loadBitmap(
  url: string,
  edge: number,
  decoder: Decoder = browserDecoder(),
): Promise<ImageBitmap | null> {
  try {
    const res = await decoder.fetch(url)
    if (!res.ok) return null
    return await decoder.createImageBitmap(await res.blob(), {
      resizeWidth: edge,
      resizeHeight: edge,
      resizeQuality: 'medium',
      // three ignores Texture.flipY for an ImageBitmap source, so the one flip
      // between a top-left decode and WebGL's bottom-left texture origin has to
      // happen here. Without it every card renders upside down.
      imageOrientation: 'flipY',
    })
  } catch {
    return null
  }
}

/** The past-the-fade tier draws a flat quad in this color instead of a texture. */
export function averageColorOf(bitmap: ImageBitmap, canvas: HTMLCanvasElement): Rgb {
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return { r: 0.5, g: 0.5, b: 0.5 }
  ctx.drawImage(bitmap, 0, 0, 1, 1)
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data
  return { r: r! / 255, g: g! / 255, b: b! / 255 }
}
