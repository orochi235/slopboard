import type { StackParams } from '@/params.ts'

const kebab = (key: string) => key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)

/**
 * The color params as custom properties on the root, so the DOM chrome reads
 * the same surface the scene does. Alpha variants stay in the stylesheets as
 * `color-mix`, which keeps one entry per real color rather than one per use.
 */
export function applyColors(colors: StackParams['colors'], root: HTMLElement): void {
  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${kebab(key)}`, value)
  }
}
