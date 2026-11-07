<script setup lang="ts">
import { nextTick, ref } from 'vue'

import { disposeActiveSession } from '@/components/cesiumGlobeSession'
import FeatureCard from '@/components/FeatureCard.vue'
import RadarDialog from '@/components/RadarDialog.vue'
import { effectItems } from '@/data/features'

const radarDialogVisible = ref(false)

function openFeature(featureId: string) {
  if (featureId === 'radar') {
    disposeActiveSession()
    radarDialogVisible.value = true
  }
}

async function restoreFeatureFocus(featureId: string) {
  await nextTick()
  if (radarDialogVisible.value) {
    return
  }

  document.querySelector<HTMLButtonElement>(`[data-feature-id="${featureId}"]`)?.focus()
}
</script>

<template>
  <section class="effects-view" data-testid="effects-view">
    <div class="feature-grid" data-testid="effect-grid">
      <FeatureCard
        v-for="feature in effectItems"
        :key="feature.id"
        :feature="feature"
        @activate="openFeature(feature.id)"
      />
    </div>

    <RadarDialog v-model="radarDialogVisible" @closed="restoreFeatureFocus('radar')" />
  </section>
</template>

<style scoped>
.effects-view {
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
  .effects-view {
    padding: 22px 16px 28px;
  }
}
</style>
