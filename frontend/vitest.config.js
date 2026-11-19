import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

const assessmentSrcDir = fileURLToPath(new URL('./src/assessment-module', import.meta.url))

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  resolve: {
    alias: {
      '@assessment': assessmentSrcDir,
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/assessment/components/**/*.test.js'],
    restoreMocks: true,
  },
})
