import * as Cesium from 'cesium'

import type { EffectsScene, VolumetricCloudControls } from '@/demos/effects/types'

export const DEFAULT_CLOUD_SCALE = { x: 25, y: 12 } as const
export const DEFAULT_CLOUD_BRIGHTNESS = 1

interface CreateVolumetricCloudSceneOptions {
  setStatus: (message: string) => void
}

export function createVolumetricCloudScene(
  viewer: Cesium.Viewer,
  { setStatus }: CreateVolumetricCloudSceneOptions,
): EffectsScene {
  const collection = new Cesium.CloudCollection({ noiseDetail: 16 })
  const cloud = collection.add({
    brightness: DEFAULT_CLOUD_BRIGHTNESS,
    position: Cesium.Cartesian3.fromDegrees(114.39264, 30.52252, 200),
    scale: new Cesium.Cartesian2(DEFAULT_CLOUD_SCALE.x, DEFAULT_CLOUD_SCALE.y),
    slice: 0.36,
  })

  viewer.scene.primitives.add(collection)
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(114.401867, 30.520423, 243.7),
    duration: 2,
    orientation: {
      heading: Cesium.Math.toRadians(281.8),
      pitch: Cesium.Math.toRadians(-6.6),
      roll: 0,
    },
  })

  let scaleX: number = DEFAULT_CLOUD_SCALE.x
  let scaleY: number = DEFAULT_CLOUD_SCALE.y

  function refresh() {
    if (collection.show) {
      viewer.scene.requestRender()
    }
  }

  const cloudControls: VolumetricCloudControls = {
    setBrightness: (brightness) => {
      cloud.brightness = Math.min(1, Math.max(0, brightness))
      refresh()
    },
    setScale: (x, y) => {
      scaleX = Math.min(2_500, Math.max(5, x))
      scaleY = Math.min(1_500, Math.max(5, y))
      cloud.scale = new Cesium.Cartesian2(scaleX, scaleY)
      refresh()
    },
  }

  setStatus('已按参考位置加载体积云，可实时调整尺寸与亮度')

  return {
    actions: [],
    cloudControls,
    dispose: () => {
      collection.show = false
      viewer.scene.primitives.remove(collection)
      if (typeof collection.isDestroyed !== 'function' || !collection.isDestroyed()) {
        collection.destroy?.()
      }
    },
  }
}
