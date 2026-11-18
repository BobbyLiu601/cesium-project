import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HEATMAP_3D_GRID_SIZE,
  HONEYCOMB_COLUMNS,
  HONEYCOMB_ROWS,
  heatmap3dSamples,
  heatmap3dColors,
  honeycombCells,
  honeycombColors,
  sampleHeatmap3dField,
  WIND_FLOW_TRAIL_LENGTH,
  WIND_PARTICLE_COUNT,
  windFieldColors,
} from '@/data/dataVisualization'
import {
  isosurfaceGrid,
  overlayPolygonA,
  overlayPolygonB,
  thiessenSamplePoints,
} from '@/data/gisClient'
import { createVisualizationScene } from '@/demos/visualizationScene'
import {
  materialInstances,
  MaterialAppearance,
  PolylineCollection,
  primitiveInstances,
  resetCesiumMock,
  scenePrimitiveRemoves,
  scenePrimitiveAdds,
  Viewer,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createVisualizationScene>[0]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    setStatus: (message: string) => statuses.push(message),
    statuses,
  }
}

function getPolylinePositions(entity: Viewer['entities']['values'][number]) {
  const positions = entity.polyline?.positions as
    Array<Record<string, number>> | { getValue: () => Array<Record<string, number>> } | undefined

  return positions && 'getValue' in positions ? positions.getValue() : positions
}

function getPreUpdateListenerCount(viewer: Viewer) {
  return (
    viewer.scene.preUpdate as unknown as {
      listeners: Set<() => void>
    }
  ).listeners.size
}

