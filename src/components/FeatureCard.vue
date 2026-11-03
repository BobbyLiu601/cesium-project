<script setup lang="ts">
import type { FeatureItem } from '@/data/features'

defineProps<{
  feature: FeatureItem
}>()
</script>

<template>
  <article class="feature-card" data-testid="feature-card">
    <div class="feature-card__media">
      <img :src="feature.imageSrc" :alt="feature.imageAlt" loading="lazy" />
    </div>
    <div class="feature-card__body">
      <h2 class="feature-card__title">{{ feature.name }}</h2>
    </div>
  </article>
</template>

<style scoped>
.feature-card {
  overflow: hidden;
  background: var(--color-surface);
  border: 1px solid rgb(221 230 242 / 90%);
  border-radius: 16px;
  box-shadow: var(--shadow-card);
  transition:
    transform 180ms ease,
    box-shadow 180ms ease;
}

.feature-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 18px 42px rgb(31 56 92 / 12%);
}

.feature-card__media {
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #dbe8f7;
}

.feature-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feature-card__body {
  padding: 17px 19px 19px;
}

.feature-card__title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
}
</style>
