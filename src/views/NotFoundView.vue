<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()
</script>

<template>
  <section class="not-found">
    <p class="not-found__code" aria-hidden="true">404</p>
    <h1>页面不存在</h1>
    <p class="not-found__message">
      无法找到地址 <code>{{ route.fullPath }}</code
      >。请检查地址或返回图层列表。
    </p>
    <RouterLink class="not-found__link" :to="{ name: 'layers' }"> 返回图层列表 </RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  width: min(660px, calc(100% - 32px));
  padding: 38px 40px;
  margin: clamp(28px, 8vh, 72px) auto;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-top: 3px solid var(--color-primary);
  border-radius: 2px;
  box-shadow: none;
}

.not-found__code {
  margin: 0 0 8px;
  font-size: clamp(56px, 9vw, 86px);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.06em;
  color: rgb(214 60 70 / 16%);
}

.not-found h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 34px);
  color: var(--color-text);
}

.not-found__message {
  max-width: 52ch;
  margin: 14px 0 26px;
  line-height: 1.75;
  color: var(--color-text-secondary);
}

.not-found__message code {
  padding: 2px 6px;
  color: #334155;
  word-break: break-all;
  background: #f1f5f9;
  border-radius: 5px;
}

.not-found__link {
  display: inline-flex;
  align-items: center;
  min-height: 40px;
  padding: 0 18px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  text-decoration: none;
  background: var(--color-primary);
  border-radius: 2px;
  box-shadow: none;
}

.not-found__link:hover {
  background: var(--color-primary-strong);
}

.not-found__link:focus-visible {
  outline: 2px solid rgb(214 60 70 / 42%);
  outline-offset: 2px;
}

@media (max-width: 767px) {
  .not-found {
    padding: 28px 24px;
    margin-top: 24px;
  }
}
</style>
