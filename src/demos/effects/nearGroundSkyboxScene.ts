import * as Cesium from 'cesium'
import { ref } from 'vue'

import negativeX from '@/assets/skyboxes/near-ground/negative-x.jpg'
import negativeY from '@/assets/skyboxes/near-ground/negative-y.jpg'
import negativeZ from '@/assets/skyboxes/near-ground/negative-z.jpg'
import positiveX from '@/assets/skyboxes/near-ground/positive-x.jpg'
import positiveY from '@/assets/skyboxes/near-ground/positive-y.jpg'
import positiveZ from '@/assets/skyboxes/near-ground/positive-z.jpg'
import type { EffectsScene, NearGroundMode, NearGroundSkyboxControls } from '@/demos/effects/types'

export const NEAR_GROUND_SKYBOX_THRESHOLD = 225_705

interface CreateNearGroundSkyboxSceneOptions {
  setStatus: (message: string) => void
}

export function createNearGroundSkyboxScene(
  viewer: Cesium.Viewer,
  { setStatus }: CreateNearGroundSkyboxSceneOptions,
): EffectsScene {
  const originalSkyBox = viewer.scene.skyBox
  const originalAtmosphereVisibility = viewer.scene.skyAtmosphere?.show ?? true
  const nearGroundSkyBox = new Cesium.SkyBox({
    sources: {
      negativeX,
      negativeY,
      negativeZ,
      positiveX,
      positiveY,
      positiveZ,
    },
  })
  const mode = ref<NearGroundMode>('near-ground')

  function updateVisibility() {
    const height = viewer.camera.positionCartographic.height
    const nextMode = height < NEAR_GROUND_SKYBOX_THRESHOLD ? 'near-ground' : 'atmosphere'

    if (mode.value !== nextMode) {
      mode.value = nextMode
      setStatus(
        nextMode === 'near-ground' ? '已进入低空近地全景天空盒' : '已升至高空，恢复标准天空与大气',
      )
    }

    viewer.scene.skyBox = nextMode === 'near-ground' ? nearGroundSkyBox : originalSkyBox
    if (viewer.scene.skyAtmosphere) {
      viewer.scene.skyAtmosphere.show = nextMode !== 'near-ground'
    }
  }

  function focusLow() {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(-95.166493, 39.9060534, 3_336.6),
      orientation: {
        heading: Cesium.Math.toRadians(351.2),
        pitch: Cesium.Math.toRadians(-6.7),
        roll: 0,
      },
    })
    updateVisibility()
    viewer.scene.requestRender()
  }

  function focusHigh() {
    viewer.camera.setView({
      destination: Cesium.Cartesian3.fromDegrees(
        -95.166493,
        39.9060534,
        NEAR_GROUND_SKYBOX_THRESHOLD + 1,
      ),
      orientation: {
        heading: Cesium.Math.toRadians(351.2),
        pitch: Cesium.Math.toRadians(-6.7),
        roll: 0,
      },
    })
    updateVisibility()
    viewer.scene.requestRender()
  }

  const controls: NearGroundSkyboxControls = {
    focusHigh,
    focusLow,
    mode,
  }

  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.scene.postRender.addEventListener(updateVisibility)
  focusLow()
  setStatus('低空显示近地全景天空盒，升高到阈值以上自动恢复大气层')

  return {
    actions: [
      {
        id: 'near-ground-focus',
        label: '观察近地全景',
        run: focusLow,
      },
      {
        id: 'near-ground-high',
        label: '升至高空',
        run: focusHigh,
      },
    ],
    dispose: () => {
      viewer.scene.postRender.removeEventListener(updateVisibility)
      viewer.scene.skyBox = originalSkyBox
      if (viewer.scene.skyAtmosphere) {
        viewer.scene.skyAtmosphere.show = originalAtmosphereVisibility
      }
      if (typeof nearGroundSkyBox.isDestroyed !== 'function' || !nearGroundSkyBox.isDestroyed()) {
        nearGroundSkyBox.destroy?.()
      }
    },
    nearGroundControls: controls,
  }
}
