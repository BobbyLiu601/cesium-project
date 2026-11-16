<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ElButton } from 'element-plus'

import type { PhysicsEngineSceneId } from '@/data/layers'
import {
  PHYSICS_SCENE_DEFINITIONS,
  createPhysicsEngineScene,
  type PhysicsControl,
  type PhysicsEngineScene,
} from '@/demos/physicsScene'
import { useDemoGlobe } from '@/demos/useDemoGlobe'

const props = defineProps<{
  sceneId: PhysicsEngineSceneId
}>()

const container = ref<HTMLDivElement | null>(null)
const pressedControlIds = ref<Set<string>>(new Set())

const { resize, scene, sceneState, statusMessage } = useDemoGlobe({
  actionErrorLabel: '物理引擎示例操作失败',
  container,
  creditTestId: 'physics-engine-credit-container',
  errorLabel: 'Cesium 物理引擎示例初始化失败',
  errorStatus: '物理引擎场景加载失败，请关闭后重试。',
  initialStatus: '正在准备 Cesium 物理引擎场景…',
  loadScene: ({ setStatus, signal, viewer }) =>
    createPhysicsEngineScene(viewer, props.sceneId, setStatus, { signal }),
  sceneId: props.sceneId,
  scenePrefix: 'physics-engine-demo-globe',
})

const physicsScene = computed(() => scene.value as PhysicsEngineScene | undefined)
const animationState = computed(() => physicsScene.value?.animationState.value)
const stats = computed(
  () =>
    physicsScene.value?.stats.value ?? {
      bodyCount: 0,
      brokenBodyCount: 0,
      dynamicBodyCount: 0,
      projectileCount: 0,
      softBodyCount: 0,
      vehicleSpeed: 0,
    },
)
const definition = computed(() => PHYSICS_SCENE_DEFINITIONS[props.sceneId])
const animationLabel = computed(() => (animationState.value === 'paused' ? '继续物理' : '暂停物理'))

function setControlPressed(control: PhysicsControl, pressed: boolean) {
  const next = new Set(pressedControlIds.value)
  if (pressed) {
    next.add(control.id)
    control.press()
  } else {
    if (!next.has(control.id)) {
      return
    }
    next.delete(control.id)
    control.release?.()
  }
  pressedControlIds.value = next
}

function startControl(event: PointerEvent, control: PhysicsControl) {
  event.preventDefault()
  if (typeof event.currentTarget === 'object') {
    ;(event.currentTarget as HTMLElement | null)?.setPointerCapture?.(event.pointerId)
  }
  setControlPressed(control, true)
}

function stopControl(event: PointerEvent, control: PhysicsControl) {
  event.preventDefault()
  setControlPressed(control, false)
}

function toggleAnimation() {
  physicsScene.value?.toggleAnimation()
}

function resetScene() {
  pressedControlIds.value = new Set()
  physicsScene.value?.reset()
}

function shouldIgnoreKeyboard(event: KeyboardEvent) {
  const target = event.target as HTMLElement | null
  return (
    target?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target?.tagName ?? '')
  )
}

function getControlForKey(code: string) {
  return physicsScene.value?.controls.find((control) => control.keys?.includes(code))
}

function handleKeyDown(event: KeyboardEvent) {
  if (shouldIgnoreKeyboard(event)) {
    return
  }
  const control = getControlForKey(event.code)
  if (!control || pressedControlIds.value.has(control.id)) {
    return
  }
  event.preventDefault()
  setControlPressed(control, true)
}

function handleKeyUp(event: KeyboardEvent) {
  if (shouldIgnoreKeyboard(event)) {
    return
  }
  const control = getControlForKey(event.code)
  if (!control) {
    return
  }
  event.preventDefault()
  setControlPressed(control, false)
}

onMounted(() => {
  window.addEventListener('keydown', handleKeyDown)
  window.addEventListener('keyup', handleKeyUp)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleKeyDown)
  window.removeEventListener('keyup', handleKeyUp)
  physicsScene.value?.controls.forEach((control) => control.release?.())
})

defineExpose({ resize })
</script>

<template>
  <div
    class="physics-engine-demo-globe"
    data-testid="physics-engine-demo-globe"
    :data-scene-id="sceneId"
    :data-cesium-state="sceneState"
    :data-animation-state="animationState"
    :data-body-count="stats.bodyCount"
    :data-soft-body-count="stats.softBodyCount"
    :data-projectile-count="stats.projectileCount"
    :data-broken-body-count="stats.brokenBodyCount"
    :data-vehicle-speed="stats.vehicleSpeed.toFixed(1)"
  >
    <div ref="container" class="physics-engine-demo-globe__canvas"></div>
    <div
      v-if="sceneState === 'loading'"
      class="physics-engine-demo-globe__notice"
      aria-live="polite"
    >
      正在加载物理引擎场景…
    </div>
    <div v-else-if="sceneState === 'error'" class="physics-engine-demo-globe__notice" role="alert">
      {{ statusMessage }}
    </div>

    <div
      v-if="sceneState === 'ready'"
      class="physics-engine-demo-globe__toolbar"
      data-testid="physics-toolbar"
    >
      <div class="physics-engine-demo-globe__heading">
        <span class="physics-engine-demo-globe__eyebrow">AMMO.JS / CESIUM</span>
        <p class="physics-engine-demo-globe__status" aria-live="polite">
          {{ statusMessage }}
        </p>
        <span class="physics-engine-demo-globe__hint">{{ definition.hint }}</span>
      </div>

      <div class="physics-engine-demo-globe__controls" aria-label="物理场景操作">
        <ElButton
          v-for="control in physicsScene?.controls ?? []"
          :key="control.id"
          size="small"
          :class="{
            'is-pressed': pressedControlIds.has(control.id),
            'is-tap': control.kind === 'tap',
          }"
          :aria-label="control.ariaLabel"
          :aria-pressed="control.kind === 'hold' ? pressedControlIds.has(control.id) : undefined"
          @pointerdown="control.kind === 'hold' ? startControl($event, control) : undefined"
          @pointerup="control.kind === 'hold' ? stopControl($event, control) : undefined"
          @pointercancel="control.kind === 'hold' ? stopControl($event, control) : undefined"
          @pointerleave="control.kind === 'hold' ? stopControl($event, control) : undefined"
          @click="control.kind === 'tap' ? control.press() : undefined"
        >
          {{ control.label }}
        </ElButton>
      </div>

      <div class="physics-engine-demo-globe__actions">
        <ElButton
          size="small"
          :aria-pressed="animationState === 'playing'"
          @click="toggleAnimation"
        >
          {{ animationLabel }}
        </ElButton>
        <ElButton size="small" plain @click="resetScene">重置场景</ElButton>
      </div>

      <dl class="physics-engine-demo-globe__stats" aria-label="物理场景状态">
        <div>
          <dt>刚体</dt>
          <dd>{{ stats.bodyCount }}</dd>
        </div>
        <div>
          <dt>软体</dt>
          <dd>{{ stats.softBodyCount }}</dd>
        </div>
        <div>
          <dt>撞击球</dt>
          <dd>{{ stats.projectileCount }}</dd>
        </div>
        <div>
          <dt>断裂</dt>
          <dd>{{ stats.brokenBodyCount }}</dd>
        </div>
      </dl>
    </div>
  </div>
