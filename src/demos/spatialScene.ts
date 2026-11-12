import * as Cesium from 'cesium'

import type { SpatialSceneId } from '@/data/layers'

export interface SpatialAction {
  id: string
  label: string
  run: () => void | Promise<void>
}

export interface SunlightRange {
  date: string
  startTime: string
  endTime: string
}

export interface SpatialScene {
  actions: SpatialAction[]
  dispose: () => void
  applySunlightRange?: (range: SunlightRange) => void
}

type StatusReporter = (message: string) => void

export interface CreateSpatialSceneOptions {
  signal?: AbortSignal
  sunlight?: SunlightRange
}

const SPATIAL_TERRAIN_URL = 'https://data.mars3d.cn/terrain'
const TERRAIN_LOAD_TIMEOUT_MS = 12_000
const INUNDATION_START_HEIGHT = 1_000
const INUNDATION_TARGET_HEIGHT = 3_600
const INUNDATION_DURATION_MS = 4_500
const ASPECT_GRID_SIZE = 30
const ASPECT_SURFACE_OFFSET = 8
const ASPECT_ARROW_OFFSET = 18
const INUNDATION_CAMERA_RANGE_FACTOR = 3.1
const SUNLIGHT_CAMERA_RANGE_FACTOR = 2.8
const WATER_CAMERA_RANGE_FACTOR = 1.85
const ASPECT_CAMERA_RANGE_FACTOR = 2.8

const inundationPolygon = [
  [98.676842346815, 27.571578111198868],
  [98.86252156624968, 27.77444519911974],
  [98.76756234288729, 27.800244194152533],
  [98.57088699052892, 27.72492584876768],
] as const

const waterPolygon = [
  [90, 29],
  [91, 29],
  [91, 30],
  [90, 30],
] as const

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

function requestRender(viewer: Cesium.Viewer) {
  viewer.scene.requestRender()
}

function createAbortError() {
  return new DOMException('空间分析场景加载已取消', 'AbortError')
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function setSceneDefaults(viewer: Cesium.Viewer) {
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07111f')
  viewer.scene.globe.enableLighting = false
  viewer.shadows = false
  viewer.clock.shouldAnimate = false
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function framePositions(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  headingDegrees: number,
  pitchDegrees: number,
  rangeFactor: number,
) {
  if (positions.length === 0) {
    return
  }

  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(headingDegrees),
      Cesium.Math.toRadians(pitchDegrees),
      Math.max(650, sphere.radius * rangeFactor),
    ),
  )
}

function createContinuousRenderTicker(viewer: Cesium.Viewer) {
  const tick = () => requestRender(viewer)
  viewer.scene.preUpdate.addEventListener(tick)
  return () => viewer.scene.preUpdate.removeEventListener(tick)
}

function getSlopeStyle(slope: number) {
  return (
    aspectColors.find(({ maxSlope }) => slope < maxSlope) ?? aspectColors[aspectColors.length - 1]!
  )
}

async function createInundationScene(
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
    name: '简易淹没水面',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      height: new Cesium.CallbackProperty(() => {
        const progress = clamp01((performance.now() - startedAt) / INUNDATION_DURATION_MS)
        return (
          INUNDATION_START_HEIGHT + (INUNDATION_TARGET_HEIGHT - INUNDATION_START_HEIGHT) * progress
        )
      }, false),
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('rgba(40, 169, 224, 0.62)'),
      ),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('rgba(191, 238, 255, 0.95)'),
    },
  })

  framePositions(viewer, positions, 18, -58, INUNDATION_CAMERA_RANGE_FACTOR)
  setStatus(
    terrain.loaded
      ? '已加载参考区域山体地形，淹没水面正从 1000 米上涨至 3600 米'
      : '地形服务不可用，已回退椭球地形；淹没水面仍从 1000 米上涨至 3600 米',
  )

  const tick = () => {
    requestRender(viewer)
    if (!completed && performance.now() - startedAt >= INUNDATION_DURATION_MS) {
      completed = true
      setStatus('淹没水面已达到 3600 米目标高度，上涨动画已停止')
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
          setStatus('淹没动画已重新开始，水面将从 1000 米上涨至 3600 米')
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.scene.preUpdate.removeEventListener(tick)
      viewer.entities.remove(waterEntity)
    },
  }
}

