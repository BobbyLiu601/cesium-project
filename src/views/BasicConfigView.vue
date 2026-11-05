<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { disposeActiveSession } from '@/components/cesiumGlobeSession'
import ElevationDialog from '@/components/ElevationDialog.vue'
import FeatureCard from '@/components/FeatureCard.vue'
import ThreeDimensionalEarthDialog from '@/components/ThreeDimensionalEarthDialog.vue'
import { featureItems } from '@/data/features'

const earthDialogVisible = ref(false)
const elevationDialogVisible = ref(false)

function openFeature(featureId: string) {
  if (featureId === 'three-dimensional-earth') {
    elevationDialogVisible.value = false
    disposeActiveSession()
    earthDialogVisible.value = true
    return
  }

  if (featureId === 'elevation') {
    earthDialogVisible.value = false
    disposeActiveSession()
    elevationDialogVisible.value = true
  }
}

async function restoreFeatureFocus(featureId: string) {
  await nextTick()
  if (earthDialogVisible.value || elevationDialogVisible.value) {
    return
  }

  document.querySelector<HTMLButtonElement>(`[data-feature-id="${featureId}"]`)?.focus()
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

    <ThreeDimensionalEarthDialog
      v-model="earthDialogVisible"
      @closed="restoreFeatureFocus('three-dimensional-earth')"
    />
    <ElevationDialog v-model="elevationDialogVisible" @closed="restoreFeatureFocus('elevation')" />
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
