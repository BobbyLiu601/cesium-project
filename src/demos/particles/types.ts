import type { Ref } from 'vue'

import type { DemoScene } from '@/demos/useDemoGlobe'

export interface ParticleEffectsScene extends DemoScene {
  paused: Ref<boolean>
  pause: () => void
  resume: () => void
}
