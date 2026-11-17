<script setup lang="ts">
import { computed, ref } from 'vue'

import type { VisualizationSceneId } from '@/data/layers'
import {
  createVisualizationScene,
  isosurfaceBreaks,
  isosurfaceColors,
} from '@/demos/visualizationScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: VisualizationSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const isIsosurface = computed(() => props.sceneId === 'isosurface')
const legendGradient = `linear-gradient(90deg, ${isosurfaceColors.join(', ')})`
const legendMaximum = isosurfaceBreaks[isosurfaceBreaks.length - 2] ?? 9

const { resize, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: 'GIS 客户端示例操作失败',
  container,
  creditTestId: 'visualization-credit-container',
  errorLabel: 'Cesium GIS 客户端示例初始化失败',
  errorStatus: 'GIS 客户端场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium GIS 客户端场景…',
  loadScene: ({ viewer, setStatus, signal }) =>
    createVisualizationScene(viewer, props.sceneId, setStatus, { signal }),
  sceneId: props.sceneId,
  scenePrefix: 'visualization-demo-globe',
})

defineExpose({ resize })
</script>

<template>
  <div
    class="visualization-demo-globe"
    data-testid="visualization-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
  >
    <div ref="container" class="visualization-demo-globe__canvas"></div>
    <div
      v-if="sceneState === 'loading'"
      class="visualization-demo-globe__notice"
      aria-live="polite"
    >
      正在加载 GIS 客户端场景…
    </div>
    <div v-else-if="sceneState === 'error'" class="visualization-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="visualization-demo-globe__toolbar">
      <p class="visualization-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>
    </div>

    <div
      v-if="sceneState === 'ready' && isIsosurface"
      class="visualization-demo-globe__legend"
      data-testid="isosurface-legend"
      aria-label="风速等值面图例"
    >
      <span class="visualization-demo-globe__legend-title">风速等值面（m/s）</span>
      <span class="visualization-demo-globe__legend-min">0</span>
      <span
        class="visualization-demo-globe__legend-gradient"
        :style="{ background: legendGradient }"
        aria-hidden="true"
      ></span>
      <span class="visualization-demo-globe__legend-max">{{ legendMaximum }}+</span>
    </div>
  </div>
</template>

<style scoped>
.visualization-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.visualization-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.visualization-demo-globe :deep(.visualization-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.visualization-demo-globe :deep(.visualization-demo-globe__credits),
.visualization-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.visualization-demo-globe :deep(.cesium-viewer),
.visualization-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.visualization-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  width: min(460px, calc(100% - 32px));
  padding: 12px 14px;
  color: #e8eef6;
  background: rgb(10 27 43 / 84%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
  backdrop-filter: blur(8px);
}

.visualization-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #d8e5ef;
}

.visualization-demo-globe__legend {
  position: absolute;
  bottom: 16px;
  left: 16px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  max-width: min(540px, calc(100% - 32px));
  padding: 10px 12px;
  font-size: 12px;
  color: #d8e5ef;
  background: rgb(10 27 43 / 84%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  backdrop-filter: blur(8px);
}

.visualization-demo-globe__legend-title {
  font-weight: 600;
  color: #ffffff;
}

.visualization-demo-globe__legend-gradient {
  display: inline-block;
  width: 190px;
  height: 10px;
  border: 1px solid rgb(255 255 255 / 45%);
  border-radius: 999px;
}

.visualization-demo-globe__notice {
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
  .visualization-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .visualization-demo-globe__status {
    font-size: 12px;
  }

  .visualization-demo-globe__legend {
    bottom: 10px;
    left: 10px;
    max-width: calc(100% - 20px);
  }
}
</style>