function parseSunlightRange(range: SunlightRange) {
  const start = new Date(`${range.date}T${range.startTime}:00`)
  const stop = new Date(`${range.date}T${range.endTime}:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime()) || stop <= start) {
    return undefined
  }
  return { start, stop }
}

function createSunlightScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  initialRange: SunlightRange,
): SpatialScene {
  const entities: Cesium.Entity[] = []
  const center = { longitude: 113.33, latitude: 23.16 }
  const buildingPositions: Cesium.Cartesian3[] = []

  viewer.scene.globe.enableLighting = true
  viewer.shadows = true
  const groundEntity = viewer.entities.add({
    id: 'sunlight-ground',
    name: '日照分析地面基底',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArray([
          center.longitude - 0.009,
          center.latitude - 0.009,
          center.longitude + 0.009,
          center.latitude - 0.009,
          center.longitude + 0.009,
          center.latitude + 0.009,
          center.longitude - 0.009,
          center.latitude + 0.009,
        ]),
      ),
      height: 0,
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('rgba(105, 118, 103, 0.96)'),
      ),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('rgba(54, 68, 58, 0.9)'),
    },
  })
  entities.push(groundEntity)

  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const height = 42 + ((row * 7 + column * 11) % 9) * 16
      const longitude = center.longitude + (column - 2.5) * 0.0022
      const latitude = center.latitude + (row - 2.5) * 0.0022
      const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height / 2)
      buildingPositions.push(position)
      entities.push(
        viewer.entities.add({
          id: `sunlight-building-${row}-${column}`,
          name: '本地低多边形建筑',
          position,
          box: {
            dimensions: new Cesium.Cartesian3(92, 92, height),
            material: Cesium.Color.fromCssColorString(row % 2 === 0 ? '#c8b89a' : '#9aa7b5'),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#243447'),
            shadows: Cesium.ShadowMode.ENABLED,
          },
        }),
      )
    }
  }

  function applyRange(range: SunlightRange, announce: boolean) {
    const parsed = parseSunlightRange(range)
    if (!parsed) {
      setStatus('请选择有效的日期和起止时间，结束时间需要晚于开始时间')
      return
    }

    const startTime = Cesium.JulianDate.fromDate(parsed.start)
    const stopTime = Cesium.JulianDate.fromDate(parsed.stop)
    viewer.clock.startTime = startTime
    viewer.clock.stopTime = stopTime
    viewer.clock.currentTime = startTime.clone()
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
    viewer.clock.multiplier = 900
    viewer.clock.shouldAnimate = false
    if (announce) {
      setStatus(
        `日照区间已更新为 ${range.date} ${range.startTime}–${range.endTime}，当前处于暂停状态`,
      )
    }
    requestRender(viewer)
  }

  applyRange(initialRange, false)
  setStatus(
    `已生成 36 栋本地低多边形建筑，日照日期 ${initialRange.date}，区间 ${initialRange.startTime}–${initialRange.endTime}`,
  )

  const tick = () => {
    if (viewer.clock.shouldAnimate) {
      requestRender(viewer)
    }
  }
  viewer.scene.preUpdate.addEventListener(tick)

  framePositions(viewer, buildingPositions, 26, -41, SUNLIGHT_CAMERA_RANGE_FACTOR)

  return {
    actions: [
      {
        id: 'play-sunlight',
        label: '播放日照',
        run() {
          viewer.clock.shouldAnimate = true
          setStatus('日照模拟播放中，建筑阴影会随所选时间段变化')
          requestRender(viewer)
        },
      },
      {
        id: 'pause-sunlight',
        label: '暂停日照',
        run() {
          viewer.clock.shouldAnimate = false
          setStatus('日照模拟已暂停')
          requestRender(viewer)
        },
      },
    ],
    applySunlightRange(range) {
      applyRange(range, true)
    },
    dispose() {
      viewer.scene.preUpdate.removeEventListener(tick)
      viewer.clock.shouldAnimate = false
      viewer.shadows = false
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createWaterSurfaceScene(viewer: Cesium.Viewer, setStatus: StatusReporter): SpatialScene {
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

async function loadSpatialTerrain(viewer: Cesium.Viewer, signal?: AbortSignal) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined

  try {
    throwIfAborted(signal)
    const terrainProvider = await Promise.race([
      Cesium.CesiumTerrainProvider.fromUrl(SPATIAL_TERRAIN_URL),
      new Promise<never>((_, reject) => {
        if (!signal) {
          return
        }
        abortHandler = () => reject(createAbortError())
        signal.addEventListener('abort', abortHandler, { once: true })
      }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('空间分析地形加载超时')),
          TERRAIN_LOAD_TIMEOUT_MS,
        )
      }),
    ])
    viewer.terrainProvider = terrainProvider
    viewer.scene.globe.depthTestAgainstTerrain = true
    return { provider: terrainProvider, loaded: true }
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError()
    }
    console.error('空间分析地形加载失败，已回退椭球地形。', error)
    const provider = new Cesium.EllipsoidTerrainProvider()
    viewer.terrainProvider = provider
    viewer.scene.globe.depthTestAgainstTerrain = false
    return { provider, loaded: false }
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    if (abortHandler) {
      signal?.removeEventListener('abort', abortHandler)
    }
  }
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

async function createAspectScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): Promise<SpatialScene> {
  const grid = buildAspectGrid()
  const terrain = await loadSpatialTerrain(viewer, signal)
  throwIfAborted(signal)

  let heights = grid.proceduralHeights
  let terrainHeightsApplied = false
  if (terrain.loaded) {
    try {
      const sampled = await Cesium.sampleTerrainMostDetailed(terrain.provider, grid.positions)
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
      console.error('坡向分析地形采样失败，已使用本地高程网格。', error)
    }
  }

  const cells: Array<{
    color: string
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
        color: style.color,
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
    : terrain.loaded
      ? '地形采样无有效高差，已使用本地山体高程'
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

export async function createSpatialScene(
  viewer: Cesium.Viewer,
  sceneId: SpatialSceneId,
  setStatus: StatusReporter,
  options: CreateSpatialSceneOptions = {},
): Promise<SpatialScene> {
  throwIfAborted(options.signal)
  setSceneDefaults(viewer)

  switch (sceneId) {
    case 'inundation-analysis-simple':
      return createInundationScene(viewer, setStatus, options.signal)
    case 'sunlight-analysis':
      return createSunlightScene(
        viewer,
        setStatus,
        options.sunlight ?? { date: '2020-10-20', startTime: '08:00', endTime: '18:00' },
      )
    case 'water-surface':
      return createWaterSurfaceScene(viewer, setStatus)
    case 'aspect-analysis':
      return createAspectScene(viewer, setStatus, options.signal)
  }
}
