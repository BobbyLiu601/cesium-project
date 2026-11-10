<script setup lang="ts">
import { MagicStick, Setting } from '@element-plus/icons-vue'
import { ElIcon, ElMenu, ElMenuItem } from 'element-plus'

defineProps<{
  activePath: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const menuItems = [
  { path: '/basic-config', label: '基础配置', icon: Setting },
  { path: '/effects', label: '视觉效果', icon: MagicStick },
] as const
</script>

<template>
  <ElMenu class="sidebar-menu" :default-active="activePath" aria-label="后台菜单">
    <ElMenuItem
      v-for="item in menuItems"
      :key="item.path"
      :index="item.path"
      :aria-current="activePath === item.path ? 'page' : undefined"
      @click="emit('select', item.path)"
      @keydown.enter.prevent="emit('select', item.path)"
      @keydown.space.prevent="emit('select', item.path)"
    >
      <ElIcon class="sidebar-menu__icon" aria-hidden="true">
        <component :is="item.icon" />
      </ElIcon>
      <span class="sidebar-menu__label">{{ item.label }}</span>
    </ElMenuItem>
  </ElMenu>
</template>

<style scoped>
.sidebar-menu {
  --el-menu-bg-color: var(--color-chrome);
  --el-menu-hover-bg-color: rgb(255 255 255 / 8%);
  --el-menu-text-color: var(--color-sidebar-muted);
  --el-menu-active-color: #ffffff;
  width: 100%;
  border-right: 0;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 48px;
  margin: 2px 10px;
  padding: 0 14px !important;
  border-radius: 2px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.01em;
}

.sidebar-menu :deep(.el-menu-item:hover) {
  color: var(--color-sidebar-text);
}

.sidebar-menu :deep(.el-menu-item:focus-visible) {
  outline: 2px solid rgb(255 255 255 / 65%);
  outline-offset: -2px;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  color: #ffffff;
  background: rgb(255 255 255 / 9%);
  box-shadow: inset 2px 0 0 var(--color-primary);
}

.sidebar-menu__icon {
  margin-right: 10px;
  font-size: 18px;
  color: var(--color-sidebar-muted);
}

.sidebar-menu :deep(.el-menu-item.is-active) .sidebar-menu__icon {
  color: #ff8b92;
}

.sidebar-menu__label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
