import * as Cesium from 'cesium'

import {
  clamp01,
  createAbortError,
  framePositions,
  loadSpatialTerrain,
  throwIfAborted,
  waitForLoad,
} from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter } from '@/demos/spatial/types'

const INUNDATION_START_HEIGHT = 1_000
const INUNDATION_TARGET_HEIGHT = 2_000
const INUNDATION_DURATION_MS = 4_500
const INUNDATION_CAMERA_RANGE_FACTOR = 3.1
const INUNDATION_TERRAIN_GRID_SIZE = 5
const INUNDATION_TERRAIN_SAMPLE_TIMEOUT_MS = 20_000

const inundationPolygon = [
  [98.676842346815, 27.571578111198868],
  [98.86252156624968, 27.77444519911974],
  [98.76756234288729, 27.800244194152533],
  [98.57088699052892, 27.72492584876768],
  [98.676842346815, 27.571578111198868],
] as const

function buildInundationTerrainSamples() {
  const longitudes = inundationPolygon.map(([longitude]) => longitude)
  const latitudes = inundationPolygon.map(([, latitude]) => latitude)
  const west = Math.min(...longitudes)
  const east = Math.max(...longitudes)
  const south = Math.min(...latitudes)
  const north = Math.max(...latitudes)
  const positions: Cesium.Cartographic[] = []

  for (let row = 0; row < INUNDATION_TERRAIN_GRID_SIZE; row += 1) {
    const latitude = south + ((north - south) * row) / (INUNDATION_TERRAIN_GRID_SIZE - 1)
    for (let column = 0; column < INUNDATION_TERRAIN_GRID_SIZE; column += 1) {
      const longitude = west + ((east - west) * column) / (INUNDATION_TERRAIN_GRID_SIZE - 1)
      positions.push(Cesium.Cartographic.fromDegrees(longitude, latitude))
    }
  }

  return positions
}

async function prepareInundationTerrain(
  terrainProvider: Cesium.TerrainProvider,
  signal?: AbortSignal,
) {
  try {
    const samplePromise = Cesium.sampleTerrainMostDetailed(
      terrainProvider,
      buildInundationTerrainSamples(),
    )
    await waitForLoad(samplePromise, {
      signal,
      timeoutMs: INUNDATION_TERRAIN_SAMPLE_TIMEOUT_MS,
      timeoutMessage: '淹没分析高程加载超时',
    })
    return true
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError()
    }
    console.error('淹没分析高程加载失败，已按当前地形继续渲染。', error)
    return false
  }
}

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

  framePositions(viewer, positions, 18, -58, INUNDATION_CAMERA_RANGE_FACTOR)
  const terrainElevationLoaded = terrain.loaded
    ? await prepareInundationTerrain(terrain.provider, signal)
    : true
  throwIfAborted(signal)

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

  setStatus(
    terrain.loaded
      ? terrainElevationLoaded
        ? '高程加载完成，淹没水体正从 1000 米上涨至 2000 米'
        : '高程加载超时，已按当前地形渲染；淹没水体正从 1000 米上涨至 2000 米'
      : '地形服务不可用，已回退椭球地形；淹没水体仍从 1000 米上涨至 2000 米',
  )

  const tick = () => {
    viewer.scene.requestRender()
    if (!completed && performance.now() - startedAt >= INUNDATION_DURATION_MS) {
      completed = true
      setStatus('淹没水体已达到 2000 米目标高度，上涨动画已停止')
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
          setStatus('淹没动画已重新开始，水体将从 1000 米上涨至 2000 米')
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
