import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  isosurfaceGrid,
  overlayPolygonA,
  overlayPolygonB,
  thiessenSamplePoints,
} from '@/data/gisClient'
import { createVisualizationScene } from '@/demos/visualizationScene'
import { resetCesiumMock, Viewer } from './mocks/cesium'

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
})
