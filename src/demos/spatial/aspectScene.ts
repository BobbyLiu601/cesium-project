import * as Cesium from 'cesium'

import {
  createAbortError,
  framePositions,
  loadSpatialTerrain,
  throwIfAborted,
  waitForLoad,
} from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter } from '@/demos/spatial/types'

const ASPECT_GRID_SIZE = 30
const ASPECT_SURFACE_OFFSET = 8
const ASPECT_ARROW_OFFSET = 18
const ASPECT_CAMERA_RANGE_FACTOR = 2.8
const ASPECT_TERRAIN_SAMPLE_TIMEOUT_MS = 15_000

const aspectColors = [
  { color: '#ff9090', maxSlope: 0.29 },
  { color: '#ff8080', maxSlope: 0.5 },
  { color: '#ff7070', maxSlope: Math.SQRT1_2 },
  { color: '#ff6060', maxSlope: 0.87 },
  { color: '#ff5050', maxSlope: 0.91 },
  { color: '#ff4040', maxSlope: 0.95 },
  { color: '#ff3030', maxSlope: Number.POSITIVE_INFINITY },
] as const

export const aspectLegend = {
  colors: aspectColors.map(({ color }) => color),
  minLabel: '缓',
  maxLabel: '陡',
}

export const aspectLegendGradient = `linear-gradient(90deg, ${aspectLegend.colors.join(', ')})`

// 参考站 4.1.13 坡向分析的区域范围。
const aspectArea = {
  west: 114.20331001281738,
  south: 31.148034709323344,
  east: 114.21009063720703,
  north: 31.154204879640236,
} as const

function getSlopeStyle(slope: number) {
  return (
    aspectColors.find(({ maxSlope }) => slope < maxSlope) ?? aspectColors[aspectColors.length - 1]!
  )
}

function buildAspectGrid() {
  const longitudeStep = (aspectArea.east - aspectArea.west) / (ASPECT_GRID_SIZE - 1)
  const latitudeStep = (aspectArea.north - aspectArea.south) / (ASPECT_GRID_SIZE - 1)
  const longitudes: number[] = []
  const latitudes: number[] = []
  const positions: Cesium.Cartographic[] = []
  const proceduralHeights: number[][] = []

  for (let row = 0; row < ASPECT_GRID_SIZE; row += 1) {
    const latitude = aspectArea.south + row * latitudeStep
    latitudes.push(latitude)
    const heightRow: number[] = []
    for (let column = 0; column < ASPECT_GRID_SIZE; column += 1) {
      if (row === 0) {
        longitudes.push(aspectArea.west + column * longitudeStep)
      }
      const longitude = aspectArea.west + column * longitudeStep
      positions.push(Cesium.Cartographic.fromDegrees(longitude, latitude))
      heightRow.push(
        210 +
          64 * Math.sin(column * 0.54) * Math.cos(row * 0.46) +
          28 * Math.sin((column + row) * 0.34) +
          16 * Math.cos(column * 0.19 - row * 0.27),
      )
    }
    proceduralHeights.push(heightRow)
  }

  return {
    latitudes,
    longitudes,
    longitudeStep,
    latitudeStep,
    positions,
    proceduralHeights,
  }
}

