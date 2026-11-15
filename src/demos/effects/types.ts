import type { Ref } from 'vue'

import type { DemoScene } from '@/demos/useDemoGlobe'

export type ThunderAudioState = 'idle' | 'playing' | 'blocked' | 'error'

export interface ThunderAudioController {
  state: Ref<ThunderAudioState>
  play: () => Promise<void>
  dispose: () => void
}

export interface VolumetricCloudControls {
  setScale: (x: number, y: number) => void
  setBrightness: (brightness: number) => void
}

export type NearGroundMode = 'near-ground' | 'atmosphere'

export interface EffectsScene extends DemoScene {
  audioState?: Ref<ThunderAudioState>
  cloudControls?: VolumetricCloudControls
  nearGroundMode?: Ref<NearGroundMode>
  retryAudio?: () => Promise<void>
}
