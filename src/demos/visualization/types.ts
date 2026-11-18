import type { Ref } from 'vue'

export type VisualizationAnimationState = 'playing' | 'paused'

export interface VisualizationLegend {
  colors: readonly string[]
  maximumLabel: string
  minimumLabel: string
  title: string
}

export interface VisualizationScene {
  actions: []
  animationState?: Ref<VisualizationAnimationState>
  dispose: () => void
  legend?: VisualizationLegend
  toggleAnimation?: () => void
}

export type StatusReporter = (message: string) => void

export interface CreateVisualizationSceneOptions {
  signal?: AbortSignal
}
