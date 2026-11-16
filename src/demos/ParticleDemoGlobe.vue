<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton } from 'element-plus'

import type { ParticleSceneId } from '@/data/layers'
import { createParticleScene } from '@/demos/particles/particleScene'
import type { ParticleEffectsScene } from '@/demos/particles/types'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: ParticleSceneId
}>()

const container = ref<HTMLDivElement | null>(null)

const { imageryState, resize, scene, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '粒子效果示例操作失败',
  container,
  creditTestId: 'particle-credit-container',
  errorLabel: 'Cesium 粒子效果示例初始化失败',
  errorStatus: '粒子效果加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 粒子效果…',
  loadScene: async ({ setStatus, viewer }) => createParticleScene(viewer, props.sceneId, setStatus),
  sceneId: props.sceneId,
  scenePrefix: 'particle-demo-globe',
})

const particleScene = computed(() => scene.value as ParticleEffectsScene | undefined)
const paused = computed(() => particleScene.value?.paused.value ?? false)
const pauseLabel = computed(() => (paused.value ? '继续' : '暂停'))
const pauseAriaLabel = computed(() => (paused.value ? '继续粒子效果' : '暂停粒子效果'))

function togglePause() {
  if (!particleScene.value) {
    return
  }

  if (paused.value) {
    particleScene.value.resume()
  } else {
    particleScene.value.pause()
  }
}

defineExpose({ resize })
</script>

<template>
  <div
    class="particle-demo-globe"
    data-testid="particle-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
    :data-imagery-state="imageryState"
    :data-paused="paused"
  >
    <div ref="container" class="particle-demo-globe__canvas"></div>
    <div v-if="sceneState === 'loading'" class="particle-demo-globe__notice" aria-live="polite">
      正在加载粒子效果…
    </div>
    <div v-else-if="sceneState === 'error'" class="particle-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="particle-demo-globe__toolbar">
      <p class="particle-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>
      <p v-if="imageryState === 'unavailable'" class="particle-demo-globe__imagery-note">
        天地图影像不可用，粒子效果已独立加载
      </p>
      <ElButton
        class="particle-demo-globe__toggle"
        size="small"
        type="primary"
        :aria-label="pauseAriaLabel"
        :aria-pressed="paused"
        @click="togglePause"
      >
        {{ pauseLabel }}
      </ElButton>
    </div>
  </div>
</template>

<style scoped>
.particle-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.particle-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.particle-demo-globe :deep(.particle-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.particle-demo-globe :deep(.particle-demo-globe__credits),
.particle-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.particle-demo-globe :deep(.cesium-viewer),
.particle-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.particle-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  width: min(420px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  background: rgb(9 24 38 / 86%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 30%);
  backdrop-filter: blur(10px);
}

.particle-demo-globe__status {
  flex: 1 1 220px;
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #e4edf5;
}

.particle-demo-globe__imagery-note {
  flex: 1 1 100%;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  color: #f0c88b;
}

.particle-demo-globe__notice {
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
  .particle-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .particle-demo-globe__status {
    font-size: 12px;
  }
}
</style>
