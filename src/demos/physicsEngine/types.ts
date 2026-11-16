import type { Ref } from 'vue'

import type AmmoFactory from 'ammojs-typed'
import type { PhysicsEngineSceneId } from '@/data/layers'
import type { DemoScene } from '@/demos/useDemoGlobe'

export type AmmoApi = Awaited<ReturnType<typeof AmmoFactory>>

export type PhysicsAnimationState = 'playing' | 'paused'

export interface PhysicsControl {
  id: string
  label: string
  ariaLabel: string
  keys?: string[]
  kind?: 'hold' | 'tap'
  press: () => void
  release?: () => void
}

export interface PhysicsSceneStats {
  bodyCount: number
  brokenBodyCount: number
  dynamicBodyCount: number
  projectileCount: number
  softBodyCount: number
  vehicleSpeed: number
}

export interface PhysicsEngineScene extends DemoScene {
  animationState: Ref<PhysicsAnimationState>
  controls: PhysicsControl[]
  stats: Readonly<Ref<PhysicsSceneStats>>
  reset: () => void
  toggleAnimation: () => void
}

export interface CreatePhysicsEngineSceneOptions {
  loadAmmo?: () => Promise<AmmoApi>
  signal?: AbortSignal
}

export interface PhysicsSceneDefinition {
  initialStatus: string
  site: {
    height: number
    latitude: number
    longitude: number
  }
  hint: string
  id: PhysicsEngineSceneId
}