describe('GIS client visualization scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it('renders both source polygons, their intersection, and the measured area', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'overlay-analysis', setStatus)

    expect(mockViewer.entities.values).toHaveLength(4)
    expect(mockViewer.entities.values.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        'overlay-source-a-0',
        'overlay-source-b-0',
        'overlay-intersection-0',
        'overlay-area-label',
      ]),
    )
    expect(statuses[statuses.length - 1]).toMatch(/面积 [\d,]+ 平方米/)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()
    expect(scene.actions).toEqual([])

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('builds a deterministic TIN with fixed sample markers', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'thiessen-polygon', setStatus)

    expect(thiessenSamplePoints).toHaveLength(54)
    expect(mockViewer.entities.values.length).toBeGreaterThan(thiessenSamplePoints.length)
    expect(statuses[statuses.length - 1]).toContain('54 个固定采样点')
    expect(statuses[statuses.length - 1]).toMatch(/TIN 三角面/)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('renders fixed-grid isobands and isolines with a complete legend range', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'isosurface', setStatus)

    expect(isosurfaceGrid).toHaveLength(300)
    expect(mockViewer.entities.values.length).toBeGreaterThan(10)
    expect(statuses[statuses.length - 1]).toContain('10 级固定风场等值面')
    expect(statuses[statuses.length - 1]).toContain('300 个采样点')
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('cancels before adding geometry when the scene request is aborted', async () => {
    const viewer = createViewer()
    const controller = new AbortController()
    const { setStatus } = collectStatus()
    controller.abort()

    await expect(
      createVisualizationScene(viewer, 'overlay-analysis', setStatus, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect((viewer as unknown as Viewer).entities.values).toHaveLength(0)
  })

  it('keeps the reference overlay coordinates fixed after the intersection calculation', async () => {
    const polygonASnapshot = overlayPolygonA.map((coordinate) => [...coordinate])
    const polygonBSnapshot = overlayPolygonB.map((coordinate) => [...coordinate])
    const viewer = createViewer()
    const { setStatus } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'overlay-analysis', setStatus)

    expect(overlayPolygonA).toHaveLength(6)
    expect(overlayPolygonB).toHaveLength(5)
    expect(overlayPolygonA[0]).toEqual([117.182288, 31.854164])
    expect(overlayPolygonB[0]).toEqual([117.267046, 31.842971])
    expect(overlayPolygonA).toEqual(polygonASnapshot)
    expect(overlayPolygonB).toEqual(polygonBSnapshot)

    scene.dispose()
  })

  it('renders a dense continuous 3D heatmap surface with shaded texture and a skirt', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, '3d-heatmap', setStatus)

    expect(heatmap3dSamples).toHaveLength(50)
    expect(sampleHeatmap3dField(116.46, 39.92)).toBe(sampleHeatmap3dField(116.46, 39.92))
    expect(HEATMAP_3D_GRID_SIZE).toBeGreaterThanOrEqual(128)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(2)
    const surface = primitiveInstances[0]
    const skirt = primitiveInstances[1]
    const surfaceInstance = surface?.options.geometryInstances as {
      options?: { geometry?: { options?: { attributes?: Record<string, unknown> } } }
    }
    const positions = (
      surfaceInstance.options?.geometry?.options?.attributes?.position as {
        options?: { values?: Float64Array }
      }
    )?.options?.values

    expect(positions?.length).toBe(HEATMAP_3D_GRID_SIZE ** 2 * 3)
    expect(skirt?.options.appearance).toBeInstanceOf(MaterialAppearance)
    expect(materialInstances[0]?.options.fabric.uniforms.image).toMatch(/^data:image\/png;base64,/)
    expect(statuses[statuses.length - 1]).toContain(
      `${HEATMAP_3D_GRID_SIZE} × ${HEATMAP_3D_GRID_SIZE} 网格的三维热力地形`,
    )
    expect(scene.animationState).toBeUndefined()
    expect(scene.toggleAnimation).toBeUndefined()
    expect(scene.legend).toEqual({
      colors: heatmap3dColors,
      maximumLabel: '1',
      minimumLabel: '0',
      title: '三维热力强度',
    })

    scene.dispose()
    expect(scenePrimitiveRemoves).toContain(surface)
    expect(scenePrimitiveRemoves).toContain(skirt)
  })

  it('renders a deterministic fine-grained honeycomb surface in one batched primitive', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'honeycomb-heatmap', setStatus)

    expect(HONEYCOMB_COLUMNS).toBeGreaterThanOrEqual(40)
    expect(HONEYCOMB_ROWS).toBeGreaterThanOrEqual(40)
    expect(honeycombCells).toHaveLength(HONEYCOMB_COLUMNS * HONEYCOMB_ROWS)
    expect(new Set(honeycombCells.map((cell) => cell.height.toFixed(3))).size).toBeGreaterThan(1200)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(1)
    expect(primitiveInstances[0]?.options.geometryInstances).toHaveLength(honeycombCells.length)
    const firstHoneycombInstance = (
      primitiveInstances[0]!.options.geometryInstances as Array<{
        options: { geometry: { options: { extrudedHeight: number } } }
      }>
    )[0]!
    expect(firstHoneycombInstance.options.geometry.options.extrudedHeight).toEqual(
      expect.any(Number),
    )
    expect(statuses[statuses.length - 1]).toContain(
      `${HONEYCOMB_COLUMNS} × ${HONEYCOMB_ROWS} 个固定网格热力单元`,
    )
    expect(scene.animationState).toBeUndefined()
    expect(scene.legend).toEqual({
      colors: honeycombColors,
      maximumLabel: '800 m',
      minimumLabel: '0',
      title: '蜂窝热力强度',
    })

    scene.dispose()
    expect(scenePrimitiveRemoves).toContain(primitiveInstances[0])
  })

  it('lays an ocean speed heat layer under animated current vectors and exposes its legend', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'ocean-current', setStatus)
    const heatLayer = mockViewer.entities.values.find((entity) => entity.rectangle)
    const flowEntities = mockViewer.entities.values.filter((entity) => entity.polyline)

    expect(heatLayer).toBeDefined()
    expect(
      (heatLayer?.rectangle?.material as { options?: { image?: string } })?.options?.image,
    ).toMatch(/^data:image\/png;base64,/)
    expect(flowEntities.length).toBeGreaterThan(200)
    expect(scene.legend?.title).toBe('海流速度')
    expect(scene.legend?.colors.length).toBeGreaterThanOrEqual(5)
    expect(scene.animationState?.value).toBe('playing')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(1)

    mockViewer.scene.preUpdate.raiseEvent()
    const firstFrame = getPolylinePositions(flowEntities[0]!)
    mockViewer.scene.preUpdate.raiseEvent()
    expect(getPolylinePositions(flowEntities[0]!)).not.toEqual(firstFrame)

    scene.toggleAnimation?.()
    expect(scene.animationState?.value).toBe('paused')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(statuses[statuses.length - 1]).toMatch(/海流.*已暂停/)
    const pausedFrame = getPolylinePositions(flowEntities[0]!)
    mockViewer.scene.preUpdate.raiseEvent()
    expect(getPolylinePositions(flowEntities[0]!)).toEqual(pausedFrame)

    scene.toggleAnimation?.()
    expect(scene.animationState?.value).toBe('playing')
    expect(statuses[statuses.length - 1]).toMatch(/海流.*继续/)

    scene.dispose()
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('renders a dense fading wind-particle layer in one polyline collection', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'wind-field', setStatus)
    const collection = scenePrimitiveAdds.find(
      (primitive): primitive is PolylineCollection => primitive instanceof PolylineCollection,
    )

    expect(collection).toBeDefined()
    expect(collection?.length).toBe(WIND_PARTICLE_COUNT)
    expect(WIND_PARTICLE_COUNT).toBeGreaterThanOrEqual(2000)
    expect(windFieldColors).toHaveLength(15)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect((collection!.get(0)!.positions as unknown[]).length).toBe(WIND_FLOW_TRAIL_LENGTH)
    expect(scene.legend).toEqual({
      colors: windFieldColors,
      maximumLabel: '高风速',
      minimumLabel: '低风速',
      title: '风速',
    })
    expect(scene.animationState?.value).toBe('playing')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(1)

    const firstFrame = collection!.get(0)!.positions
    mockViewer.scene.preUpdate.raiseEvent()
    expect(collection!.get(0)!.positions).not.toEqual(firstFrame)

    scene.toggleAnimation?.()
    expect(scene.animationState?.value).toBe('paused')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(statuses[statuses.length - 1]).toMatch(/风粒子.*已暂停/)
    const pausedFrame = collection!.get(0)!.positions
    mockViewer.scene.preUpdate.raiseEvent()
    expect(collection!.get(0)!.positions).toEqual(pausedFrame)

    scene.toggleAnimation?.()
    expect(statuses[statuses.length - 1]).toMatch(/风粒子.*继续/)

    scene.dispose()
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(scenePrimitiveRemoves).toContain(collection)
  })
})
