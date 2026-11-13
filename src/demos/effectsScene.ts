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

const statusLabels: Record<EffectSceneId, string> = {
  'height-fog': '正在准备高度雾场景…',
  lightning: '正在准备雨幕与闪电场景…',
  'near-ground-skybox': '正在准备近地天空盒…',
  skybox: '正在准备六面天空盒…',
  'volumetric-cloud': '正在准备体积云场景…',
}

export async function createEffectsScene(
  viewer: Viewer,
  sceneId: EffectSceneId,
  setStatus: (message: string) => void,
  options: CreateEffectsSceneOptions = {},
): Promise<EffectsScene> {
  setStatus(statusLabels[sceneId])

  switch (sceneId) {
    case 'skybox':
      return createSkyboxScene(viewer, setStatus)
    case 'near-ground-skybox':
      return createNearGroundSkyboxScene(viewer, { setStatus })
    case 'volumetric-cloud':
      return createVolumetricCloudScene(viewer, { setStatus })
    case 'lightning':
      return createLightningScene(viewer, {
        createAudio: options.createAudio,
        setStatus,
      })
    case 'height-fog':
      return createHeightFogScene(viewer, {
        setStatus,
        signal: options.signal,
      })
  }
}
