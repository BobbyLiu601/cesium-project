<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton } from 'element-plus'

import type { SpecialShapeSceneId } from '@/data/layers'
import { createSpecialShapeScene, type SpecialShapeScene } from '@/demos/specialShapeScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: SpecialShapeSceneId
}>()

const container = ref<HTMLDivElement | null>(null)

const { resize, scene, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '特殊形状示例操作失败',
  container,
  creditTestId: 'special-shapes-credit-container',
  errorLabel: 'Cesium 特殊形状示例初始化失败',
  errorStatus: '特殊形状场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 特殊形状场景…',
  loadScene: ({ setStatus, signal, viewer }) =>
    createSpecialShapeScene(viewer, props.sceneId, setStatus, { signal }),
  sceneId: props.sceneId,
  scenePrefix: 'special-shapes-demo-globe',
})

const specialShapeScene = computed(() => scene.value as SpecialShapeScene | undefined)
const animationState = computed(() => specialShapeScene.value?.animationState?.value)
const canToggleAnimation = computed(() =>
  Boolean(specialShapeScene.value?.toggleAnimation && animationState.value),
)
const animationLabel = computed(() => (animationState.value === 'paused' ? '继续播放' : '暂停动画'))

function toggleAnimation() {
  specialShapeScene.value?.toggleAnimation?.()
}

defineExpose({ resize })
</script>

<template>
  <div
    class="special-shapes-demo-globe"
    data-testid="special-shapes-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
    :data-animation-state="animationState"
  >
    <div ref="container" class="special-shapes-demo-globe__canvas"></div>
    <div
      v-if="sceneState === 'loading'"
      class="special-shapes-demo-globe__notice"
      aria-live="polite"
    >
      正在加载特殊形状场景…
    </div>
    <div v-else-if="sceneState === 'error'" class="special-shapes-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="special-shapes-demo-globe__toolbar">
      <p class="special-shapes-demo-globe__status" aria-live="polite">
        {{ statusMessage }}
      </p>
      <ElButton
        v-if="canToggleAnimation"
        size="small"
        plain
        :aria-pressed="animationState === 'playing'"
        @click="toggleAnimation"
      >
        {{ animationLabel }}
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.special-shapes-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.special-shapes-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.special-shapes-demo-globe :deep(.special-shapes-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.special-shapes-demo-globe :deep(.special-shapes-demo-globe__credits),
.special-shapes-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.special-shapes-demo-globe :deep(.cesium-viewer),
.special-shapes-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.special-shapes-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  width: min(520px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  background: rgb(9 24 38 / 86%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 30%);
  backdrop-filter: blur(10px);
}

.special-shapes-demo-globe__status {
  flex: 1 1 260px;
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #e4edf5;
}

.special-shapes-demo-globe__notice {
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
  .special-shapes-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .special-shapes-demo-globe__status {
    font-size: 12px;
  }
}
</style>
