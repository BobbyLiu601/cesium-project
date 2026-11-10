<script setup lang="ts">
import { ElIcon, ElMenu, ElMenuItem, ElSubMenu } from 'element-plus'
import { nextTick, ref, watch } from 'vue'

import { featureSections } from '@/data/features'

const props = defineProps<{
  activeAnchor: string
}>()

const emit = defineEmits<{
  select: [anchor: string]
}>()

const openedSections = featureSections.map((section) => section.id)
const menuRef = ref<{ updateActiveIndex: (index: string) => void } | null>(null)

watch(
  () => props.activeAnchor,
  async (activeAnchor) => {
    await nextTick()
    menuRef.value?.updateActiveIndex(activeAnchor)
  },
  { immediate: true },
)
</script>

<template>
  <ElMenu
    ref="menuRef"
    class="sidebar-menu"
    :default-active="activeAnchor"
    :default-openeds="openedSections"
    :unique-opened="false"
    aria-label="后台菜单"
  >
    <ElSubMenu
      v-for="section in featureSections"
      :key="section.id"
      :index="section.id"
      class="sidebar-menu__section"
    >
      <template #title>
        <ElIcon class="sidebar-menu__icon" aria-hidden="true">
          <component :is="section.icon" />
        </ElIcon>
        <span class="sidebar-menu__label">{{ section.title }}</span>
      </template>

      <ElMenuItem
        v-for="item in section.items"
        :key="item.id"
        :index="item.id"
        :aria-current="activeAnchor === item.id ? 'location' : undefined"
        @click="emit('select', item.id)"
        @keydown.enter.prevent="emit('select', item.id)"
        @keydown.space.prevent="emit('select', item.id)"
      >
        <span class="sidebar-menu__marker" aria-hidden="true"></span>
        <span class="sidebar-menu__label">{{ item.name }}</span>
      </ElMenuItem>
    </ElSubMenu>
  </ElMenu>
</template>

<style scoped>
.sidebar-menu {
  --el-menu-bg-color: var(--color-chrome);
  --el-menu-hover-bg-color: var(--color-menu-hover);
  --el-menu-text-color: var(--color-sidebar-muted);
  --el-menu-active-color: var(--color-menu-active);
  width: 100%;
  border-right: 0;
}

.sidebar-menu :deep(.el-sub-menu__title) {
  height: 48px;
  margin: 2px 10px;
  padding: 0 14px !important;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.sidebar-menu :deep(.el-sub-menu__title:hover) {
  color: var(--color-sidebar-text);
  background: var(--color-menu-hover);
}

.sidebar-menu :deep(.el-sub-menu__title:focus-visible),
.sidebar-menu :deep(.el-menu-item:focus-visible) {
  outline: 2px solid var(--color-chrome-focus);
  outline-offset: -2px;
}

.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--color-menu-active);
}

.sidebar-menu :deep(.el-sub-menu__icon-arrow) {
  right: 14px;
  margin-top: -7px;
  color: var(--color-sidebar-muted);
  font-size: 14px;
  transition: transform 160ms ease;
}

.sidebar-menu :deep(.el-sub-menu.is-opened > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  /* Element Plus sets the opened-state rotation as an inline style. */
  transform: none !important;
}

.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title .sidebar-menu__icon) {
  color: var(--color-menu-active);
}

.sidebar-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 1px 10px;
  padding: 0 14px 0 42px !important;
  border-radius: 2px;
  font-size: 13px;
  color: var(--color-sidebar-muted);
}

.sidebar-menu :deep(.el-menu-item:hover) {
  color: var(--color-sidebar-text);
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: var(--color-sidebar-muted);
  background: var(--color-menu-active-bg);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.sidebar-menu__icon {
  margin-right: 10px;
  font-size: 18px;
  color: var(--color-sidebar-muted);
}

.sidebar-menu__marker {
  position: absolute;
  left: 24px;
  width: 5px;
  height: 5px;
  background: currentColor;
  border-radius: 1px;
  opacity: 0.55;
}

.sidebar-menu :deep(.el-menu-item.is-active) .sidebar-menu__marker {
  background: var(--color-menu-active);
  opacity: 1;
}

.sidebar-menu__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
