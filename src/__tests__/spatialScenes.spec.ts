import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  Cesium3DTileset,
  cesiumMockState,
  cesium3DTilesetInstances,
  cesium3DTilesetRequests,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  materialInstances,
  primitiveInstances,
  resetCesiumMock,
  sampleTerrainMostDetailed,
  scenePrimitiveAdds,
  scenePrimitiveRemoves,
  ShadowMode,
  Viewer,
} from './mocks/cesium'
import { createSpatialScene } from '../demos/spatialScene'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createSpatialScene>[0]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    statuses,
    setStatus: (message: string) => statuses.push(message),
  }
}

function getRenderedHeights() {
  return primitiveInstances.flatMap((primitive) => {
    const geometryInstances = primitive.options.geometryInstances
    if (!Array.isArray(geometryInstances)) {
      return []
    }

    return geometryInstances.flatMap((geometryInstance) => {
      const positions = (
        geometryInstance as {
          options?: {
            geometry?: {
              options?: {
                positions?: Array<{ height?: number }>
              }
            }
          }
        }
      ).options?.geometry?.options?.positions

      return Array.isArray(positions)
        ? positions
            .map((position) => position.height)
            .filter((height): height is number => typeof height === 'number')
        : []
    })
  })
}

function captureRejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the scene creation to reject')
    },
    (error: unknown) => error,
  )
}

