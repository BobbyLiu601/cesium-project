import * as Cesium from 'cesium'

import { createContinuousRenderTicker, framePositions } from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter } from '@/demos/spatial/types'

const WATER_CAMERA_RANGE_FACTOR = 1.85

const waterPolygon = [
  [90, 29],
  [91, 29],
  [91, 30],
  [90, 30],
] as const

export function createWaterSurfaceScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpatialScene {
  const positions = Cesium.Cartesian3.fromDegreesArray(
    waterPolygon.flatMap(([longitude, latitude]) => [longitude, latitude]),
  )
  const material = Cesium.Material.fromType('Water', {
    baseWaterColor: Cesium.Color.fromCssColorString('rgba(31, 111, 173, 0.88)'),
    blendColor: Cesium.Color.fromCssColorString('rgba(10, 52, 84, 0.92)'),
    normalMap: Cesium.buildModuleUrl('Assets/Textures/waterNormals.jpg'),
    frequency: 1_000,
    animationSpeed: 0.01,
    amplitude: 10,
    specularIntensity: 1.5,
  })
  const waterPrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: Cesium.PolygonGeometry.fromPositions({
        positions,
      }),
    }),
    appearance: new Cesium.EllipsoidSurfaceAppearance({
      material,
    }),
    asynchronous: false,
  })
  viewer.scene.primitives.add(waterPrimitive)

  const borderPositions = positions.concat(positions[0] ?? [])
  const borderEntity = viewer.entities.add({
    id: 'water-surface-border',
    name: '水域面边界',
    polyline: {
      positions: borderPositions,
      width: 3,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('rgba(176, 226, 248, 0.92)'),
      ),
      clampToGround: true,
    },
  })

  framePositions(viewer, positions, 0, -78, WATER_CAMERA_RANGE_FACTOR)
  setStatus('已展示 90°–91°E、29°–30°N 的动态水域面，水面波纹持续流动')
  const stopRenderTicker = createContinuousRenderTicker(viewer)

  return {
    actions: [],
    dispose() {
      stopRenderTicker()
      viewer.scene.primitives.remove(waterPrimitive)
      viewer.entities.remove(borderEntity)
    },
  }
}
