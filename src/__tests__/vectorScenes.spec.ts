import type { Viewer } from 'cesium'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createVectorScene } from '../demos/vectorScene'
import type { VectorSceneId } from '../data/layers'
import {
  billboardCollectionInstances,
  dataSourceInstances,
  EllipsoidTerrainProvider,
  entityCollectionInstances,
  polylineDashMaterialInstances,
  resetCesiumMock,
  screenSpaceEventHandlerInstances,
  terrainSampleRequests,
  Viewer as ViewerMock,
  viewerInstances,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

const sceneIds: VectorSceneId[] = [
  'entity-point',
  'entity-line',
  'entity-polygon',
  'billboard',
  'billboard-collection',
  'popup',
  'geojson',
  'primitive',
  'all-primitive',
  'entity-collection',
  'entity-operation',
  'html-overlay',
  'click-popup',
  'road',
  'svg',
  'gif',
]

function createViewer() {
  const viewer = new ViewerMock(document.createElement('div'), {
    terrainProvider: new EllipsoidTerrainProvider(),
  })
  return viewer as unknown as Viewer
}

describe('vector scene builders', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it.each(sceneIds)(
    'creates and disposes the %s scene through the Cesium seam',
    async (sceneId) => {
      const viewer = createViewer()
      const host = document.createElement('div')
      const statuses: string[] = []
      const scene = await createVectorScene(viewer, host, sceneId, (message) => {
        statuses.push(message)
      })

      expect(scene.actions.length).toBeGreaterThan(0)
      expect(statuses[statuses.length - 1]).toBeTruthy()
      expect(() => scene.dispose()).not.toThrow()
    },
  )

  it('adds an auto-height entity point after sampling terrain', async () => {
    const viewer = createViewer()
    const scene = await createVectorScene(
      viewer,
      document.createElement('div'),
      'entity-point',
      () => {},
    )

    await scene.actions[0]?.run()

    expect(terrainSampleRequests).toHaveLength(1)
    expect(viewerInstances[0]?.entities.values).toHaveLength(4)
  })

  it('creates the four entity polygon height variants', async () => {
    const viewer = createViewer()

    await createVectorScene(viewer, document.createElement('div'), 'entity-polygon', () => {})

    const polygons = viewerInstances[0]?.entities.values.filter((entity) => entity.polygon)
    expect(polygons).toHaveLength(4)
    expect(
      viewerInstances[0]?.entities.values.find((entity) => entity.id === 'slanted-polygon')?.polygon
        ?.perPositionHeight,
    ).toBe(true)
  })

  it('uses BillboardCollection for the 50,000 icon scene', async () => {
    createViewer()

    await createVectorScene(
      createViewer(),
      document.createElement('div'),
      'billboard-collection',
      () => {},
    )

    expect(billboardCollectionInstances).toHaveLength(1)
    expect(billboardCollectionInstances[0]?.items).toHaveLength(50_000)
  })

  it('loads local GeoJSON through GeoJsonDataSource and flies to the data', async () => {
    const viewer = createViewer()

    await createVectorScene(viewer, document.createElement('div'), 'geojson', () => {})

    expect(dataSourceInstances).toHaveLength(1)
    expect(dataSourceInstances[0]?.entities.values).toHaveLength(2)
    expect(viewerInstances[0]?.flyTo).toHaveBeenCalledOnce()
  })

  it('mutates CustomDataSource entities through collection actions', async () => {
    const viewer = createViewer()
    const scene = await createVectorScene(
      viewer,
      document.createElement('div'),
      'entity-collection',
      () => {},
    )

    expect(entityCollectionInstances).toHaveLength(1)
    expect(entityCollectionInstances[0]?.values).toHaveLength(1)

    await scene.actions[0]?.run()
    expect(entityCollectionInstances[0]?.values).toHaveLength(2)

    const originalFirstId = entityCollectionInstances[0]?.values[0]?.id
    await scene.actions.find((action) => action.id === 'promote-first')?.run()
    expect(entityCollectionInstances[0]?.values[1]?.id).toBe(originalFirstId)

    await scene.actions.find((action) => action.id === 'query-first')?.run()
    expect(entityCollectionInstances[0]?.getById).toHaveBeenCalledWith('collection-entity-1')

    await scene.actions[1]?.run()
    expect(entityCollectionInstances[0]?.values).toHaveLength(1)
  })

  it('removes viewer entities by object and id', async () => {
    const viewer = createViewer()
    const scene = await createVectorScene(
      viewer,
      document.createElement('div'),
      'entity-operation',
      () => {},
    )

    expect(viewerInstances[0]?.entities.values).toHaveLength(2)

    await scene.actions.find((action) => action.id === 'add')?.run()
    expect(viewerInstances[0]?.entities.values).toHaveLength(3)

    await scene.actions.find((action) => action.id === 'remove-object')?.run()
    expect(viewerInstances[0]?.entities.values).toHaveLength(2)

    await scene.actions.find((action) => action.id === 'remove-id')?.run()
    expect(viewerInstances[0]?.entities.values).toHaveLength(1)
  })

  it('renders local road data as layered road materials', async () => {
    const viewer = createViewer()

    await createVectorScene(viewer, document.createElement('div'), 'road', () => {})

    expect(viewerInstances[0]?.entities.values).toHaveLength(8)
    expect(polylineDashMaterialInstances).toHaveLength(2)
  })

  it('registers and destroys a click handler for interactive primitives', async () => {
    const viewer = createViewer()
    const scene = await createVectorScene(
      viewer,
      document.createElement('div'),
      'primitive',
      () => {},
    )

    expect(screenSpaceEventHandlerInstances).toHaveLength(1)
    scene.dispose()
    expect(screenSpaceEventHandlerInstances[0]?.destroy).toHaveBeenCalledOnce()
  })

  it('falls back to a static GIF frame when ImageDecoder is unavailable', async () => {
    const statuses: string[] = []
    const viewer = createViewer()
    const scene = await createVectorScene(viewer, document.createElement('div'), 'gif', (message) =>
      statuses.push(message),
    )

    expect(statuses[statuses.length - 1]).toContain('静态帧')
    expect(viewerInstances[0]?.entities.values).toHaveLength(1)
    expect(viewerInstances[0]?.entities.values[0]?.billboard?.scale).toBe(1.5)
    scene.dispose()
  })
})
