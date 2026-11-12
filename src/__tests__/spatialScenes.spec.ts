import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cesiumMockState,
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  materialInstances,
  primitiveInstances,
  resetCesiumMock,
  sampleTerrainMostDetailed,
  scenePrimitiveRemoves,
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

describe('spatial scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it('raises the simple inundation surface from 1000m to 3600m and stops', async () => {
    const now = vi.spyOn(performance, 'now').mockReturnValue(0)
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'inundation-analysis-simple', setStatus)
    const entity = (viewer as unknown as Viewer).entities.values[0]!
    const extrudedHeight = entity.polygon?.extrudedHeight as { getValue: () => number }

    expect(extrudedHeight.getValue()).toBe(1_000)
    now.mockReturnValue(2_250)
    expect(extrudedHeight.getValue()).toBeCloseTo(2_300)
    now.mockReturnValue(4_500)
    expect(extrudedHeight.getValue()).toBe(3_600)
    ;(viewer as unknown as Viewer).scene.preUpdate.raiseEvent()
    expect(statuses[statuses.length - 1]).toContain('目标高度')

    scene.dispose()
    expect((viewer as unknown as Viewer).entities.values).toHaveLength(0)
  })

  it('creates local buildings and controls the sunlight clock', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createSpatialScene(viewer, 'sunlight-analysis', setStatus)

    expect(mockViewer.entities.values).toHaveLength(36)
    expect(mockViewer.scene.globe.enableLighting).toBe(true)
    expect(scene.actions.map((action) => action.label)).toEqual(['播放日照', '暂停日照'])
    expect(mockViewer.clock.startTime).not.toBe(mockViewer.clock.stopTime)

    await scene.actions[0]?.run()
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
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('renders the animated water surface as a water-material primitive', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus } = collectStatus()
    const scene = await createSpatialScene(viewer, 'water-surface', setStatus)

    expect(primitiveInstances).toHaveLength(1)
    expect(materialInstances.map((material) => material.options.fabric.type)).toContain('Water')
    expect(mockViewer.entities.values).toHaveLength(1)

    scene.dispose()
    expect(scenePrimitiveRemoves).toHaveLength(1)
    expect(mockViewer.entities.values).toHaveLength(0)
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

    scene.dispose()
    expect(scenePrimitiveRemoves).toHaveLength(primitiveInstances.length)
    expect(mockViewer.entities.values).toHaveLength(0)
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
})
