<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import { createTiandituTileUrl, getTiandituToken, tiandituLayers } from '@/config/tianditu'
import {
  disposeActiveSession,
  disposeGlobeSession,
  getActiveSession,
  setActiveSession,
  type GlobeSession,
} from '@/components/cesiumGlobeSession'
import { createRadarEffect, RADAR_SITE, type RadarEffect } from '@/components/radarEffect'

const container = ref<HTMLDivElement | null>(null)
const cesiumState = ref<'loading' | 'ready' | 'error'>('loading')
let session: GlobeSession | undefined
let radarEffect: RadarEffect | undefined
let cancelled = false

function resize() {
  session?.viewer.resize()
  session?.viewer.scene.requestRender()
}

async function createSession() {
  if (!container.value) {
    cesiumState.value = 'error'
    return
  }

  disposeActiveSession()

  let host: HTMLDivElement | undefined

  try {
    host = document.createElement('div')
    host.className = 'radar-globe__viewer'

    const creditContainer = document.createElement('div')
    creditContainer.className = 'radar-globe__credits'
    creditContainer.dataset.testid = 'radar-credit-container'
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

    const removeTileLoadProgressListener =
      viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
        viewer.scene.requestRender()
      })

    const viewerSession: GlobeSession = {
      cleanup: removeTileLoadProgressListener,
      host,
      viewer,
    }
    session = viewerSession
    setActiveSession(viewerSession)

    const token = getTiandituToken()
    if (!token) {
      console.error('未配置 VITE_TIANDITU_TOKEN，已跳过天地图图层。')
    }

    const layers = token ? tiandituLayers : []
    for (const layer of layers) {
      const imageryLayer = viewer.imageryLayers.addImageryProvider(
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

      if (layer.id === 'cia') {
        imageryLayer.alpha = 0.5
      } else {
        imageryLayer.brightness = 0.78
        imageryLayer.contrast = 1.08
      }
    }

    viewer.scene.globe.enableLighting = false
    viewer.scene.backgroundColor = new Cesium.Color(0.015, 0.04, 0.075, 1)

    const center = Cesium.Cartesian3.fromDegrees(RADAR_SITE.longitude, RADAR_SITE.latitude)
    viewer.camera.lookAt(
      center,
      new Cesium.HeadingPitchRange(Cesium.Math.toRadians(24), Cesium.Math.toRadians(-42), 9_000),
    )
    viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)

    radarEffect = await createRadarEffect(
      viewer,
      () => cancelled || getActiveSession() !== viewerSession || viewer.isDestroyed(),
    )
    if (cancelled || getActiveSession() !== viewerSession) {
      radarEffect.destroy()
      radarEffect = undefined
      return
    }
    viewerSession.cleanup = () => {
      removeTileLoadProgressListener()
      radarEffect?.destroy()
      radarEffect = undefined
    }

    if (typeof ResizeObserver !== 'undefined') {
      viewerSession.resizeObserver = new ResizeObserver(resize)
      viewerSession.resizeObserver.observe(host)
    }

    container.value.replaceChildren(host)
    viewer.scene.requestRender()
    cesiumState.value = 'ready'
  } catch (error) {
    radarEffect?.destroy()
    radarEffect = undefined

    if (session) {
      disposeGlobeSession(session)
      session = undefined
    }

    host?.remove()
    console.error('Cesium 雷达场景初始化失败', error)
    cesiumState.value = 'error'
  }
}

onMounted(() => {
  void createSession()
})

onBeforeUnmount(() => {
  cancelled = true
  radarEffect?.destroy()
  radarEffect = undefined

  if (session) {
    if (getActiveSession() === session) {
      disposeGlobeSession(session)
    }
    session = undefined
  }
})

defineExpose({ resize })
</script>

<template>
  <div
    ref="container"
    class="radar-globe"
    data-testid="radar-globe"
    :data-cesium-state="cesiumState"
  ></div>
</template>

<style scoped>
.radar-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #04101d;
}

.radar-globe :deep(.radar-globe__viewer) {
  position: absolute;
  inset: 0;
}

.radar-globe :deep(.radar-globe__credits),
.radar-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.radar-globe :deep(.cesium-viewer),
.radar-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}
</style>
