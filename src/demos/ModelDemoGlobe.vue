<script setup lang="ts">
import { ref } from 'vue'
import { ElButton } from 'element-plus'

import type { ModelSceneId } from '@/data/layers'
import { createModelScene } from '@/demos/modelScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: ModelSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const { actions, resize, runAction, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '模型示例操作失败',
  container,
  creditTestId: 'model-credit-container',
  errorLabel: 'Cesium 模型示例初始化失败',
  errorStatus: '模型场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 模型场景…',
  loadScene: ({ viewer, setStatus, signal }) =>
    createModelScene(viewer, props.sceneId, setStatus, { signal }),
  sceneId: props.sceneId,
  scenePrefix: 'model-demo-globe',
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
