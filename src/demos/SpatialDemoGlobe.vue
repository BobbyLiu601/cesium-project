<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElDatePicker, ElTimePicker } from 'element-plus'

import type { SpatialSceneId } from '@/data/layers'
import {
  aspectLegend,
  aspectLegendGradient,
  createSpatialScene,
  type SpatialScene,
  type SunlightRange,
} from '@/demos/spatialScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: SpatialSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const sunlightDate = ref('2020-10-20')
const sunlightStart = ref('08:00')
const sunlightEnd = ref('18:00')

const isSunlightScene = computed(() => props.sceneId === 'sunlight-analysis')
const isAspectScene = computed(() => props.sceneId === 'aspect-analysis')

const sunlightRange = computed<SunlightRange>(() => ({
  date: sunlightDate.value,
  startTime: sunlightStart.value,
  endTime: sunlightEnd.value,
}))

const { actions, resize, runAction, scene, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '空间分析示例操作失败',
  container,
  creditTestId: 'spatial-credit-container',
  errorLabel: 'Cesium 空间分析示例初始化失败',
  errorStatus: '空间分析场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 空间分析场景…',
  loadScene: ({ viewer, setStatus, signal }) =>
    createSpatialScene(viewer, props.sceneId, setStatus, {
      signal,
      sunlight: sunlightRange.value,
    }),
  sceneId: props.sceneId,
  scenePrefix: 'spatial-demo-globe',
})

watch(sunlightRange, (range) => {
  if (!isSunlightScene.value) {
    return
  }
  ;(scene.value as SpatialScene | undefined)?.applySunlightRange?.(range)
})

defineExpose({ resize })
</script>

<template>
  <div
    class="spatial-demo-globe"
    data-testid="spatial-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
  >
    <div ref="container" class="spatial-demo-globe__canvas"></div>
    <div v-if="sceneState === 'loading'" class="spatial-demo-globe__notice" aria-live="polite">
      正在加载空间分析场景…
    </div>
    <div v-else-if="sceneState === 'error'" class="spatial-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="spatial-demo-globe__toolbar">
      <p class="spatial-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>
      <div v-if="actions.length" class="spatial-demo-globe__actions">
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

      <div v-if="isSunlightScene" class="spatial-demo-globe__sunlight-controls">
        <ElDatePicker
          v-model="sunlightDate"
          class="spatial-demo-globe__date"
          type="date"
          value-format="YYYY-MM-DD"
          format="YYYY-MM-DD"
          aria-label="日照日期"
          placeholder="选择日期"
        />
        <ElTimePicker
          v-model="sunlightStart"
          class="spatial-demo-globe__time"
          value-format="HH:mm"
          format="HH:mm"
          aria-label="开始时间"
          placeholder="开始时间"
        />
        <ElTimePicker
          v-model="sunlightEnd"
          class="spatial-demo-globe__time"
          value-format="HH:mm"
          format="HH:mm"
          aria-label="结束时间"
          placeholder="结束时间"
        />
      </div>
    </div>

    <div
      v-if="sceneState === 'ready' && isAspectScene"
      class="spatial-demo-globe__legend"
      data-testid="aspect-legend"
      aria-label="坡向颜色图例"
    >
      <span class="spatial-demo-globe__legend-title">坡向坡度</span>
      <span class="spatial-demo-globe__legend-min">{{ aspectLegend.minLabel }}</span>
      <span
        class="spatial-demo-globe__legend-gradient"
        :style="{ background: aspectLegendGradient }"
        aria-hidden="true"
      ></span>
      <span class="spatial-demo-globe__legend-max">{{ aspectLegend.maxLabel }}</span>
    </div>
  </div>
</template>

<style scoped>
.spatial-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.spatial-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.spatial-demo-globe :deep(.spatial-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.spatial-demo-globe :deep(.spatial-demo-globe__credits),
.spatial-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.spatial-demo-globe :deep(.cesium-viewer),
.spatial-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.spatial-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  width: min(470px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  pointer-events: none;
  background: rgb(10 27 43 / 84%);
  border: 1px solid rgb(255 255 255 / 14%);
  border-radius: 8px;
  box-shadow: 0 10px 30px rgb(0 0 0 / 25%);
  backdrop-filter: blur(8px);
}

.spatial-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #d8e5ef;
}

.spatial-demo-globe__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  pointer-events: auto;
}

.spatial-demo-globe__sunlight-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
  pointer-events: auto;
}

.spatial-demo-globe__date {
  width: 150px;
}

.spatial-demo-globe__time {
  width: 108px;
}

.spatial-demo-globe__legend {
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

.spatial-demo-globe__legend-title {
  font-weight: 600;
  color: #ffffff;
}

.spatial-demo-globe__legend-gradient {
  display: inline-block;
  width: 190px;
  height: 10px;
  border: 1px solid rgb(255 255 255 / 45%);
  border-radius: 999px;
}

.spatial-demo-globe__notice {
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
  .spatial-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .spatial-demo-globe__status {
    font-size: 12px;
  }

  .spatial-demo-globe__legend {
    bottom: 10px;
    left: 10px;
    max-width: calc(100% - 20px);
  }
}
</style>
