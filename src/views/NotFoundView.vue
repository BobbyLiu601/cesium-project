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
      >。请检查地址或返回基础配置。
    </p>
    <RouterLink class="not-found__link" to="/basic-config"> 返回基础配置 </RouterLink>
  </section>
</template>

<style scoped>
.not-found {
  width: min(660px, calc(100% - 32px));
  padding: 46px;
  margin: clamp(28px, 8vh, 80px) auto;
  background: linear-gradient(135deg, rgb(37 99 235 / 9%), transparent 48%), var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 20px;
  box-shadow: var(--shadow-card);
}

.not-found__code {
  margin: 0 0 8px;
  font-size: clamp(56px, 9vw, 86px);
  font-weight: 800;
  line-height: 0.9;
  letter-spacing: -0.06em;
  color: rgb(37 99 235 / 18%);
}

.not-found h1 {
  margin: 0;
  font-size: clamp(26px, 3vw, 34px);
  color: #14213a;
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
  font-weight: 650;
  color: #fff;
  text-decoration: none;
  background: linear-gradient(135deg, #2f72ff, var(--color-primary-strong));
  border-radius: 9px;
  box-shadow: 0 9px 20px rgb(37 99 235 / 22%);
}

.not-found__link:hover {
  background: linear-gradient(135deg, #1d66ff, #1e40af);
}

.not-found__link:focus-visible {
  outline: 3px solid rgb(37 99 235 / 28%);
  outline-offset: 3px;
}

@media (max-width: 767px) {
  .not-found {
    padding: 30px 24px;
    margin-top: 24px;
  }
}
</style>
