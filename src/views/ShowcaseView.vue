<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import FeatureCard from '@/components/FeatureCard.vue'
import FeatureDialog from '@/components/FeatureDialog.vue'
import PageHeading from '@/components/PageHeading.vue'
import {
  effectSection,
  effectsMenuGroup,
  formatMenuGroupTitle,
  getFeatureById,
  layerSections,
  layersMenuGroup,
  spatialSection,
  spatialMenuGroup,
  type FeatureItem,
  type FeatureSection,
} from '@/data/layers'

const route = useRoute()
const router = useRouter()
const lastClosedFeatureId = ref('')

const activeFeature = computed(() => {
  const featureId = typeof route.meta.featureId === 'string' ? route.meta.featureId : undefined
  return getFeatureById(featureId)
})

const gridTestIds: Record<FeatureSection['id'], string> = {
  imagery: 'feature-grid',
  terrain: 'terrain-grid',
  vector: 'vector-grid',
  model: 'model-grid',
  spatial: 'spatial-grid',
  effects: 'effects-grid',
}

async function openFeature(feature: FeatureItem) {
  if (!feature.routeName) {
    return
  }

  await router.push({ name: feature.routeName })
}

async function closeFeatureDialog() {
  const feature = activeFeature.value
  if (!feature) {
    return
  }

  lastClosedFeatureId.value = feature.id
  await router.replace({ name: 'layers', hash: `#${feature.id}` })
  await nextTick()
  await new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
      return
    }

    setTimeout(resolve, 0)
  })
  await restoreFeatureFocus(feature.id)
}

async function restoreFeatureFocus(featureId: string) {
  await nextTick()
  if (activeFeature.value || !featureId) {
    return
  }

  document.querySelector<HTMLButtonElement>(`[data-feature-id="${featureId}"]`)?.focus()
}

watch(
  () => route.fullPath,
  () => {
    if (!activeFeature.value) {
      lastClosedFeatureId.value = ''
    }
  },
)
</script>

<template>
  <div class="showcase" data-testid="showcase-view">
    <section id="layers" class="showcase__section" aria-labelledby="layers-heading">
      <PageHeading
        heading-id="layers-heading"
        :icon="layersMenuGroup.icon"
        :level="1"
        :title="formatMenuGroupTitle(layersMenuGroup)"
      />

      <div
        v-for="section in layerSections"
        :id="section.id"
        :key="section.id"
        class="showcase__group"
        :data-section-id="section.id"
        :data-navigation-anchor="section.id"
      >
        <div class="showcase__group-heading">
          <h2 :id="`${section.id}-heading`" class="showcase__group-title">
            {{ section.code }}、{{ section.title }}
          </h2>
          <span class="showcase__group-count">{{ section.items.length }} 项</span>
        </div>

        <div class="showcase__body">
          <div class="feature-grid" :data-testid="gridTestIds[section.id]">
            <FeatureCard
              v-for="feature in section.items"
              :id="feature.id"
              :key="feature.id"
              :feature="feature"
              :data-nav-anchor="feature.id"
              @activate="openFeature(feature)"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      id="spatial"
      class="showcase__section"
      aria-labelledby="spatial-heading"
      data-navigation-anchor="spatial"
    >
      <PageHeading
        heading-id="spatial-heading"
        :icon="spatialMenuGroup.icon"
        :level="2"
        :title="formatMenuGroupTitle(spatialMenuGroup)"
      />

      <div class="showcase__group" :data-section-id="spatialSection.id">
        <div class="showcase__group-heading">
          <h2 :id="`${spatialSection.id}-group-heading`" class="showcase__group-title">
            {{ spatialSection.code }}、{{ spatialSection.title }}
          </h2>
          <span class="showcase__group-count">{{ spatialSection.items.length }} 项</span>
        </div>

        <div class="showcase__body">
          <div class="feature-grid" :data-testid="gridTestIds.spatial">
            <FeatureCard
              v-for="feature in spatialSection.items"
              :id="feature.id"
              :key="feature.id"
              :feature="feature"
              :data-nav-anchor="feature.id"
              @activate="openFeature(feature)"
            />
          </div>
        </div>
      </div>
    </section>

    <section
      id="effects"
      class="showcase__section"
      aria-labelledby="effects-heading"
      data-navigation-anchor="effects"
    >
      <PageHeading
        heading-id="effects-heading"
        :icon="effectsMenuGroup.icon"
        :level="2"
        :title="formatMenuGroupTitle(effectsMenuGroup)"
      />

      <div class="showcase__group" :data-section-id="effectSection.id">
        <div class="showcase__group-heading">
          <h2 :id="`${effectSection.id}-group-heading`" class="showcase__group-title">
            {{ effectSection.code }}、{{ effectSection.title }}
          </h2>
          <span class="showcase__group-count">{{ effectSection.items.length }} 项</span>
        </div>

        <div class="showcase__body">
          <div class="feature-grid" :data-testid="gridTestIds.effects">
            <FeatureCard
              v-for="feature in effectSection.items"
              :id="feature.id"
              :key="feature.id"
              :feature="feature"
              :data-nav-anchor="feature.id"
              @activate="openFeature(feature)"
            />
          </div>
        </div>
      </div>
    </section>

    <FeatureDialog
      v-if="activeFeature"
      :key="activeFeature.id"
      :feature="activeFeature"
      :model-value="true"
      @update:model-value="closeFeatureDialog"
      @closed="restoreFeatureFocus(lastClosedFeatureId || activeFeature?.id || '')"
    />
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

.showcase__group {
  padding: 0 20px;
  scroll-margin-top: 20px;
}

.showcase__group + .showcase__group {
  margin-top: 18px;
}

.showcase__group-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 44px;
  padding: 0 20px;
  background: transparent;
}

.showcase__group-title {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text);
}

.showcase__group-count {
  flex: 0 0 auto;
  padding: 2px 9px;
  font-size: 12px;
  color: var(--color-text-secondary);
  background: var(--color-surface-subtle);
  border-radius: 999px;
}

.showcase__body {
  padding: 20px;
  margin: 0;
  background: var(--color-surface-card);
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

  .showcase__group {
    padding: 0 12px;
  }

  .showcase__group-heading {
    padding: 0 8px;
  }

  .showcase__body {
    padding: 12px;
  }
}
</style>
