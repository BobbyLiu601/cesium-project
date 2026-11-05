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

import { disposeActiveSession } from '@/components/cesiumGlobeSession'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  closed: []
}>()

const globeRef = ref<{ resize: () => void } | null>(null)
let loadedGlobeComponent: Component | null = null
const globeReady = shallowRef(false)
const isFullscreen = ref(false)
let pendingGlobeLoad: Promise<void> | undefined

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => {
    if (!value) {
      disposeActiveSession()
    }
    emit('update:modelValue', value)
  },
})

async function toggleFullscreen() {
  isFullscreen.value = !isFullscreen.value
  await nextTick()
  globeRef.value?.resize()
}

async function loadGlobe() {
  if (globeReady.value) {
    return
  }

  pendingGlobeLoad ??= import('@/components/ElevationGlobe.vue')
    .then((module) => {
      loadedGlobeComponent = markRaw(module.default)
      globeReady.value = true
    })
    .catch((error) => {
      console.error('Cesium 高程模块加载失败', error)
    })
    .finally(() => {
      pendingGlobeLoad = undefined
    })

  await pendingGlobeLoad
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

onBeforeUnmount(disposeActiveSession)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      void loadGlobe()
    }
  },
  { immediate: true },
)
</script>

<template>
  <ElDialog
    v-model="dialogVisible"
    class="elevation-dialog"
    title="高程"
    :fullscreen="isFullscreen"
    append-to-body
    destroy-on-close
    :before-close="handleBeforeClose"
    @closed="handleClosed"
  >
    <template #header="{ titleId, titleClass }">
      <div class="elevation-dialog__header">
        <h2 :id="titleId" :class="titleClass" class="elevation-dialog__title">高程</h2>
        <ElButton
          class="elevation-dialog__fullscreen"
          text
          circle
          :icon="isFullscreen ? ScaleToOriginal : FullScreen"
          :aria-label="isFullscreen ? '退出全屏' : '全屏'"
          :title="isFullscreen ? '退出全屏' : '全屏'"
          @click="toggleFullscreen"
        />
      </div>
    </template>

    <component
      :is="loadedGlobeComponent"
      v-if="dialogVisible && globeReady"
      key="cesium-elevation-globe"
      ref="globeRef"
    />
  </ElDialog>
</template>

<style>
.elevation-dialog {
  width: min(1120px, calc(100vw - 48px));
  max-width: none;
  margin-top: 6vh;
  overflow: hidden;
  border-radius: 18px;
}

.elevation-dialog.is-fullscreen {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: none;
  margin: 0;
  border-radius: 0;
}

.elevation-dialog .el-dialog__header {
  position: relative;
  min-height: 48px;
  padding: 8px 96px 8px 22px;
  margin: 0;
  border-bottom: 1px solid var(--color-border);
}

.elevation-dialog .el-dialog__body {
  position: relative;
  height: min(68vh, calc(100vh - 180px));
  padding: 0;
  overflow: hidden;
  background: #07111f;
}

.elevation-dialog.is-fullscreen .el-dialog__body {
  flex: 1;
  height: auto;
  min-height: 0;
}

.elevation-dialog__header {
  display: flex;
  align-items: center;
  min-width: 0;
  min-height: 32px;
}

.elevation-dialog__title {
  min-width: 0;
  margin: 0;
  overflow: hidden;
  font-size: 18px;
  line-height: 1.35;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.elevation-dialog__fullscreen {
  position: absolute;
  top: 0;
  right: 48px;
  width: 48px;
  height: 48px;
  margin: 0;
  color: var(--color-text-secondary);
}

.elevation-dialog__fullscreen:hover,
.elevation-dialog__fullscreen:focus-visible {
  color: var(--color-primary-strong);
}

@media (max-width: 767px) {
  .elevation-dialog {
    width: calc(100vw - 24px);
    margin-top: 3vh;
    border-radius: 14px;
  }

  .elevation-dialog .el-dialog__header {
    padding: 8px 88px 8px 16px;
  }

  .elevation-dialog .el-dialog__body {
    height: min(64vh, calc(100vh - 160px));
  }

  .elevation-dialog__title {
    font-size: 17px;
  }

  .elevation-dialog__fullscreen {
    width: 44px;
    height: 44px;
  }
}
</style>
