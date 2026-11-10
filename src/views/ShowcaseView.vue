<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { disposeActiveSession } from '@/components/cesiumGlobeSession'
import ElevationDialog from '@/components/ElevationDialog.vue'
import FeatureCard from '@/components/FeatureCard.vue'
import PageHeading from '@/components/PageHeading.vue'
import RadarDialog from '@/components/RadarDialog.vue'
import ThreeDimensionalEarthDialog from '@/components/ThreeDimensionalEarthDialog.vue'
import { featureSections, type FeatureSection } from '@/data/features'

const gridTestIds: Record<FeatureSection['id'], string> = {
  'basic-config': 'feature-grid',
  effects: 'effect-grid',
}

const earthDialogVisible = ref(false)
const elevationDialogVisible = ref(false)
const radarDialogVisible = ref(false)

function closeAllDialogs() {
  earthDialogVisible.value = false
  elevationDialogVisible.value = false
  radarDialogVisible.value = false
}

function openFeature(featureId: string) {
  closeAllDialogs()
  disposeActiveSession()

  if (featureId === 'three-dimensional-earth') {
    earthDialogVisible.value = true
    return
  }

  if (featureId === 'elevation') {
    elevationDialogVisible.value = true
    return
  }

  if (featureId === 'radar') {
    radarDialogVisible.value = true
  }
}

async function restoreFeatureFocus(featureId: string) {
  await nextTick()
  if (earthDialogVisible.value || elevationDialogVisible.value || radarDialogVisible.value) {
    return
  }

  document.querySelector<HTMLButtonElement>(`[data-feature-id="${featureId}"]`)?.focus()
}
</script>

<template>
  <div class="showcase" data-testid="showcase-view">
    <section
      v-for="(section, index) in featureSections"
      :id="section.id"
      :key="section.id"
      class="showcase__section"
      :aria-labelledby="`${section.id}-heading`"
    >
      <PageHeading
        :heading-id="`${section.id}-heading`"
        :icon="section.icon"
        :level="index === 0 ? 1 : 2"
        :title="section.title"
      />

      <div class="showcase__body">
        <div class="feature-grid" :data-testid="gridTestIds[section.id]">
          <FeatureCard
            v-for="feature in section.items"
            :id="feature.id"
            :key="feature.id"
            :feature="feature"
            :data-nav-anchor="feature.id"
            @activate="openFeature(feature.id)"
          />
        </div>
      </div>
    </section>

    <ThreeDimensionalEarthDialog
      v-model="earthDialogVisible"
      @closed="restoreFeatureFocus('three-dimensional-earth')"
    />
    <ElevationDialog v-model="elevationDialogVisible" @closed="restoreFeatureFocus('elevation')" />
    <RadarDialog v-model="radarDialogVisible" @closed="restoreFeatureFocus('radar')" />
  </div>
</template>

<style scoped>
.showcase {
  width: 100%;
  min-height: 100%;
  padding-bottom: min(50dvh, 480px);
  background: var(--color-background);
}

.showcase__section + .showcase__section {
  margin-top: 20px;
}

.showcase__body {
  padding: 20px;
  margin: 16px 20px 20px;
  background: #f9f9f9;
  border-radius: 3px;
}

.feature-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 20px 16px;
}

.showcase :deep(.feature-card) {
  scroll-margin-top: 20px;
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

@media (min-width: 1440px) {
  .feature-grid {
    grid-template-columns: repeat(6, minmax(0, 1fr));
  }
}

@media (max-width: 767px) {
  .showcase__section + .showcase__section {
    margin-top: 16px;
  }

  .showcase__body {
    padding: 12px;
    margin: 12px;
  }
}
</style>
