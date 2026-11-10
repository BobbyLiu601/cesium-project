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
  position: relative;
  width: 100%;
  padding: 0;
  overflow: hidden;
  font: inherit;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: var(--color-surface);
  border: 1px solid #d9dcde;
  border-radius: 2px;
  box-shadow: 0 0 3px rgb(150 150 150 / 50%);
  transition:
    transform 400ms ease,
    border-color 400ms ease,
    box-shadow 400ms ease;
}

.feature-card:hover {
  border-color: #b7bdc1;
  box-shadow: 1px 1px 6px rgb(150 150 150 / 60%);
  transform: scale(1.1) translateZ(0);
  z-index: 100;
}

.feature-card:focus-visible {
  outline: 2px solid var(--color-primary);
  outline-offset: 2px;
}

.feature-card__heading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 2px 10px;
  border-bottom: 1px solid #e7e9ea;
}

.feature-card__media {
  display: block;
  aspect-ratio: 4 / 3;
  overflow: hidden;
  background: #e9eaeb;
}

.feature-card__media img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.feature-card__title {
  display: block;
  overflow: hidden;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.3;
  color: #2c3b41;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