export async function createAspectScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): Promise<SpatialScene> {
  const grid = buildAspectGrid()
  const terrain = await loadSpatialTerrain(viewer, signal)
  throwIfAborted(signal)

  let heights = grid.proceduralHeights
  let terrainHeightsApplied = false
  let terrainSampleFailed = false
  if (terrain.loaded) {
    try {
      const sampledPromise = Cesium.sampleTerrainMostDetailed(terrain.provider, grid.positions)
      const sampled = await waitForLoad(sampledPromise, {
        signal,
        timeoutMs: ASPECT_TERRAIN_SAMPLE_TIMEOUT_MS,
        timeoutMessage: '坡向分析地形采样超时',
      })
      throwIfAborted(signal)
      const sampledHeights = heights.map((row) => row.slice())
      let minimum = Number.POSITIVE_INFINITY
      let maximum = Number.NEGATIVE_INFINITY
      for (const position of sampled) {
        minimum = Math.min(minimum, position.height)
        maximum = Math.max(maximum, position.height)
      }
      if (Number.isFinite(minimum) && maximum - minimum > 1) {
        for (let row = 0; row < ASPECT_GRID_SIZE; row += 1) {
          for (let column = 0; column < ASPECT_GRID_SIZE; column += 1) {
            sampledHeights[row]![column] =
              sampled[row * ASPECT_GRID_SIZE + column]?.height ?? sampledHeights[row]![column]!
          }
        }
        heights = sampledHeights
        terrainHeightsApplied = true
      }
    } catch (error) {
      if (signal?.aborted) {
        throw createAbortError()
      }
      terrainSampleFailed = true
      console.error('坡向分析地形采样失败，已使用本地高程网格。', error)
    }
  }

  const cells: Array<{
    downhillEast: number
    downhillNorth: number
    height: number
    longitude: number
    latitude: number
    slope: number
  }> = []
  const instancesByColor = new Map<string, Cesium.GeometryInstance[]>()
  const cameraPositions: Cesium.Cartesian3[] = []
  const longitudeMeters = Math.cos(Cesium.Math.toRadians(aspectArea.south)) * 111_320
  const cellInset = 0.06

  for (let row = 0; row < ASPECT_GRID_SIZE - 1; row += 1) {
    for (let column = 0; column < ASPECT_GRID_SIZE - 1; column += 1) {
      const heightSouthWest = heights[row]![column]!
      const heightSouthEast = heights[row]![column + 1]!
      const heightNorthWest = heights[row + 1]![column]!
      const heightNorthEast = heights[row + 1]![column + 1]!
      const dzdx = (heightSouthEast + heightNorthEast - heightSouthWest - heightNorthWest) / 2
      const dzdy = (heightNorthWest + heightNorthEast - heightSouthWest - heightSouthEast) / 2
      const eastWestDistance = grid.longitudeStep * longitudeMeters
      const northSouthDistance = grid.latitudeStep * 110_540
      const gradientEast = dzdx / eastWestDistance
      const gradientNorth = dzdy / northSouthDistance
      const slope = Math.hypot(gradientEast, gradientNorth)
      const style = getSlopeStyle(slope)
      const west = grid.longitudes[column]! + grid.longitudeStep * cellInset
      const east = grid.longitudes[column + 1]! - grid.longitudeStep * cellInset
      const south = grid.latitudes[row]! + grid.latitudeStep * cellInset
      const north = grid.latitudes[row + 1]! - grid.latitudeStep * cellInset
      const geometryPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
        west,
        south,
        heightSouthWest + ASPECT_SURFACE_OFFSET,
        east,
        south,
        heightSouthEast + ASPECT_SURFACE_OFFSET,
        east,
        north,
        heightNorthEast + ASPECT_SURFACE_OFFSET,
        west,
        north,
        heightNorthWest + ASPECT_SURFACE_OFFSET,
      ])
      cameraPositions.push(...geometryPositions)
      const geometry = Cesium.PolygonGeometry.fromPositions({
        positions: geometryPositions,
        perPositionHeight: true,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      })
      const instance = new Cesium.GeometryInstance({
        geometry,
        attributes: {
          color: Cesium.ColorGeometryInstanceAttribute.fromColor(
            Cesium.Color.fromCssColorString(style.color).withAlpha(0.88),
          ),
        },
      })
      const colorInstances = instancesByColor.get(style.color) ?? []
      colorInstances.push(instance)
      instancesByColor.set(style.color, colorInstances)
      cells.push({
        downhillEast: -gradientEast,
        downhillNorth: -gradientNorth,
        height: (heightSouthWest + heightSouthEast + heightNorthEast + heightNorthWest) / 4,
        longitude: grid.longitudes[column]! + grid.longitudeStep / 2,
        latitude: grid.latitudes[row]! + grid.latitudeStep / 2,
        slope,
      })
    }
  }

  const primitives: Cesium.Primitive[] = []
  const entities: Cesium.Entity[] = []

  for (const instances of instancesByColor.values()) {
    const primitive = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        translucent: true,
        flat: true,
      }),
      asynchronous: false,
    })
    viewer.scene.primitives.add(primitive)
    primitives.push(primitive)
  }

  let arrowCount = 0
  for (let row = 2; row < ASPECT_GRID_SIZE - 2; row += 3) {
    for (let column = 2; column < ASPECT_GRID_SIZE - 2; column += 3) {
      const cell = cells[(row - 1) * (ASPECT_GRID_SIZE - 1) + (column - 1)]
      if (!cell || cell.slope < 0.025) {
        continue
      }
      const directionLength = Math.hypot(cell.downhillEast, cell.downhillNorth)
      if (directionLength === 0) {
        continue
      }
      const east = cell.downhillEast / directionLength
      const north = cell.downhillNorth / directionLength
      const arrowHalfLength = Math.max(grid.longitudeStep, grid.latitudeStep) * 1.15
      const startLongitude = cell.longitude - east * arrowHalfLength
      const startLatitude = cell.latitude - north * arrowHalfLength
      const endLongitude = cell.longitude + east * arrowHalfLength
      const endLatitude = cell.latitude + north * arrowHalfLength
      const arrowHeight = cell.height + ASPECT_ARROW_OFFSET
      const arrowPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
        startLongitude,
        startLatitude,
        arrowHeight,
        endLongitude,
        endLatitude,
        arrowHeight + 3,
      ])
      entities.push(
        viewer.entities.add({
          id: `aspect-arrow-${arrowCount}`,
          name: '坡向下降方向箭头',
          polyline: {
            positions: arrowPositions,
            width: 7,
            material: new Cesium.PolylineArrowMaterialProperty(
              Cesium.Color.fromCssColorString('#8e1717'),
            ),
          },
        }),
      )
      arrowCount += 1
    }
  }

  framePositions(viewer, cameraPositions, 10, -54, ASPECT_CAMERA_RANGE_FACTOR)
  const terrainMessage = terrainHeightsApplied
    ? '已加载参考区域地形'
    : terrainSampleFailed
      ? '地形采样失败，已使用本地山体高程'
      : terrain.loaded
        ? '地形采样未返回有效高差，已使用本地山体高程'
        : '地形加载失败，已回退椭球地形'
  setStatus(
    `${terrainMessage}并采样 ${ASPECT_GRID_SIZE} × ${ASPECT_GRID_SIZE} 网格，已渲染红色坡度坡面及 ${arrowCount} 个下坡方向箭头`,
  )

  return {
    actions: [],
    dispose() {
      primitives.forEach((primitive) => viewer.scene.primitives.remove(primitive))
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}
