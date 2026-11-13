import * as Cesium from 'cesium'

import negativeX from '@/assets/skyboxes/sky/negative-x.jpg'
import negativeY from '@/assets/skyboxes/sky/negative-y.jpg'
import negativeZ from '@/assets/skyboxes/sky/negative-z.jpg'
import positiveX from '@/assets/skyboxes/sky/positive-x.jpg'
import positiveY from '@/assets/skyboxes/sky/positive-y.jpg'
import positiveZ from '@/assets/skyboxes/sky/positive-z.jpg'
import type { EffectsScene } from '@/demos/effects/types'

export interface EffectStatusReporter {
  (message: string): void
}

export function createSkyboxScene(
  viewer: Cesium.Viewer,
  setStatus: EffectStatusReporter,
): EffectsScene {
  const originalSkyBox = viewer.scene.skyBox
  const skyBox = new Cesium.SkyBox({
    sources: {
      negativeX,
      negativeY,
      negativeZ,
      positiveX,
      positiveY,
      positiveZ,
    },
  })

  viewer.scene.skyBox = skyBox
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(-95.166493, 39.9060534, 20_000_000),
  })
  setStatus('已加载本地六面天空盒，可拖拽旋转观察全景星图')

  return {
    actions: [],
    dispose: () => {
      viewer.scene.skyBox = originalSkyBox
      if (typeof skyBox.isDestroyed !== 'function' || !skyBox.isDestroyed()) {
        skyBox.destroy?.()
      }
    },
  }
}
