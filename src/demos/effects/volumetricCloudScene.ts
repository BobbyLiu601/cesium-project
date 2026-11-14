import * as Cesium from 'cesium'

import cloudSpriteUrl from '@/assets/clouds/cumulus-cloud.png'
import type { EffectsScene, VolumetricCloudControls } from '@/demos/effects/types'

export const DEFAULT_CLOUD_SCALE = { x: 600, y: 350 } as const
export const DEFAULT_CLOUD_BRIGHTNESS = 1

interface CloudPuffConfig {
  east: number
  north: number
  height: number
  scaleX: number
  scaleY: number
  brightness: number
  alpha: number
  rotation: number
}

const CLOUD_ORIGIN = {
  longitude: 114.39264,
  latitude: 30.52252,
  height: 200,
} as const

const METERS_PER_LATITUDE_DEGREE = 111_320
const METERS_PER_LONGITUDE_DEGREE =
  METERS_PER_LATITUDE_DEGREE * Math.cos((CLOUD_ORIGIN.latitude * Math.PI) / 180)

const CLOUD_PUFFS: readonly CloudPuffConfig[] = [
  {
    east: 0,
    north: 0,
    height: 100,
    scaleX: 1,
    scaleY: 1,
    brightness: 1,
    alpha: 0.88,
    rotation: 0,
  },
]

interface CreateVolumetricCloudSceneOptions {
  setStatus: (message: string) => void
}

function createCloudColor(brightness: number, alpha: number) {
  const clamped = Math.min(1, Math.max(0, brightness))
  const luminance = 0.1 + clamped * 0.9
  return new Cesium.Color(luminance, luminance, luminance, alpha)
}

export function createVolumetricCloudScene(
  viewer: Cesium.Viewer,
  { setStatus }: CreateVolumetricCloudSceneOptions,
): EffectsScene {
  const collection = new Cesium.BillboardCollection({ scene: viewer.scene })
  const clouds = CLOUD_PUFFS.map((puff) => {
    const billboard = collection.add({
      color: createCloudColor(DEFAULT_CLOUD_BRIGHTNESS * puff.brightness, puff.alpha),
      height: DEFAULT_CLOUD_SCALE.y * puff.scaleY,
      image: cloudSpriteUrl,
      position: Cesium.Cartesian3.fromDegrees(
        CLOUD_ORIGIN.longitude + puff.east / METERS_PER_LONGITUDE_DEGREE,
        CLOUD_ORIGIN.latitude + puff.north / METERS_PER_LATITUDE_DEGREE,
        CLOUD_ORIGIN.height + puff.height,
      ),
      rotation: puff.rotation,
      sizeInMeters: true,
      width: DEFAULT_CLOUD_SCALE.x * puff.scaleX,
    })

    return { billboard, config: puff }
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
      const clamped = Math.min(1, Math.max(0, brightness))
      clouds.forEach(({ billboard, config }) => {
        billboard.color = createCloudColor(clamped * config.brightness, config.alpha)
      })
      refresh()
    },
    setScale: (x, y) => {
      scaleX = Math.min(2_500, Math.max(5, x))
      scaleY = Math.min(1_500, Math.max(5, y))
      clouds.forEach(({ billboard, config }) => {
        billboard.width = scaleX * config.scaleX
        billboard.height = scaleY * config.scaleY
      })
      refresh()
    },
  }

  setStatus('已加载分层仿真云团，可实时调整尺寸与亮度')

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
