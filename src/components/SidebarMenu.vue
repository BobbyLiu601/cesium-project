<script setup lang="ts">
import { ElMenu, ElMenuItem } from 'element-plus'

defineProps<{
  activePath: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()

const menuItems = [
  { path: '/basic-config', label: '基础配置' },
  { path: '/effects', label: '视觉效果' },
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
      <span class="sidebar-menu__marker" aria-hidden="true"></span>
      <span>{{ item.label }}</span>
    </ElMenuItem>
  </ElMenu>
</template>

<style scoped>
.sidebar-menu {
  --el-menu-bg-color: transparent;
  --el-menu-hover-bg-color: #f3f7fd;
  --el-menu-text-color: var(--color-text-secondary);
  --el-menu-active-color: var(--color-primary-strong);
  border-right: 0;
}

.sidebar-menu :deep(.el-menu-item) {
  height: 46px;
  margin: 4px 0;
  padding: 0 14px !important;
  border-radius: 10px;
  font-weight: 600;
  letter-spacing: 0.01em;
}

.sidebar-menu :deep(.el-menu-item:focus-visible) {
  outline: 3px solid rgb(37 99 235 / 24%);
  outline-offset: 1px;
}

.sidebar-menu :deep(.el-menu-item.is-active) {
  background: var(--color-primary-soft);
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.sidebar-menu__marker {
  width: 7px;
  height: 7px;
  margin-right: 11px;
  background: currentColor;
  border-radius: 2px;
  opacity: 0.55;
}
</style>
