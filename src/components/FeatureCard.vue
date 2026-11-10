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
    <span class="feature-card__heading">
      <span class="feature-card__title">{{ feature.name }}</span>
    </span>
    <span class="feature-card__media">
      <img :src="feature.imageSrc" :alt="feature.imageAlt" loading="lazy" />
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
  border: 1px solid var(--color-border);
  border-radius: 2px;
  box-shadow: none;
  transition: border-color 160ms ease;
}

.feature-card:hover {
  border-color: #b9bdc1;
}

.feature-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.feature-card__heading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 8px 14px;
  border-bottom: 1px solid #eceef0;
}

.feature-card__media {
  display: block;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  background: #e9eaeb;
}

.feature-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 240ms ease;
}

.feature-card:hover .feature-card__media img {
  transform: scale(1.02);
}

.feature-card__title {
  display: block;
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