</template>

<style scoped>
.physics-engine-demo-globe {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(circle at 72% 18%, rgb(34 133 139 / 24%), transparent 30%), #07111f;
}

.physics-engine-demo-globe__canvas {
  position: absolute;
  inset: 0;
}

.physics-engine-demo-globe :deep(.physics-engine-demo-globe__viewer) {
  position: absolute;
  inset: 0;
}

.physics-engine-demo-globe :deep(.physics-engine-demo-globe__credits),
.physics-engine-demo-globe :deep(.cesium-viewer-bottom) {
  display: none !important;
}

.physics-engine-demo-globe :deep(.cesium-viewer),
.physics-engine-demo-globe :deep(.cesium-viewer-cesiumWidgetContainer) {
  width: 100%;
  height: 100%;
}

.physics-engine-demo-globe__toolbar {
  position: absolute;
  top: 16px;
  left: 16px;
  z-index: 6;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 10px;
  width: min(540px, calc(100% - 32px));
  padding: 14px;
  color: #e8eef6;
  background: linear-gradient(135deg, rgb(9 24 38 / 94%), rgb(5 17 28 / 82%));
  border: 1px solid rgb(108 221 214 / 28%);
  border-radius: 12px;
  box-shadow:
    0 18px 48px rgb(0 0 0 / 34%),
    inset 0 1px rgb(255 255 255 / 8%);
  backdrop-filter: blur(12px);
}

.physics-engine-demo-globe__heading {
  display: grid;
  gap: 4px;
}

.physics-engine-demo-globe__eyebrow {
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  color: #6cddd6;
}

.physics-engine-demo-globe__status {
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #eef7f7;
}

.physics-engine-demo-globe__hint {
  font-size: 12px;
  color: #a9c0ca;
}

.physics-engine-demo-globe__controls,
.physics-engine-demo-globe__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.physics-engine-demo-globe__controls :deep(.el-button),
.physics-engine-demo-globe__actions :deep(.el-button) {
  margin-left: 0;
  color: #dff8f4;
  background: rgb(10 40 50 / 76%);
  border-color: rgb(108 221 214 / 34%);
}

.physics-engine-demo-globe__controls :deep(.el-button:hover),
.physics-engine-demo-globe__controls :deep(.el-button:focus-visible),
.physics-engine-demo-globe__actions :deep(.el-button:hover),
.physics-engine-demo-globe__actions :deep(.el-button:focus-visible) {
  color: #ffffff;
  background: rgb(17 79 84 / 90%);
  border-color: #6cddd6;
}

.physics-engine-demo-globe__controls :deep(.el-button.is-pressed) {
  color: #07111f;
  background: #6cddd6;
  border-color: #6cddd6;
}

.physics-engine-demo-globe__controls :deep(.el-button.is-tap) {
  color: #1b1205;
  background: #f1b84b;
  border-color: #ffd77b;
}

.physics-engine-demo-globe__stats {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 6px;
  padding: 8px;
  margin: 0;
  background: rgb(2 11 18 / 48%);
  border: 1px solid rgb(255 255 255 / 8%);
  border-radius: 8px;
}

.physics-engine-demo-globe__stats div {
  display: grid;
  gap: 2px;
  min-width: 0;
  text-align: center;
}

.physics-engine-demo-globe__stats dt {
  font-size: 10px;
  color: #7f9ba7;
}

.physics-engine-demo-globe__stats dd {
  margin: 0;
  font-family: 'JetBrains Mono', 'SFMono-Regular', Consolas, monospace;
  font-size: 13px;
  color: #dff8f4;
}

.physics-engine-demo-globe__notice {
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
  .physics-engine-demo-globe__toolbar {
    top: 10px;
    left: 10px;
    width: calc(100% - 20px);
    padding: 10px;
  }

  .physics-engine-demo-globe__stats {
    grid-template-columns: repeat(4, minmax(48px, 1fr));
    overflow-x: auto;
  }

  .physics-engine-demo-globe__controls :deep(.el-button),
  .physics-engine-demo-globe__actions :deep(.el-button) {
    min-height: 36px;
  }
}
</style>