describe('spatial scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('raises the simple inundation volume from 1000m to 3600m and stops', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'inundation-analysis-simple', setStatus)
    const entity = (viewer as unknown as Viewer).entities.values[0]!
    const waterHeight = entity.polygon?.extrudedHeight as { getValue: () => number }

    expect(entity.polygon?.height).toBeUndefined()
    expect(entity.polygon?.perPositionHeight).toBe(true)
    expect(waterHeight.getValue()).toBe(1_000)
    now.mockReturnValue(2_250)
    expect(waterHeight.getValue()).toBeCloseTo(2_300)
    now.mockReturnValue(4_500)
    expect(waterHeight.getValue()).toBe(3_600)
    ;(viewer as unknown as Viewer).scene.preUpdate.raiseEvent()
    expect(statuses[statuses.length - 1]).toContain('目标高度')
    expect((viewer as unknown as Viewer).camera.viewBoundingSphere).toHaveBeenCalled()

    scene.dispose()
    expect((viewer as unknown as Viewer).entities.values).toHaveLength(0)
  })

  it('loads the reference city tileset and controls the sunlight clock', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'sunlight-analysis', setStatus)

    expect(cesium3DTilesetRequests).toHaveLength(1)
    expect(cesium3DTilesetRequests[0]?.url).toContain(
      'spatial-analysis/sunlight-model/tileset.json',
    )
    expect(cesium3DTilesetInstances).toHaveLength(1)
    const tileset = cesium3DTilesetInstances[0] as Cesium3DTileset
    expect(tileset).toBeInstanceOf(Cesium3DTileset)
    expect(tileset.shadows).toBe(ShadowMode.ENABLED)
    expect(scenePrimitiveAdds).toContain(tileset)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(mockViewer.scene.globe.enableLighting).toBe(false)
    expect(mockViewer.shadows).toBe(false)
    expect(scene.actions.map((action) => action.label)).toEqual(['播放日照', '暂停日照'])
    expect(mockViewer.clock.startTime).not.toBe(mockViewer.clock.stopTime)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalled()

    await scene.actions[0]?.run()
    expect(mockViewer.scene.globe.enableLighting).toBe(true)
    expect(mockViewer.shadows).toBe(true)
    expect(mockViewer.clock.shouldAnimate).toBe(true)
    await scene.actions[1]?.run()
    expect(mockViewer.clock.shouldAnimate).toBe(false)

    scene.applySunlightRange?.({
      date: '2021-06-21',
      startTime: '09:30',
      endTime: '16:30',
    })
    expect(statuses[statuses.length - 1]).toContain('日照区间已更新')

    scene.applySunlightRange?.({
      date: '2021-06-21',
      startTime: '17:00',
      endTime: '08:00',
    })
    expect(statuses[statuses.length - 1]).toContain('请选择有效的日期和起止时间')

    scene.dispose()
    expect(scenePrimitiveRemoves).toContain(tileset)
    expect(tileset.destroyed).toBe(true)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(mockViewer.shadows).toBe(false)
  })

  it('destroys a sunlight tileset that resolves after the load timeout', async () => {
    vi.useFakeTimers()
    let resolveTileset!: (tileset: Cesium3DTileset) => void
    cesiumMockState.cesium3DTilesetPromise = new Promise((resolve) => {
      resolveTileset = resolve
    })

    const viewer = createViewer()
    const { setStatus } = collectStatus()
    const pending = createSpatialScene(viewer, 'sunlight-analysis', setStatus)
    const rejection = captureRejection(pending)

    await vi.advanceTimersByTimeAsync(20_000)
    await expect(rejection).resolves.toMatchObject({
      message: '日照分析 3D Tiles 模型加载超时',
    })
    expect(scenePrimitiveAdds).toHaveLength(0)

    const lateTileset = new Cesium3DTileset('late-tileset', {})
    resolveTileset(lateTileset)
    await Promise.resolve()

    expect(lateTileset.destroyed).toBe(true)
  })

  it('renders the animated water surface as a water-material primitive', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus } = collectStatus()
    const scene = await createSpatialScene(viewer, 'water-surface', setStatus)

    expect(primitiveInstances).toHaveLength(1)
    expect(materialInstances.map((material) => material.options.fabric.type)).toContain('Water')
    expect(materialInstances[0]?.options.fabric.uniforms.normalMap).toContain('waterNormals.jpg')
    expect(mockViewer.entities.values).toHaveLength(1)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalled()
    expect(mockViewer.scene.preUpdate.listeners.size).toBe(1)

    scene.dispose()
    expect(scenePrimitiveRemoves).toHaveLength(1)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(mockViewer.scene.preUpdate.listeners.size).toBe(0)
  })

  it('samples a 30x30 terrain grid and renders aspect cells plus direction arrows', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'aspect-analysis', setStatus)

    expect(sampleTerrainMostDetailed).toHaveBeenCalledOnce()
    expect(sampleTerrainMostDetailed.mock.calls[0]?.[1]).toHaveLength(30 * 30)
    expect(primitiveInstances.length).toBeGreaterThan(0)
    expect(mockViewer.entities.values.length).toBeGreaterThan(0)
    expect(statuses[statuses.length - 1]).toContain('30 × 30')
    expect(statuses[statuses.length - 1]).toContain('红色坡度坡面')
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalled()

    scene.dispose()
    expect(scenePrimitiveRemoves).toHaveLength(primitiveInstances.length)
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('renders the aspect surface from varied detailed terrain heights', async () => {
    sampleTerrainMostDetailed.mockImplementationOnce((_provider, positions) =>
      Promise.resolve(
        positions.map((_position, index) => ({
          height: 1_000 + Math.floor(index / 30) * 5 + (index % 30),
        })),
      ),
    )
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'aspect-analysis', setStatus)
    const renderedHeights = getRenderedHeights()

    expect(statuses[statuses.length - 1]).toContain('已加载参考区域地形')
    expect(statuses[statuses.length - 1]).not.toContain('本地山体高程')
    expect(renderedHeights.length).toBeGreaterThan(0)
    expect(Math.max(...renderedHeights)).toBeGreaterThan(1_000)
    expect(primitiveInstances.length).toBeGreaterThanOrEqual(1)

    scene.dispose()
  })

  it('falls back when detailed terrain sampling times out and ignores the late result', async () => {
    vi.useFakeTimers()
    let resolveSamples!: (samples: Array<{ height: number }>) => void
    sampleTerrainMostDetailed.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSamples = resolve
        }),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const pending = createSpatialScene(viewer, 'aspect-analysis', setStatus)

    await vi.advanceTimersByTimeAsync(0)
    expect(sampleTerrainMostDetailed).toHaveBeenCalledOnce()
    const primitiveCountBeforeSampling = primitiveInstances.length

    await vi.advanceTimersByTimeAsync(15_000)
    const scene = await pending

    expect(primitiveInstances.length).toBeGreaterThan(primitiveCountBeforeSampling)
    expect(statuses[statuses.length - 1]).toContain('地形采样失败')
    expect(consoleError).toHaveBeenCalled()

    const primitiveCountAfterFallback = primitiveInstances.length
    resolveSamples(Array.from({ length: 30 * 30 }, () => ({ height: 500 })))
    await Promise.resolve()
    expect(primitiveInstances).toHaveLength(primitiveCountAfterFallback)

    scene.dispose()
  })

  it('falls back to ellipsoid terrain and keeps aspect cells when terrain fails', async () => {
    cesiumMockState.cesiumTerrainProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'aspect-analysis', setStatus)

    expect(mockViewer.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(primitiveInstances.length).toBeGreaterThan(0)
    expect(statuses[statuses.length - 1]).toContain('已回退椭球地形')
    expect(consoleError).toHaveBeenCalled()
    expect(sampleTerrainMostDetailed).not.toHaveBeenCalled()

    scene.dispose()
  })

  it('aborts a pending aspect scene when its signal is cancelled', async () => {
    let resolveTerrain!: (provider: CesiumTerrainProvider) => void
    cesiumMockState.cesiumTerrainProviderPromise = new Promise((resolve) => {
      resolveTerrain = resolve
    })
    const viewer = createViewer()
    const controller = new AbortController()
    const { setStatus } = collectStatus()
    const pending = createSpatialScene(viewer, 'aspect-analysis', setStatus, {
      signal: controller.signal,
    })

    controller.abort()
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' })
    resolveTerrain(new CesiumTerrainProvider('https://data.mars3d.cn/terrain'))
  })

  it('aborts while detailed terrain sampling is still pending', async () => {
    let resolveSamples!: (samples: Array<{ height: number }>) => void
    sampleTerrainMostDetailed.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSamples = resolve
        }),
    )
    const viewer = createViewer()
    const controller = new AbortController()
    const { setStatus } = collectStatus()
    const pending = createSpatialScene(viewer, 'aspect-analysis', setStatus, {
      signal: controller.signal,
    })
    const rejection = captureRejection(pending)

    await vi.waitFor(() => {
      expect(sampleTerrainMostDetailed).toHaveBeenCalledOnce()
    })
    controller.abort()
    await expect(rejection).resolves.toMatchObject({ name: 'AbortError' })

    resolveSamples(Array.from({ length: 30 * 30 }, () => ({ height: 500 })))
    await Promise.resolve()
    expect(scenePrimitiveAdds).toHaveLength(0)
  })
})
