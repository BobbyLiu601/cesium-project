<script setup lang="ts">
import { ElMenu, ElMenuItem } from 'element-plus'

defineProps<{
  activePath: string
}>()

const emit = defineEmits<{
  select: [path: string]
}>()
</script>

<template>
  <ElMenu class="sidebar-menu" :default-active="activePath" aria-label="后台菜单">
    <ElMenuItem
      index="/basic-config"
      :aria-current="activePath === '/basic-config' ? 'page' : undefined"
      @click="emit('select', '/basic-config')"
      @keydown.enter.prevent="emit('select', '/basic-config')"
      @keydown.space.prevent="emit('select', '/basic-config')"
    >
      <span class="sidebar-menu__marker" aria-hidden="true"></span>
      <span>基础配置</span>
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
