<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus'

import type { VectorSceneId } from '@/data/layers'
import { createVectorScene } from '@/demos/vectorScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: VectorSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const { actions, resize, runAction, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '示例操作失败',
  container,
  creditTestId: 'vector-credit-container',
  errorLabel: 'Cesium 矢量示例初始化失败',
  errorStatus: '示例场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 场景…',
  loadScene: ({ viewer, host, setStatus }) =>
    createVectorScene(viewer, host, props.sceneId, setStatus),
  sceneId: props.sceneId,
  scenePrefix: 'vector-demo-globe',
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
