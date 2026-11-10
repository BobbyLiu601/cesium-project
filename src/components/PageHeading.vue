<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ElIcon } from 'element-plus'

const props = defineProps<{
  title: string
  icon: Component
  headingId?: string
  level?: 1 | 2
}>()

const headingTag = computed(() => `h${props.level ?? 1}`)
</script>

<template>
  <header class="page-heading" data-testid="page-heading">
    <ElIcon class="page-heading__icon" aria-hidden="true">
      <component :is="icon" />
    </ElIcon>
    <component :is="headingTag" :id="headingId" class="page-heading__title">
      {{ title }}
    </component>
  </header>
</template>

<style scoped>
.page-heading {
  position: relative;
  display: flex;
  align-items: center;
  gap: 11px;
  min-height: 84px;
  padding: 0 40px;
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
}

.page-heading::after {
  position: absolute;
  right: 40px;
  bottom: 0;
  left: 40px;
  height: 2px;
  content: '';
  background: rgb(214 60 70 / 22%);
}

.page-heading__icon {
  flex: 0 0 auto;
  font-size: 22px;
  color: var(--color-primary);
}

.page-heading__title {
  margin: 0;
  overflow: hidden;
  font-size: 24px;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: var(--color-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 767px) {
  .page-heading {
    min-height: 68px;
    padding: 0 16px;
  }

  .page-heading::after {
    right: 16px;
    left: 16px;
  }

  .page-heading__icon {
    font-size: 20px;
  }

  .page-heading__title {
    font-size: 21px;
  }
}
</style>
