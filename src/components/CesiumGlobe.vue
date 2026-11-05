<script setup lang="ts">
import { onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { createTiandituTileUrl, getTiandituToken, tiandituLayers } from '@/config/tianditu'
import {
  disposeGlobeSession,
  getActiveSession,
  setActiveSession,
  type GlobeSession,
} from '@/components/cesiumGlobeSession'

const container = ref<HTMLDivElement | null>(null)
const cesiumState = ref<'loading' | 'ready' | 'error'>('loading')

function resize() {
  const activeSession = getActiveSession()
  activeSession?.viewer.resize()
  activeSession?.viewer.scene.requestRender()
}

function attachSession(session: GlobeSession) {
  if (!container.value) {
    cesiumState.value = 'error'
    return
  }

  container.value.replaceChildren(session.host)
  session.viewer.resize()
  session.viewer.scene.requestRender()
  cesiumState.value = 'ready'
}

function createSession() {
  if (!container.value) {
    cesiumState.value = 'error'
    return
  }

  let host: HTMLDivElement | undefined
  let session: GlobeSession | undefined

  try {
    host = document.createElement('div')
    host.className = 'cesium-globe__viewer'

    const creditContainer = document.createElement('div')
    creditContainer.className = 'cesium-globe__credits'
    creditContainer.dataset.testid = 'cesium-credit-container'
    creditContainer.hidden = true
    creditContainer.style.display = 'none'
    host.append(creditContainer)

    const viewer = new Cesium.Viewer(host, {
      animation: false,
      baseLayer: false,
      baseLayerPicker: false,
      creditContainer,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      navigationHelpButton: false,
      requestRenderMode: true,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    })

    session = {
      host,
      viewer,
    }

    const token = getTiandituToken()
    if (!token) {
      console.error('未配置 VITE_TIANDITU_TOKEN，已跳过天地图图层。')
    }

    const layers = token ? tiandituLayers : []
    for (const layer of layers) {
      viewer.imageryLayers.addImageryProvider(
        new Cesium.WebMapTileServiceImageryProvider({
          url: createTiandituTileUrl(layer.id, token),
          layer: layer.id,
          style: 'default',
          format: 'tiles',
          tileMatrixSetID: 'w',
          tilingScheme: new Cesium.WebMercatorTilingScheme(),
          maximumLevel: 18,
          subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
          credit: '天地图',
          enablePickFeatures: false,
        }),
      )
    }

    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(104, 30, 22_000_000),
    })
    viewer.scene.requestRender()

    if (typeof ResizeObserver !== 'undefined') {
      session.resizeObserver = new ResizeObserver(resize)
      session.resizeObserver.observe(host)
    }

    setActiveSession(session)
  } catch (error) {
    if (session) {
      disposeGlobeSession(session)
    }

    host?.remove()
    console.error('Cesium 三维地球初始化失败', error)
    cesiumState.value = 'error'
  }
}

onMounted(() => {
  if (!container.value) {
    cesiumState.value = 'error'
    return
  }

  const activeSession = getActiveSession()
  if (activeSession) {
    attachSession(activeSession)
    return
  }

  createSession()
  const session = getActiveSession()
  if (session) {
    attachSession(session)
  } else {
    cesiumState.value = 'error'
  }
})

defineExpose({ resize })
</script>

<template>
  <div
    ref="container"
    class="cesium-globe"
    data-testid="cesium-globe"
    :data-cesium-state="cesiumState"
  ></div>
</template>

<style scoped>
.cesium-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.cesium-globe :deep(.cesium-globe__viewer) {
  position: absolute;
  inset: 0;
}

.cesium-globe :deep(.cesium-globe__credits),
.cesium-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.cesium-globe :deep(.cesium-viewer),
.cesium-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}
</style>
