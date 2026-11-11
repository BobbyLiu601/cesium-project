<script setup lang="ts">
import { ArrowDown } from '@element-plus/icons-vue'
import { ElIcon, ElMenu, ElMenuItem, ElSubMenu } from 'element-plus'
import { nextTick, ref, watch } from 'vue'

import { formatMenuGroupTitle, menuGroups, type MenuGroup } from '@/data/layers'

const props = defineProps<{
  activeAnchor: string
  openedGroup: MenuGroup['id']
}>()

const emit = defineEmits<{
  select: [anchor: string]
  'open-group': [groupId: MenuGroup['id']]
}>()

interface SidebarMenuInstance {
  updateActiveIndex: (index: string) => void
  open: (index: string) => void
  close: (index: string) => void
}

const menuRef = ref<SidebarMenuInstance | null>(null)

watch(
  () => props.activeAnchor,
  async (activeAnchor) => {
    await nextTick()
    menuRef.value?.updateActiveIndex(activeAnchor)
  },
  { immediate: true },
)

watch(
  () => props.openedGroup,
  async (openedGroup) => {
    await nextTick()
    for (const group of menuGroups) {
      if (group.id === openedGroup) {
        menuRef.value?.open(group.id)
      } else {
        menuRef.value?.close(group.id)
      }
    }
  },
  { immediate: true },
)

function getGroupId(index: string) {
  return menuGroups.find((group) => group.id === index)?.id
}

function handleOpen(index: string) {
  const groupId = getGroupId(index)
  if (groupId && groupId !== props.openedGroup) {
    emit('open-group', groupId)
  }
}

function handleClose(index: string) {
  const groupId = getGroupId(index)
  if (groupId && groupId === props.openedGroup) {
    void nextTick(() => menuRef.value?.open(groupId))
  }
}
</script>

<template>
  <ElMenu
    ref="menuRef"
    class="sidebar-menu"
    :default-active="activeAnchor"
    :default-openeds="[openedGroup]"
    :unique-opened="true"
    aria-label="后台菜单"
    @open="handleOpen"
    @close="handleClose"
  >
    <ElSubMenu
      v-for="group in menuGroups"
      :key="group.id"
      :index="group.id"
      class="sidebar-menu__group"
      :expand-close-icon="ArrowDown"
      :expand-open-icon="ArrowDown"
    >
      <template #title>
        <ElIcon class="sidebar-menu__icon" aria-hidden="true">
          <component :is="group.icon" />
        </ElIcon>
        <span class="sidebar-menu__label">
          {{ formatMenuGroupTitle(group) }}
        </span>
      </template>

      <template v-if="group.id === 'layers'">
        <ElMenuItem
          v-for="section in group.sections"
          :key="section.id"
          :index="section.id"
          class="sidebar-menu__section-item"
          :aria-current="activeAnchor === section.id ? 'location' : undefined"
          @click="emit('select', section.id)"
          @keydown.enter.prevent="emit('select', section.id)"
          @keydown.space.prevent="emit('select', section.id)"
        >
          <span class="sidebar-menu__label">{{ section.code }}、{{ section.title }}</span>
        </ElMenuItem>
      </template>

      <template v-else>
        <ElMenuItem
          v-for="item in group.sections.flatMap((section) => section.items)"
          :key="item.id"
          :index="item.id"
          class="sidebar-menu__feature"
          :aria-current="activeAnchor === item.id ? 'location' : undefined"
          @click="emit('select', item.id)"
          @keydown.enter.prevent="emit('select', item.id)"
          @keydown.space.prevent="emit('select', item.id)"
        >
          <span class="sidebar-menu__label">{{ item.displayName }}</span>
        </ElMenuItem>
      </template>
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
  border-left: 3px solid transparent;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.sidebar-menu :deep(.el-sub-menu__title:hover) {
  color: var(--color-sidebar-text);
  background: var(--color-chrome);
  border-left-color: var(--color-menu-group-hover-border);
}

.sidebar-menu :deep(.el-sub-menu__title:hover .sidebar-menu__icon) {
  color: var(--color-sidebar-text);
}

.sidebar-menu :deep(.el-sub-menu__title:focus-visible),
.sidebar-menu :deep(.el-menu-item:focus-visible) {
  outline: 2px solid var(--color-chrome-focus);
  outline-offset: -2px;
}

.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--color-menu-active);
  border-left-color: var(--color-menu-group-hover-border);
}

.sidebar-menu :deep(.el-sub-menu__icon-arrow) {
  right: 14px;
  margin-top: -7px;
  color: var(--color-sidebar-muted);
  font-size: 14px;
  transition: transform 160ms ease;
}

.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title .sidebar-menu__icon) {
  color: var(--color-menu-active);
}

.sidebar-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title .el-sub-menu__icon-arrow) {
  color: var(--color-menu-active);
}

.sidebar-menu :deep(.el-menu-item) {
  height: 42px;
  margin: 1px 10px;
  padding: 0 40px !important;
  border-radius: 2px;
  border-left: 3px solid var(--color-chrome);
  font-size: 13px;
  color: var(--color-sidebar-muted);
}

.sidebar-menu :deep(.sidebar-menu__section-item) {
  padding-left: 54px !important;
}

.sidebar-menu__group {
  margin-bottom: 16px;
}

.sidebar-menu :deep(.el-menu-item:hover),
.sidebar-menu :deep(.el-menu-item.is-active) {
  color: var(--color-sidebar-text);
  background: var(--color-menu-active-bg);
  border-left-color: var(--color-menu-active);
}

.sidebar-menu :deep(.el-menu-item:hover) .sidebar-menu__label,
.sidebar-menu :deep(.el-menu-item.is-active) .sidebar-menu__label {
  color: var(--color-menu-active);
}

.sidebar-menu__icon {
  margin-right: 10px;
  font-size: 18px;
  color: var(--color-sidebar-muted);
}

.sidebar-menu__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
