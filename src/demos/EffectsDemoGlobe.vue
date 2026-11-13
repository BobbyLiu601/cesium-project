<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElButton, ElSlider } from 'element-plus'

import type { EffectSceneId } from '@/data/layers'
import { createEffectsScene, type EffectsScene, type ThunderAudioState } from '@/demos/effectsScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: EffectSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const cloudX = ref(25)
const cloudY = ref(12)
const cloudBrightness = ref(1)

const { actions, resize, runAction, scene, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '场景特效示例操作失败',
  container,
  creditTestId: 'effects-credit-container',
  errorLabel: 'Cesium 场景特效示例初始化失败',
  errorStatus: '场景特效加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 场景特效…',
  loadScene: ({ setStatus, signal, viewer }) =>
    createEffectsScene(viewer, props.sceneId, setStatus, { signal }),
  sceneId: props.sceneId,
  scenePrefix: 'effects-demo-globe',
})

const effectScene = computed(() => scene.value as EffectsScene | undefined)
const isCloudScene = computed(() => props.sceneId === 'volumetric-cloud')
const isNearGroundScene = computed(() => props.sceneId === 'near-ground-skybox')
const nearGroundMode = computed(
  () => effectScene.value?.nearGroundControls?.mode.value ?? 'near-ground',
)
const audioState = computed<ThunderAudioState | undefined>(
  () => effectScene.value?.audioState?.value,
)

const audioMessage = computed(() => {
  switch (audioState.value) {
    case 'playing':
      return '雷声自动播放中，循环音轨已开启'
    case 'blocked':
      return '浏览器阻止了自动播放，请点击“重新播放雷声”'
    case 'error':
      return '当前浏览器无法播放雷声'
    default:
      return '正在尝试自动播放雷声…'
  }
})

function applyCloudParameters() {
  const controls = effectScene.value?.cloudControls
  if (!controls) {
    return
  }

  controls.setScale(cloudX.value, cloudY.value)
  controls.setBrightness(cloudBrightness.value)
}

async function retryAudio() {
  await effectScene.value?.retryAudio?.()
}

watch(
  [effectScene, cloudX, cloudY, cloudBrightness],
  () => {
    if (isCloudScene.value && sceneState.value === 'ready') {
      applyCloudParameters()
    }
  },
  { immediate: true },
)

defineExpose({ resize })
</script>

<template>
  <div
    class="effects-demo-globe"
    data-testid="effects-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
    :data-audio-state="audioState"
    :data-near-ground-mode="isNearGroundScene ? nearGroundMode : undefined"
  >
    <div ref="container" class="effects-demo-globe__canvas"></div>
    <div v-if="sceneState === 'loading'" class="effects-demo-globe__notice" aria-live="polite">
      正在加载场景特效…
    </div>
    <div v-else-if="sceneState === 'error'" class="effects-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div v-if="sceneState === 'ready'" class="effects-demo-globe__toolbar">
      <p class="effects-demo-globe__status" aria-live="polite">{{ statusMessage }}</p>

      <div v-if="actions.length" class="effects-demo-globe__actions">
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

      <div v-if="isCloudScene" class="effects-demo-globe__controls">
        <label class="effects-demo-globe__control">
          <span
            >X 轴尺寸 <strong>{{ cloudX }}</strong></span
          >
          <ElSlider v-model="cloudX" :min="5" :max="2500" :step="1" />
        </label>
        <label class="effects-demo-globe__control">
          <span
            >Y 轴尺寸 <strong>{{ cloudY }}</strong></span
          >
          <ElSlider v-model="cloudY" :min="5" :max="1500" :step="1" />
        </label>
        <label class="effects-demo-globe__control">
          <span
            >亮度 <strong>{{ cloudBrightness.toFixed(2) }}</strong></span
          >
          <ElSlider v-model="cloudBrightness" :min="0" :max="1" :step="0.01" />
        </label>
      </div>

      <div v-if="isNearGroundScene" class="effects-demo-globe__mode" aria-live="polite">
        当前模式：{{ nearGroundMode === 'near-ground' ? '近地全景' : '标准天空与大气' }}
      </div>

      <div
        v-if="audioState"
        class="effects-demo-globe__audio"
        :class="{ 'is-blocked': audioState === 'blocked' || audioState === 'error' }"
      >
        <p :role="audioState === 'blocked' || audioState === 'error' ? 'alert' : undefined">
          {{ audioMessage }}
        </p>
        <ElButton
          v-if="audioState === 'blocked' || audioState === 'error'"
          size="small"
          type="primary"
          @click="retryAudio"
        >
          重新播放雷声
        </ElButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.effects-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: #07111f;
}

.effects-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.effects-demo-globe :deep(.effects-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.effects-demo-globe :deep(.effects-demo-globe__credits),
.effects-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.effects-demo-globe :deep(.cesium-viewer),
.effects-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.effects-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  width: min(500px, calc(100% - 32px));
  padding: 12px;
  color: #e8eef6;
  background: rgb(9 24 38 / 86%);
  border: 1px solid rgb(255 255 255 / 16%);
  border-radius: 10px;
  box-shadow: 0 16px 40px rgb(0 0 0 / 30%);
  backdrop-filter: blur(10px);
}

.effects-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #e4edf5;
}

.effects-demo-globe__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.effects-demo-globe__controls {
  display: grid;
  gap: 10px;
  margin-top: 12px;
}

.effects-demo-globe__control {
  display: grid;
  gap: 2px;
  font-size: 12px;
  color: #c9d8e5;
}

.effects-demo-globe__control span {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.effects-demo-globe__control strong {
  font-weight: 600;
  color: #ffffff;
}

.effects-demo-globe__control :deep(.el-slider) {
  --el-slider-main-bg-color: #f2b84b;
  --el-slider-runway-bg-color: rgb(255 255 255 / 18%);
  --el-slider-button-size: 14px;
}

.effects-demo-globe__mode {
  display: inline-flex;
  margin-top: 10px;
  padding: 5px 9px;
  font-size: 12px;
  color: #b9e6ff;
  background: rgb(64 160 220 / 16%);
  border: 1px solid rgb(133 213 255 / 32%);
  border-radius: 999px;
}

.effects-demo-globe__audio {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 12px;
  padding-top: 10px;
  font-size: 12px;
  border-top: 1px solid rgb(255 255 255 / 12%);
}

.effects-demo-globe__audio p {
  flex: 1 1 240px;
  margin: 0;
  color: #cce0ed;
}

.effects-demo-globe__audio.is-blocked p {
  color: #ffd7a6;
}

.effects-demo-globe__notice {
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
  .effects-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .effects-demo-globe__status {
    font-size: 12px;
  }
}
</style>
