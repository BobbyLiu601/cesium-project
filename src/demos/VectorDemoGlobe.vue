<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import { ElButton } from 'element-plus'

import { createTiandituTileUrl, getTiandituToken, tiandituLayers } from '@/config/tianditu'
import {
  disposeActiveSession,
  disposeGlobeSession,
  getActiveSession,
  setActiveSession,
  type GlobeSession,
} from '@/components/cesiumGlobeSession'
import type { VectorSceneId } from '@/data/layers'
import { createVectorScene, type VectorAction, type VectorScene } from '@/demos/vectorScene'

const props = defineProps<{
  sceneId: VectorSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const sceneState = ref<'loading' | 'ready' | 'error'>('loading')
const statusMessage = ref('正在准备 Cesium 场景…')
const actions = ref<VectorAction[]>([])
let session: GlobeSession | undefined
let vectorScene: VectorScene | undefined
let cancelled = false
let renderTimers: ReturnType<typeof setTimeout>[] = []

function clearScheduledRenders() {
  renderTimers.forEach((timer) => clearTimeout(timer))
  renderTimers = []
}

function scheduleSceneRenders(viewer: Cesium.Viewer) {
  clearScheduledRenders()
  renderTimers = [120, 350, 750, 1_400, 2_400].map((delay) =>
    setTimeout(() => {
      if (getActiveSession() === session) {
        viewer.scene.requestRender()
      }
    }, delay),
  )
}

function resize() {
  session?.viewer.resize()
  session?.viewer.scene.requestRender()
}

function setStatus(message: string) {
  statusMessage.value = message
}

async function runAction(action: VectorAction) {
  try {
    await action.run()
  } catch (error) {
    console.error(`示例操作失败：${action.label}`, error)
    setStatus(`${action.label}失败，请重试`)
  }
}

async function createSession() {
  if (!container.value) {
    sceneState.value = 'error'
    statusMessage.value = '未找到 Cesium 容器'
    return
  }

  clearScheduledRenders()
  disposeActiveSession()

  let host: HTMLDivElement | undefined

  try {
    host = document.createElement('div')
    host.className = 'vector-demo-globe__viewer'

    const creditContainer = document.createElement('div')
    creditContainer.className = 'vector-demo-globe__credits'
    creditContainer.dataset.testid = 'vector-credit-container'
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

    container.value.replaceChildren(host)
    viewer.resize()
    vectorScene = await createVectorScene(viewer, host, props.sceneId, setStatus)

    if (cancelled || getActiveSession() !== session) {
      vectorScene.dispose()
      vectorScene = undefined
      return
    }

    actions.value = vectorScene.actions
    session.cleanup = () => {
      removeTileLoadProgressListener()
      vectorScene?.dispose()
      vectorScene = undefined
    }

    if (typeof ResizeObserver !== 'undefined') {
      session.resizeObserver = new ResizeObserver(resize)
      session.resizeObserver.observe(host)
    }

    viewer.resize()
    viewer.scene.requestRender()
    sceneState.value = 'ready'
    scheduleSceneRenders(viewer)
  } catch (error) {
    vectorScene?.dispose()
    vectorScene = undefined

    if (session) {
      disposeGlobeSession(session)
      session = undefined
    }

    host?.remove()
    console.error(`Cesium 矢量示例初始化失败：${props.sceneId}`, error)
    sceneState.value = 'error'
    statusMessage.value = '示例场景加载失败，请关闭后重试。'
  }
}

onMounted(() => {
  void createSession()
})

onBeforeUnmount(() => {
  cancelled = true
  clearScheduledRenders()
  vectorScene?.dispose()
  vectorScene = undefined

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
    class="vector-demo-globe"
    data-testid="vector-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
  >
    <div ref="container" class="vector-demo-globe__canvas"></div>
    <div v-if="sceneState === 'loading'" class="vector-demo-globe__notice" aria-live="polite">
      正在加载示例…
    </div>
    <div v-else-if="sceneState === 'error'" class="vector-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="vector-demo-globe__toolbar">
      <p class="vector-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>
      <div v-if="actions.length" class="vector-demo-globe__actions">
        <ElButton
          v-for="action in actions"
          :key="action.id"
          size="small"
          plain
          @click="runAction(action)"
        >
          {{ action.label }}
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.vector-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.vector-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.vector-demo-globe :deep(.vector-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.vector-demo-globe :deep(.vector-demo-globe__credits),
.vector-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.vector-demo-globe :deep(.cesium-viewer),
.vector-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.vector-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  width: min(440px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  pointer-events: none;
  background: rgb(10 27 43 / 84%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
  backdrop-filter: blur(8px);
}

.vector-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #d8e5ef;
}

.vector-demo-globe__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  pointer-events: auto;
}

.vector-demo-globe__notice {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 14px;
  color: #dbe9f3;
  background: #07111f;
}

@media (max-width: 767px) {
  .vector-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .vector-demo-globe__status {
    font-size: 12px;
  }
}
</style>
