import * as Cesium from 'cesium'

import { clamp01, framePositions, loadSpatialTerrain, throwIfAborted } from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter } from '@/demos/spatial/types'

const INUNDATION_START_HEIGHT = 1_000
const INUNDATION_TARGET_HEIGHT = 3_600
const INUNDATION_DURATION_MS = 4_500
const INUNDATION_CAMERA_RANGE_FACTOR = 3.1

const inundationPolygon = [
  [98.676842346815, 27.571578111198868],
  [98.86252156624968, 27.77444519911974],
  [98.76756234288729, 27.800244194152533],
  [98.57088699052892, 27.72492584876768],
  [98.676842346815, 27.571578111198868],
] as const

export async function createInundationScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): Promise<SpatialScene> {
  const terrain = await loadSpatialTerrain(viewer, signal)
  throwIfAborted(signal)
  const positions = Cesium.Cartesian3.fromDegreesArray(
    inundationPolygon.flatMap(([longitude, latitude]) => [longitude, latitude]),
  )
  let startedAt = performance.now()
  let completed = false

  const waterEntity = viewer.entities.add({
    id: 'simple-inundation-water',
    name: '简易淹没水体',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      extrudedHeight: new Cesium.CallbackProperty(() => {
        const progress = clamp01((performance.now() - startedAt) / INUNDATION_DURATION_MS)
        return (
          INUNDATION_START_HEIGHT + (INUNDATION_TARGET_HEIGHT - INUNDATION_START_HEIGHT) * progress
        )
      }, false),
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('rgba(40, 169, 224, 0.62)'),
      ),
      perPositionHeight: true,
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('rgba(191, 238, 255, 0.95)'),
    },
  })

  framePositions(viewer, positions, 18, -58, INUNDATION_CAMERA_RANGE_FACTOR)
  setStatus(
    terrain.loaded
      ? '已加载参考区域山体地形，淹没水体正从 1000 米上涨至 3600 米'
      : '地形服务不可用，已回退椭球地形；淹没水体仍从 1000 米上涨至 3600 米',
  )

  const tick = () => {
    viewer.scene.requestRender()
    if (!completed && performance.now() - startedAt >= INUNDATION_DURATION_MS) {
      completed = true
      setStatus('淹没水体已达到 3600 米目标高度，上涨动画已停止')
    }
  }
  viewer.scene.preUpdate.addEventListener(tick)

  return {
    actions: [
      {
        id: 'replay-inundation',
        label: '重播淹没',
        run() {
          startedAt = performance.now()
          completed = false
          setStatus('淹没动画已重新开始，水体将从 1000 米上涨至 3600 米')
          viewer.scene.requestRender()
        },
      },
    ],
    dispose() {
      viewer.scene.preUpdate.removeEventListener(tick)
      viewer.entities.remove(waterEntity)
    },
  }
}
