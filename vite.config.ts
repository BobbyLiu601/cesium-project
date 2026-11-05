import { fileURLToPath, URL } from 'node:url'

import { defineConfig, normalizePath } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import vueDevTools from 'vite-plugin-vue-devtools'

const cesiumSource = normalizePath(
  fileURLToPath(new URL('./node_modules/cesium/Build/Cesium', import.meta.url)),
)
const cesiumBaseUrl = 'cesium'
const isVitest = Boolean(process.env.VITEST)
const cesiumStaticTargets = ['Assets', 'ThirdParty', 'Widgets', 'Workers'].map((directory) => ({
  src: `${cesiumSource}/${directory}/**/*`,
  dest: cesiumBaseUrl,
  rename: { stripBase: 4 },
}))

// https://vite.dev/config/
export default defineConfig({
  cacheDir: fileURLToPath(new URL('./.cache/vite', import.meta.url)),
  optimizeDeps: {
    include: ['cesium'],
  },
  build: {
    manifest: true,
  },
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  plugins: [
    vue(),
    ...(isVitest
      ? []
      : [
          vueDevTools(),
          viteStaticCopy({
            targets: cesiumStaticTargets,
          }),
        ]),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
