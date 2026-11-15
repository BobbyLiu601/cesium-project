import type { Viewer } from 'cesium'

import type { EffectSceneId } from '@/data/layers'
import { createHeightFogScene } from '@/demos/effects/heightFogScene'
import { createLightningScene } from '@/demos/effects/lightningScene'
import { createNearGroundSkyboxScene } from '@/demos/effects/nearGroundSkyboxScene'
import { createSkyboxScene } from '@/demos/effects/skyboxScene'
import { createVolumetricCloudScene } from '@/demos/effects/volumetricCloudScene'
import type { EffectsScene, ThunderAudioController } from '@/demos/effects/types'

export type {
  EffectsScene,
  NearGroundMode,
  ThunderAudioState,
  VolumetricCloudControls,
} from '@/demos/effects/types'

export interface CreateEffectsSceneOptions {
  createAudio?: () => ThunderAudioController
  signal?: AbortSignal
}

export interface EffectSceneControls {
  audio: boolean
  cloud: boolean
  nearGround: boolean
}

export interface EffectSceneDefinition {
  controls: EffectSceneControls
  initialStatus: string
  create: (
    viewer: Viewer,
    setStatus: (message: string) => void,
    options: CreateEffectsSceneOptions,
  ) => EffectsScene | Promise<EffectsScene>
}

export const EFFECT_SCENE_DEFINITIONS: Record<EffectSceneId, EffectSceneDefinition> = {
  'height-fog': {
    controls: { audio: false, cloud: false, nearGround: false },
    create: (viewer, setStatus, options) =>
      createHeightFogScene(viewer, {
        setStatus,
        signal: options.signal,
      }),
    initialStatus: '正在准备高度雾场景…',
  },
  lightning: {
    controls: { audio: true, cloud: false, nearGround: false },
    create: (viewer, setStatus, options) =>
      createLightningScene(viewer, {
        createAudio: options.createAudio,
        setStatus,
      }),
    initialStatus: '正在准备雨幕与闪电场景…',
  },
  'near-ground-skybox': {
    controls: { audio: false, cloud: false, nearGround: true },
    create: (viewer, setStatus) => createNearGroundSkyboxScene(viewer, { setStatus }),
    initialStatus: '正在准备近地天空盒…',
  },
  skybox: {
    controls: { audio: false, cloud: false, nearGround: false },
    create: (viewer, setStatus) => createSkyboxScene(viewer, setStatus),
    initialStatus: '正在准备六面天空盒…',
  },
  'volumetric-cloud': {
    controls: { audio: false, cloud: true, nearGround: false },
    create: (viewer, setStatus) => createVolumetricCloudScene(viewer, { setStatus }),
    initialStatus: '正在准备体积云场景…',
  },
}

export async function createEffectsScene(
  viewer: Viewer,
  sceneId: EffectSceneId,
  setStatus: (message: string) => void,
  options: CreateEffectsSceneOptions = {},
): Promise<EffectsScene> {
  const definition = EFFECT_SCENE_DEFINITIONS[sceneId]
  setStatus(definition.initialStatus)
  return definition.create(viewer, setStatus, options)
}
