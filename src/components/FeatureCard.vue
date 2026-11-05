<script setup lang="ts">
import type { FeatureItem } from '@/data/features'

defineProps<{
  feature: FeatureItem
}>()

const emit = defineEmits<{
  activate: []
}>()
</script>

<template>
  <button
    type="button"
    class="feature-card"
    data-testid="feature-card"
    :data-feature-id="feature.id"
    :aria-label="`打开${feature.name}`"
    @click="emit('activate')"
  >
    <span class="feature-card__media">
      <img :src="feature.imageSrc" :alt="feature.imageAlt" loading="lazy" />
    </span>
    <span class="feature-card__body">
      <span class="feature-card__title">{{ feature.name }}</span>
    </span>
  </button>
</template>

<style scoped>
.feature-card {
  width: 100%;
  padding: 0;
  overflow: hidden;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
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

.feature-card:focus-visible {
  outline: 3px solid rgb(37 99 235 / 32%);
  outline-offset: 3px;
}

.feature-card__media {
  display: block;
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
  display: block;
  padding: 17px 19px 19px;
}

.feature-card__title {
  display: block;
  font-size: 17px;
  font-weight: 700;
  color: var(--color-text);
}
</style>
