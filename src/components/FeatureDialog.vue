<script setup lang="ts">
import {
  computed,
  markRaw,
  nextTick,
  onBeforeUnmount,
  ref,
  shallowRef,
  watch,
  type Component,
} from 'vue'
import { ElButton, ElDialog } from 'element-plus'
import { FullScreen, ScaleToOriginal } from '@element-plus/icons-vue'

import {
  clearSceneModuleRetry,
  reloadSceneModuleAfterFetchFailure,
  sceneModuleLoaders,
} from '@/components/sceneModuleLoader'
import { disposeActiveSession } from '@/components/cesiumGlobeSession'
import type { FeatureItem, FeatureKind } from '@/data/layers'

const props = defineProps<{
  modelValue: boolean
  feature: FeatureItem
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
}>()

const scenePropResolvers: Partial<
  Record<FeatureKind, (feature: FeatureItem) => Record<string, unknown>>
> = {
  amap: () => ({ imagery: 'amap' }),
  effects: (feature) => (feature.effectSceneId ? { sceneId: feature.effectSceneId } : {}),
  model: (feature) => (feature.modelSceneId ? { sceneId: feature.modelSceneId } : {}),
  particles: (feature) => (feature.particleSceneId ? { sceneId: feature.particleSceneId } : {}),
  spatial: (feature) => (feature.spatialSceneId ? { sceneId: feature.spatialSceneId } : {}),
  'special-shapes': (feature) =>
    feature.specialShapeSceneId ? { sceneId: feature.specialShapeSceneId } : {},
  'physics-engine': (feature) =>
    feature.physicsEngineSceneId ? { sceneId: feature.physicsEngineSceneId } : {},
  vector: (feature) => (feature.sceneId ? { sceneId: feature.sceneId } : {}),
  visualization: (feature) =>
    feature.visualizationSceneId ? { sceneId: feature.visualizationSceneId } : {},
}

const sceneRef = ref<{ resize: () => void } | null>(null)
const isFullscreen = ref(false)
const sceneReady = shallowRef(false)
const loadFailed = ref(false)
let loadedSceneComponent: Component | null = null
let pendingSceneLoad: Promise<void> | undefined

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    if (!value) {
      disposeActiveSession()
    }
    emit('update:modelValue', value)
  },
})

const sceneProps = computed(() => scenePropResolvers[props.feature.kind]?.(props.feature) ?? {})

async function loadScene() {
  if (sceneReady.value || loadFailed.value) {
    return
  }

  pendingSceneLoad ??= (async () => {
    try {
      const module = await sceneModuleLoaders[props.feature.kind]()

      loadedSceneComponent = markRaw(module.default)
      clearSceneModuleRetry(props.feature)
      sceneReady.value = true
    } catch (error) {
      if (reloadSceneModuleAfterFetchFailure(props.feature, error)) {
        return
      }

      loadFailed.value = true
      console.error(`Cesium 示例模块加载失败：${props.feature.name}`, error)
    } finally {
      pendingSceneLoad = undefined
    }
  })()

  await pendingSceneLoad
}

async function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  await nextTick()
  sceneRef.value?.resize()
}

function reloadScene() {
  clearSceneModuleRetry(props.feature)
  window.location.reload()
}

function handleBeforeClose(done: () => void) {
  disposeActiveSession()
  emit('update:modelValue', false)
  done()
}

function handleClosed() {
  isFullscreen.value = false
  emit('closed')
}

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      void loadScene()
    }
  },
  { immediate: true },
)

onBeforeUnmount(disposeActiveSession)
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    class="feature-dialog"
    :class="`feature-dialog--${feature.kind}`"
    :title="feature.displayName"
    :fullscreen="isFullscreen"
    append-to-body
    destroy-on-close
    :before-close="handleBeforeClose"
    @closed="handleClosed"
  >
    <template #header="{ titleId, titleClass }">
      <div class="feature-dialog__header">
        <h2 :id="titleId" :class="titleClass" class="feature-dialog__title">
          {{ feature.displayName }}
        </h2>
        <ElButton
          class="feature-dialog__fullscreen"
          text
          circle
          :icon="isFullscreen ? ScaleToOriginal : FullScreen"
          :aria-label="isFullscreen ? '退出全屏' : '全屏'"
          :title="isFullscreen ? '退出全屏' : '全屏'"
          @click="toggleFullscreen"
        />
      </div>
    </template>

    <div class="feature-dialog__stage">
      <component
        :is="loadedSceneComponent"
        v-if="dialogVisible && sceneReady"
        :key="`${feature.kind}-${feature.id}`"
        ref="sceneRef"
        v-bind="sceneProps"
      />
      <div v-else-if="loadFailed" class="feature-dialog__error" role="alert">
        <span>示例场景加载失败，请重新加载页面。</span>
        <ElButton type="primary" size="small" @click="reloadScene">重新加载页面</ElButton>
      </div>
      <div v-else class="feature-dialog__loading" aria-live="polite">正在加载示例…</div>
    </div>
  </ElDialog>
</template>

<style>
.feature-dialog {
  width: min(1120px, calc(100vw - 48px));
  max-width: none;
  margin-top: 6vh;
  overflow: hidden;
  border-radius: 18px;
}

.feature-dialog.is-fullscreen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  margin: 0;
  border-radius: 0;
}

.feature-dialog .el-dialog__header {
  position: relative;
  min-height: 48px;
  padding: 8px 96px 8px 22px;
  margin: 0;
  border-bottom: 1px solid var(--color-border);
}

.feature-dialog .el-dialog__body {
  padding: 0;
}

.feature-dialog__stage {
  position: relative;
  height: min(68vh, calc(100vh - 180px));
  overflow: hidden;
  background: #07111f;
}

.feature-dialog.is-fullscreen .feature-dialog__stage {
  height: calc(100dvh - 49px);
  min-height: 0;
}

.feature-dialog__header {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 32px;
}

.feature-dialog__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  line-height: 1.35;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.feature-dialog__fullscreen {
  position: absolute;
  top: 0;
  right: 48px;
  width: 48px;
  height: 48px;
  margin: 0;
  color: var(--color-text-secondary);
}

.feature-dialog__fullscreen:hover,
.feature-dialog__fullscreen:focus-visible {
  color: var(--color-primary-strong);
}

.feature-dialog__loading,
.feature-dialog__error {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 24px;
  font-size: 14px;
  color: #dbe9f3;
  background: #07111f;
}

.feature-dialog__error {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
  justify-content: center;
  color: #ffd4d7;
  text-align: center;
}

@media (max-width: 767px) {
  .feature-dialog {
    width: calc(100vw - 24px);
    margin-top: 3vh;
    border-radius: 14px;
  }

  .feature-dialog .el-dialog__header {
    padding: 8px 88px 8px 16px;
  }

  .feature-dialog__stage {
    height: min(64vh, calc(100vh - 160px));
  }

  .feature-dialog__title {
    font-size: 17px;
  }

  .feature-dialog__fullscreen {
    width: 44px;
    height: 44px;
  }
}
</style>
