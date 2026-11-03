<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElButton, ElDrawer } from 'element-plus'
import { RouterView, useRoute, useRouter } from 'vue-router'

import SidebarMenu from '@/components/SidebarMenu.vue'

const route = useRoute()
const router = useRouter()
const drawerVisible = ref(false)
const activePath = computed(() => route.path)

async function handleMenuSelect(path: string) {
  drawerVisible.value = false

  if (route.path !== path) {
    await router.push(path)
  }
}
</script>

<template>
  <div class="admin-shell">
    <header class="admin-header">
      <ElButton
        class="mobile-menu-button"
        aria-label="打开导航菜单"
        text
        @click="drawerVisible = true"
      >
        <span class="mobile-menu-button__icon" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
        </span>
      </ElButton>

      <div class="admin-brand">
        <span class="admin-brand__accent" aria-hidden="true"></span>
        <span class="admin-brand__title">三维效果展示</span>
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-sidebar">
        <nav aria-label="侧边导航">
          <SidebarMenu :active-path="activePath" @select="handleMenuSelect" />
        </nav>
      </aside>

      <main class="admin-content">
        <RouterView />
      </main>
    </div>

    <ElDrawer
      v-model="drawerVisible"
      class="mobile-navigation-drawer"
      direction="ltr"
      size="248px"
      title="后台导航"
    >
      <SidebarMenu :active-path="activePath" aria-label="后台导航菜单" @select="handleMenuSelect" />
    </ElDrawer>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-rows: 64px minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  background:
    radial-gradient(circle at 92% 6%, rgb(67 126 255 / 12%), transparent 26rem),
    linear-gradient(145deg, #f5f8fc 0%, var(--color-background) 55%, #e9f0f8 100%);
}

.admin-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 64px;
  padding: 0 24px;
  background: rgb(255 255 255 / 92%);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-header);
  backdrop-filter: blur(14px);
}

.admin-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}

.admin-brand__accent {
  width: 4px;
  height: 22px;
  background: linear-gradient(180deg, #60a5fa, var(--color-primary-strong));
  border-radius: 999px;
  box-shadow: 0 0 0 4px rgb(37 99 235 / 8%);
}

.admin-brand__title {
  overflow: hidden;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: #15233b;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-body {
  display: grid;
  grid-template-columns: 238px minmax(0, 1fr);
  min-height: 0;
}

.admin-sidebar {
  min-height: 0;
  padding: 16px 14px;
  overflow-y: auto;
  background: rgb(255 255 255 / 72%);
  border-right: 1px solid var(--color-border);
  backdrop-filter: blur(12px);
}

.admin-content {
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
}

.mobile-menu-button {
  display: none;
  width: 38px;
  height: 38px;
  padding: 0;
  color: var(--color-text);
}

.mobile-menu-button__icon {
  display: grid;
  gap: 4px;
  width: 18px;
}

.mobile-menu-button__icon span {
  display: block;
  width: 100%;
  height: 2px;
  background: currentColor;
  border-radius: 999px;
}

:deep(.mobile-navigation-drawer .el-drawer__header) {
  margin-bottom: 8px;
  color: var(--color-text);
  font-weight: 700;
}

:deep(.mobile-navigation-drawer .el-drawer__body) {
  padding: 0 14px 20px;
}

@media (max-width: 767px) {
  .admin-shell {
    grid-template-rows: 60px minmax(0, 1fr);
  }

  .admin-header {
    height: 60px;
    padding: 0 12px;
  }

  .admin-brand {
    gap: 9px;
  }

  .admin-brand__title {
    font-size: 17px;
  }

  .admin-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-sidebar {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex;
  }
}
</style>
