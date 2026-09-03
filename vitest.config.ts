import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      windease: fileURLToPath(new URL('../windease/src/index.ts', import.meta.url)),
    },
  },
  test: { include: ['{src,server}/**/*.test.ts'] },
})
