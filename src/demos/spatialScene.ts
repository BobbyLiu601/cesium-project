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

const inundationPolygon = [
  [113.292, 23.146],
  [113.318, 23.132],
  [113.352, 23.144],
  [113.366, 23.172],
  [113.344, 23.192],
  [113.306, 23.184],
  [113.284, 23.166],
] as const

const waterPolygon = [
  [90, 29],
  [91, 29],
  [91, 30],
  [90, 30],
] as const

const aspectBuckets = [
  { key: 'north', label: '北', color: '#e45756', center: 0 },
  { key: 'northeast', label: '东北', color: '#f58518', center: 45 },
  { key: 'east', label: '东', color: '#eeca3b', center: 90 },
  { key: 'southeast', label: '东南', color: '#9fcb45', center: 135 },
  { key: 'south', label: '南', color: '#54a24b', center: 180 },
  { key: 'southwest', label: '西南', color: '#3f9f9f', center: 225 },
  { key: 'west', label: '西', color: '#4c78a8', center: 270 },
  { key: 'northwest', label: '西北', color: '#b07aa1', center: 315 },
] as const

export const aspectLegend = aspectBuckets.map(({ color, label }) => ({ color, label }))

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
  viewer.clock.shouldAnimate = false
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

function createInundationScene(viewer: Cesium.Viewer, setStatus: StatusReporter): SpatialScene {
  const positions = Cesium.Cartesian3.fromDegreesArray(
    inundationPolygon.flatMap(([longitude, latitude]) => [longitude, latitude]),
  )
  const startedAt = performance.now()
  let completed = false

  const waterEntity = viewer.entities.add({
    id: 'simple-inundation-water',
    name: '简易淹没水面',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(positions),
      height: 0,
      extrudedHeight: new Cesium.CallbackProperty(() => {
        const progress = clamp01((performance.now() - startedAt) / INUNDATION_DURATION_MS)
        return (
          INUNDATION_START_HEIGHT + (INUNDATION_TARGET_HEIGHT - INUNDATION_START_HEIGHT) * progress
        )
      }, false),
      material: new Cesium.ColorMaterialProperty(
        Cesium.Color.fromCssColorString('rgba(56, 160, 214, 0.46)'),
      ),
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('rgba(158, 220, 255, 0.9)'),
    },
  })

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.326, 23.162, 9_500),
    orientation: {
      heading: 0,
      pitch: (-42 * Math.PI) / 180,
      roll: 0,
    },
  })
  setStatus('淹没水面正从 1000 米自动上涨至 3600 米，达到目标高度后停止')

  const tick = () => {
    requestRender(viewer)
    if (!completed && performance.now() - startedAt >= INUNDATION_DURATION_MS) {
      completed = true
      setStatus('淹没水面已达到 3600 米目标高度，上涨动画已停止')
    }
  }
  viewer.scene.preUpdate.addEventListener(tick)

  return {
    actions: [],
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

  viewer.scene.globe.enableLighting = true
  for (let row = 0; row < 6; row += 1) {
    for (let column = 0; column < 6; column += 1) {
      const height = 42 + ((row * 7 + column * 11) % 9) * 16
      const longitude = center.longitude + (column - 2.5) * 0.0022
      const latitude = center.latitude + (row - 2.5) * 0.0022
      entities.push(
        viewer.entities.add({
          id: `sunlight-building-${row}-${column}`,
          name: '本地低多边形建筑',
          position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height / 2),
          box: {
            dimensions: new Cesium.Cartesian3(78, 78, height),
            material: Cesium.Color.fromCssColorString(row % 2 === 0 ? '#c8b89a' : '#9aa7b5'),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString('#243447'),
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

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.347, 23.177, 1_650),
    orientation: {
      heading: Cesium.Math.toRadians(28),
      pitch: Cesium.Math.toRadians(-38),
      roll: 0,
    },
  })

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
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createWaterSurfaceScene(viewer: Cesium.Viewer, setStatus: StatusReporter): SpatialScene {
  const positions = Cesium.Cartesian3.fromDegreesArray(
    waterPolygon.flatMap(([longitude, latitude]) => [longitude, latitude]),
  )
  const material = Cesium.Material.fromType('Water', {
    baseWaterColor: Cesium.Color.fromCssColorString('rgba(44, 122, 166, 0.86)'),
    blendColor: Cesium.Color.fromCssColorString('rgba(12, 57, 82, 0.9)'),
    frequency: 1_800,
    animationSpeed: 0.015,
    amplitude: 6,
  })
  const waterPrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: Cesium.PolygonGeometry.fromPositions({
        positions,
        vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
      }),
    }),
    appearance: new Cesium.MaterialAppearance({
      material,
      translucent: true,
      flat: true,
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

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(90.5, 29.5, 190_000),
    orientation: {
      heading: 0,
      pitch: (-58 * Math.PI) / 180,
      roll: 0,
    },
  })
  setStatus('已展示 90°–91°E、29°–30°N 的动态水域面，水面材质持续流动')

  return {
    actions: [],
    dispose() {
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

function classifyAspect(aspect: number) {
  const normalized = (aspect + 360) % 360
  return aspectBuckets.reduce((closest, bucket) => {
    const distance = Math.abs(((normalized - bucket.center + 540) % 360) - 180)
    const closestDistance = Math.abs(((normalized - closest.center + 540) % 360) - 180)
    return distance < closestDistance ? bucket : closest
  }, aspectBuckets[0])
}

function buildAspectGrid() {
  const longitudeStart = 113.69
  const latitudeStart = 23.585
  const longitudeStep = 0.0018
  const latitudeStep = 0.0014
  const longitudes: number[] = []
  const latitudes: number[] = []
  const positions: Cesium.Cartographic[] = []
  const proceduralHeights: number[][] = []

  for (let row = 0; row < ASPECT_GRID_SIZE; row += 1) {
    const latitude = latitudeStart + row * latitudeStep
    latitudes.push(latitude)
    const heightRow: number[] = []
    for (let column = 0; column < ASPECT_GRID_SIZE; column += 1) {
      if (row === 0) {
        longitudes.push(longitudeStart + column * longitudeStep)
      }
      const longitude = longitudeStart + column * longitudeStep
      positions.push(Cesium.Cartographic.fromDegrees(longitude, latitude))
      heightRow.push(
        160 +
          48 * Math.sin(column * 0.48) * Math.cos(row * 0.42) +
          22 * Math.sin((column + row) * 0.31),
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
      }
    } catch (error) {
      if (signal?.aborted) {
        throw createAbortError()
      }
      console.error('坡向分析地形采样失败，已使用本地高程网格。', error)
    }
  }

  const cells: Array<{
    longitude: number
    latitude: number
    bucket: (typeof aspectBuckets)[number]
  }> = []
  for (let row = 1; row < ASPECT_GRID_SIZE - 1; row += 1) {
    for (let column = 1; column < ASPECT_GRID_SIZE - 1; column += 1) {
      const dzdx = heights[row]![column + 1]! - heights[row]![column - 1]!
      const dzdy = heights[row + 1]![column]! - heights[row - 1]![column]!
      const aspect = (Cesium.Math.toDegrees(Math.atan2(-dzdx, dzdy)) + 360) % 360
      cells.push({
        longitude: grid.longitudes[column]!,
        latitude: grid.latitudes[row]!,
        bucket: classifyAspect(aspect),
      })
    }
  }

  const primitives: Cesium.Primitive[] = []
  const entities: Cesium.Entity[] = []
  const instancesByBucket = new Map<(typeof aspectBuckets)[number], Cesium.GeometryInstance[]>()

  for (const cell of cells) {
    const west = cell.longitude - grid.longitudeStep / 2
    const east = cell.longitude + grid.longitudeStep / 2
    const south = cell.latitude - grid.latitudeStep / 2
    const north = cell.latitude + grid.latitudeStep / 2
    const geometry = Cesium.PolygonGeometry.fromPositions({
      positions: Cesium.Cartesian3.fromDegreesArray([
        west,
        south,
        east,
        south,
        east,
        north,
        west,
        north,
      ]),
    })
    const instance = new Cesium.GeometryInstance({
      geometry,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString(cell.bucket.color),
        ),
      },
    })
    const bucketInstances = instancesByBucket.get(cell.bucket) ?? []
    bucketInstances.push(instance)
    instancesByBucket.set(cell.bucket, bucketInstances)
  }

  for (const instances of instancesByBucket.values()) {
    const primitive = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PerInstanceColorAppearance({
        translucent: false,
        flat: true,
      }),
      asynchronous: false,
    })
    viewer.scene.primitives.add(primitive)
    primitives.push(primitive)
  }

  for (const bucket of aspectBuckets) {
    const sample = cells.find((cell) => cell.bucket === bucket)
    if (!sample) {
      continue
    }
    const radians = (bucket.center * Math.PI) / 180
    const arrowLength = 0.0024
    const arrowPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
      sample.longitude,
      sample.latitude,
      220,
      sample.longitude + Math.sin(radians) * arrowLength,
      sample.latitude + Math.cos(radians) * arrowLength,
      220,
    ])
    entities.push(
      viewer.entities.add({
        id: `aspect-arrow-${bucket.key}`,
        name: `${bucket.label}向坡向箭头`,
        polyline: {
          positions: arrowPositions,
          width: 4,
          material: new Cesium.ColorMaterialProperty(Cesium.Color.fromCssColorString(bucket.color)),
        },
      }),
    )
  }

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.716, 23.605, 8_200),
    orientation: {
      heading: Cesium.Math.toRadians(12),
      pitch: Cesium.Math.toRadians(-46),
      roll: 0,
    },
  })
  setStatus(
    terrain.loaded
      ? `已加载地形并采样 ${ASPECT_GRID_SIZE} × ${ASPECT_GRID_SIZE} 网格，按八向坡向着色并叠加方向箭头`
      : '地形加载失败，已回退椭球地形；坡向着色和方向箭头仍可查看',
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
      return createInundationScene(viewer, setStatus)
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
