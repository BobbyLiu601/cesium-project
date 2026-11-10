<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { ElButton, ElDrawer } from 'element-plus'
import { RouterView, useRoute, useRouter } from 'vue-router'

import SidebarMenu from '@/components/SidebarMenu.vue'
import { featureAnchors } from '@/data/features'

const route = useRoute()
const router = useRouter()
const drawerVisible = ref(false)
const activeAnchor = ref('')
const contentElement = ref<HTMLElement | null>(null)
const defaultAnchor = featureAnchors[0] ?? ''

function getRouteAnchor() {
  const hash = route.hash.replace(/^#/, '')
  return featureAnchors.includes(hash) ? hash : ''
}

async function scrollToAnchor(anchor: string) {
  await nextTick()
  const target =
    contentElement.value?.querySelector<HTMLElement>(`#${anchor}`) ??
    document.getElementById(anchor)

  if (target && contentElement.value?.contains(target)) {
    const content = contentElement.value
    const targetTop =
      content.scrollTop + target.getBoundingClientRect().top - content.getBoundingClientRect().top

    content.scrollTo?.({ top: Math.max(0, targetTop - 20), behavior: 'smooth' })
    return
  }

  target?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
}

async function handleMenuSelect(anchor: string) {
  drawerVisible.value = false
  activeAnchor.value = anchor
  const hash = `#${anchor}`

  if (route.path !== '/basic-config' || route.hash !== hash) {
    await router.push({ path: '/basic-config', hash })
    return
  }

  await scrollToAnchor(anchor)
}

watch(
  () => route.fullPath,
  async () => {
    if (route.path !== '/basic-config') {
      activeAnchor.value = ''
      return
    }

    const routeAnchor = getRouteAnchor()
    activeAnchor.value = routeAnchor || defaultAnchor

    if (routeAnchor) {
      await scrollToAnchor(routeAnchor)
    }
  },
  { immediate: true },
)
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
        <span class="admin-brand__title">三维效果展示</span>
      </div>
    </header>

    <div class="admin-body">
      <aside class="admin-sidebar">
        <nav aria-label="侧边导航">
          <SidebarMenu :active-anchor="activeAnchor" @select="handleMenuSelect" />
        </nav>
      </aside>

      <main ref="contentElement" class="admin-content">
        <RouterView />
      </main>
    </div>

    <ElDrawer
      v-model="drawerVisible"
      class="mobile-navigation-drawer"
      direction="ltr"
      size="230px"
      title="后台导航"
    >
      <SidebarMenu
        :active-anchor="activeAnchor"
        aria-label="后台导航菜单"
        @select="handleMenuSelect"
      />
    </ElDrawer>
  </div>
</template>

<style scoped>
.admin-shell {
  display: grid;
  grid-template-rows: 72px minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
  background: var(--color-background);
}

.admin-header {
  position: relative;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 10px;
  height: 72px;
  padding: 0 24px;
  background: var(--color-chrome);
  border-bottom: 1px solid rgb(255 255 255 / 8%);
}

.admin-brand {
  display: flex;
  align-items: center;
  min-width: 0;
}

.admin-brand__title {
  overflow: hidden;
  font-size: 32px;
  font-weight: 700;
  line-height: 1;
  letter-spacing: 0.04em;
  color: transparent;
  text-overflow: ellipsis;
  white-space: nowrap;
  background: linear-gradient(180deg, #45a6ff 0 50%, #ffd43b 50% 100%);
  background-clip: text;
  -webkit-background-clip: text;
}

.admin-body {
  display: grid;
  grid-template-columns: 230px minmax(0, 1fr);
  min-height: 0;
}

.admin-sidebar {
  min-height: 0;
  padding: 12px 0 18px;
  overflow-y: auto;
  background: var(--color-chrome);
}

.admin-content {
  min-width: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  background: var(--color-background);
}

.mobile-menu-button {
  display: none;
  width: 40px;
  height: 40px;
  padding: 0;
  color: #f7f9fc;
  --el-button-hover-bg-color: rgb(255 255 255 / 8%);
  --el-button-hover-text-color: #ffffff;
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

:global(.mobile-navigation-drawer) {
  --el-drawer-bg-color: var(--color-chrome);
}

:global(.mobile-navigation-drawer .el-drawer__header) {
  padding: 20px 20px 12px;
  margin-bottom: 0;
  color: #f7f9fc;
  font-weight: 600;
}

:global(.mobile-navigation-drawer .el-drawer__close-btn) {
  color: #f7f9fc;
}

:global(.mobile-navigation-drawer .el-drawer__body) {
  padding: 4px 0 20px;
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
    min-width: 0;
  }

  .admin-brand__title {
    font-size: 22px;
    letter-spacing: 0.02em;
  }

  .admin-body {
    grid-template-columns: minmax(0, 1fr);
  }

  .admin-sidebar {
    display: none;
  }

  .mobile-menu-button {
    display: inline-flex;
    flex: 0 0 auto;
  }
}
</style>
