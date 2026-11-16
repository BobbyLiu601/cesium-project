import type { Ref } from 'vue'

import type { DemoScene } from '@/demos/useDemoGlobe'

export type SpecialShapeAnimationState = 'playing' | 'paused'

export interface SpecialShapeScene extends DemoScene {
  animationState?: Ref<SpecialShapeAnimationState>
  toggleAnimation?: () => void
}

export interface CreateSpecialShapeSceneOptions {
  signal?: AbortSignal
}

export type StatusReporter = (message: string) => void
