import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { scopeAssessmentCssPlugin } from './scripts/scopeAssessmentCss.mjs'

const assessmentSrcDir = fileURLToPath(new URL('./src/assessment-module', import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiProxyTarget = (env.VITE_API_PROXY_TARGET || process.env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8000').trim()
  const assessmentProxyTarget = (env.VITE_ASSESSMENT_PROXY_TARGET || process.env.VITE_ASSESSMENT_PROXY_TARGET || 'http://127.0.0.1:8002').trim()

  const sharedProxy = {
    '/api': {
      target: apiProxyTarget,
      changeOrigin: true,
    },
    '/assessment-api': {
      target: assessmentProxyTarget,
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/assessment-api/, '/api'),
    },
  }

  return {
    plugins: [
      react(),
      vue(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        '@assessment': assessmentSrcDir,
      },
    },

    css: {
      postcss: {
        plugins: [scopeAssessmentCssPlugin()],
      },
    },

    server: {
      port: 5173,
      proxy: sharedProxy,
    },

    preview: {
      port: 4173,
      proxy: sharedProxy,
    },
  }
})
