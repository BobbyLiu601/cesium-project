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

const ELEVATION_SERVICE_URL =
  'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer'
const ELEVATION_POSITION = {
  longitude: 113.72,
  latitude: 23.61,
  height: 15_000,
}

const container = ref<HTMLDivElement | null>(null)
const cesiumState = ref<'loading' | 'ready' | 'error'>('loading')
let session: GlobeSession | undefined
let cancelled = false

function resize() {
  session?.viewer.resize()
  session?.viewer.scene.requestRender()
}

async function enableElevation(currentSession: GlobeSession) {
  try {
    const terrainProvider =
      await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(ELEVATION_SERVICE_URL)

    if (cancelled || getActiveSession() !== currentSession) {
      return
    }

    currentSession.viewer.terrainProvider = terrainProvider
    currentSession.viewer.scene.requestRender()
    currentSession.viewer.scene.globe.enableLighting = true
    currentSession.viewer.scene.verticalExaggeration = 1.5
    currentSession.viewer.scene.requestRender()
    currentSession.viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        ELEVATION_POSITION.longitude,
        ELEVATION_POSITION.latitude,
        ELEVATION_POSITION.height,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-35),
        roll: 0,
      },
    })
    currentSession.viewer.scene.requestRender()
  } catch (error) {
    if (!cancelled && getActiveSession() === currentSession) {
      console.error('Cesium 高程图层加载失败', error)
    }
  }
}

function createSession() {
  if (!container.value) {
    cesiumState.value = 'error'
    return
  }

  disposeActiveSession()

  let host: HTMLDivElement | undefined

  try {
    host = document.createElement('div')
    host.className = 'elevation-globe__viewer'

    const creditContainer = document.createElement('div')
    creditContainer.className = 'elevation-globe__credits'
    creditContainer.dataset.testid = 'elevation-credit-container'
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

    session = {
      cleanup: removeTileLoadProgressListener,
      host,
      viewer,
    }
    setActiveSession(session)

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

    if (typeof ResizeObserver !== 'undefined') {
      session.resizeObserver = new ResizeObserver(resize)
      session.resizeObserver.observe(host)
    }

    container.value.replaceChildren(host)
    viewer.scene.requestRender()
    cesiumState.value = 'ready'
    void enableElevation(session)
  } catch (error) {
    if (session) {
      disposeGlobeSession(session)
      session = undefined
    }

    host?.remove()
    console.error('Cesium 高程场景初始化失败', error)
    cesiumState.value = 'error'
  }
}

onMounted(createSession)

onBeforeUnmount(() => {
  cancelled = true

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
    class="elevation-globe"
    data-testid="elevation-globe"
    :data-cesium-state="cesiumState"
  ></div>
</template>

<style scoped>
.elevation-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.elevation-globe :deep(.elevation-globe__viewer) {
  position: absolute;
  inset: 0;
}

.elevation-globe :deep(.elevation-globe__credits),
.elevation-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.elevation-globe :deep(.cesium-viewer),
.elevation-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}
</style>
