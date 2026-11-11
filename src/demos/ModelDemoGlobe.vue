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
import type { ModelSceneId } from '@/data/layers'
import { createModelScene, type ModelAction, type ModelScene } from '@/demos/modelScene'

const props = defineProps<{
  sceneId: ModelSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const sceneState = ref<'loading' | 'ready' | 'error'>('loading')
const statusMessage = ref('正在准备 Cesium 模型场景…')
const actions = ref<ModelAction[]>([])
let session: GlobeSession | undefined
let modelScene: ModelScene | undefined
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

async function runAction(action: ModelAction) {
  try {
    await action.run()
  } catch (error) {
    console.error(`模型示例操作失败：${action.label}`, error)
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
    host.className = 'model-demo-globe__viewer'

    const creditContainer = document.createElement('div')
    creditContainer.className = 'model-demo-globe__credits'
    creditContainer.dataset.testid = 'model-credit-container'
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
    modelScene = await createModelScene(viewer, host, props.sceneId, setStatus)

    if (cancelled || getActiveSession() !== session) {
      modelScene.dispose()
      modelScene = undefined
      return
    }

    actions.value = modelScene.actions
    session.cleanup = () => {
      removeTileLoadProgressListener()
      modelScene?.dispose()
      modelScene = undefined
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
    modelScene?.dispose()
    modelScene = undefined

    if (session) {
      disposeGlobeSession(session)
      session = undefined
    }

    host?.remove()
    console.error(`Cesium 模型示例初始化失败：${props.sceneId}`, error)
    sceneState.value = 'error'
    statusMessage.value = '模型场景加载失败，请关闭后重试。'
  }
}

onMounted(() => {
  void createSession()
})

onBeforeUnmount(() => {
  cancelled = true
  clearScheduledRenders()
  modelScene?.dispose()
  modelScene = undefined

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
    class="model-demo-globe"
    data-testid="model-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
  >
    <div ref="container" class="model-demo-globe__canvas"></div>
    <div v-if="sceneState === 'loading'" class="model-demo-globe__notice" aria-live="polite">
      正在加载模型场景…
    </div>
    <div v-else-if="sceneState === 'error'" class="model-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="model-demo-globe__toolbar">
      <p class="model-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>
      <div v-if="actions.length" class="model-demo-globe__actions">
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
.model-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.model-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.model-demo-globe :deep(.model-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.model-demo-globe :deep(.model-demo-globe__credits),
.model-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.model-demo-globe :deep(.cesium-viewer),
.model-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.model-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  width: min(460px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  pointer-events: none;
  background: rgb(10 27 43 / 84%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
  backdrop-filter: blur(8px);
}

.model-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #d8e5ef;
}

.model-demo-globe__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  pointer-events: auto;
}

.model-demo-globe__notice {
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
  .model-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .model-demo-globe__status {
    font-size: 12px;
  }
}
</style>
