<script setup lang="ts">
import { Setting } from '@element-plus/icons-vue'
import { nextTick, ref } from 'vue'

import { disposeActiveSession } from '@/components/cesiumGlobeSession'
import ElevationDialog from '@/components/ElevationDialog.vue'
import FeatureCard from '@/components/FeatureCard.vue'
import PageHeading from '@/components/PageHeading.vue'
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
    <PageHeading title="基础配置" :icon="Setting" />

    <div class="basic-config__body">
      <div class="feature-grid" data-testid="feature-grid">
        <FeatureCard
          v-for="feature in featureItems"
          :key="feature.id"
          :feature="feature"
          @activate="openFeature(feature.id)"
        />
      </div>
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
  min-height: 100%;
  background: var(--color-background);
}

.basic-config__body {
  padding: 32px 40px 40px;
}

.feature-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 16px;
}

@media (min-width: 768px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (min-width: 1200px) {
  .feature-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .basic-config__body {
    padding: 20px 16px 28px;
  }
}
</style>
