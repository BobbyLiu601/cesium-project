<script setup lang="ts">
import { nextTick, ref } from 'vue'

import FeatureCard from '@/components/FeatureCard.vue'
import ThreeDimensionalEarthDialog from '@/components/ThreeDimensionalEarthDialog.vue'
import { featureItems } from '@/data/features'

const earthDialogVisible = ref(false)

function openFeature(featureId: string) {
  if (featureId === 'three-dimensional-earth') {
    earthDialogVisible.value = true
  }
}

async function restoreFeatureFocus() {
  await nextTick()
  document.querySelector<HTMLButtonElement>('[data-feature-id="three-dimensional-earth"]')?.focus()
}
</script>

<template>
  <section class="basic-config">
    <div class="feature-grid" data-testid="feature-grid">
      <FeatureCard
        v-for="feature in featureItems"
        :key="feature.id"
        :feature="feature"
        @activate="openFeature(feature.id)"
      />
    </div>

    <ThreeDimensionalEarthDialog v-model="earthDialogVisible" @closed="restoreFeatureFocus" />
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
}
</style>
