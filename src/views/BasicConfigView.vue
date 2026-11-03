<script setup lang="ts">
import FeatureCard from '@/components/FeatureCard.vue'
import { featureItems } from '@/data/features'
</script>

<template>
  <section class="basic-config">
    <header class="basic-config__heading">
      <p class="basic-config__eyebrow">展示能力</p>
      <h1>基础配置</h1>
      <p>从统一入口浏览当前已准备的展示能力。</p>
    </header>

    <div class="feature-grid" data-testid="feature-grid">
      <FeatureCard v-for="feature in featureItems" :key="feature.id" :feature="feature" />
    </div>
  </section>
</template>

<style scoped>
.basic-config {
  width: 100%;
  max-width: 1280px;
  min-height: 100%;
  padding: 32px;
  margin: 0 auto;
}

.basic-config__heading {
  max-width: 660px;
  margin-bottom: 26px;
}

.basic-config__eyebrow {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: var(--color-primary);
  text-transform: uppercase;
}

.basic-config__heading h1 {
  margin: 0;
  font-size: clamp(25px, 2.5vw, 32px);
  line-height: 1.2;
  color: #14213a;
}

.basic-config__heading p:last-child {
  margin: 10px 0 0;
  line-height: 1.7;
  color: var(--color-text-secondary);
}

.feature-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 24px;
}

@media (min-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .feature-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .basic-config {
    padding: 22px 16px 28px;
  }

  .basic-config__heading {
    margin-bottom: 20px;
  }
}
</style>
