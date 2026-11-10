import type { Viewer } from 'cesium'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createVectorScene } from '../demos/vectorScene'
import type { VectorSceneId } from '../data/layers'
import {
  billboardCollectionInstances,
  GeometryInstance,
  dataSourceInstances,
  EllipsoidTerrainProvider,
  entityCollectionInstances,
  polylineDashMaterialInstances,
  PolylineColorAppearance,
  primitiveInstances,
  resetCesiumMock,
  screenSpaceEventHandlerInstances,
  ScreenSpaceEventType,
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
      expect(viewer.camera.viewBoundingSphere).toHaveBeenCalledTimes(sceneId === 'geojson' ? 0 : 1)
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
    expect(entityCollectionInstances[0]?.values).toHaveLength(3)

    await scene.actions[0]?.run()
    expect(entityCollectionInstances[0]?.values).toHaveLength(4)

    const originalFirstId = entityCollectionInstances[0]?.values[0]?.id
    await scene.actions.find((action) => action.id === 'promote-first')?.run()
    expect(entityCollectionInstances[0]?.values[3]?.id).toBe(originalFirstId)

    await scene.actions.find((action) => action.id === 'query-first')?.run()
    expect(entityCollectionInstances[0]?.getById).toHaveBeenCalledWith('collection-entity-1')

    await scene.actions[1]?.run()
    expect(entityCollectionInstances[0]?.values).toHaveLength(3)
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
    const linePrimitive = primitiveInstances.find(
      (primitive) => primitive.options.appearance instanceof PolylineColorAppearance,
    )
    const lineGeometry = linePrimitive?.options.geometryInstances as GeometryInstance | undefined
    expect(lineGeometry).toBeInstanceOf(GeometryInstance)
    expect(lineGeometry?.options.attributes).toEqual({
      color: expect.objectContaining({ color: expect.anything() }),
    })
    scene.dispose()
    expect(screenSpaceEventHandlerInstances[0]?.destroy).toHaveBeenCalledOnce()
  })

  it('keeps the HTML overlay visible after camera framing', async () => {
    const viewer = createViewer()
    const host = document.createElement('div')

    await createVectorScene(viewer, host, 'html-overlay', () => {})

    const overlay = host.querySelector<HTMLElement>('[data-demo-overlay]')
    expect(overlay).not.toBeNull()
    expect(overlay?.style.display).toBe('block')
    expect(overlay?.textContent).toContain('气泡窗口')
  })

  it('keeps the click popup hidden until an icon is selected', async () => {
    const viewer = createViewer()
    const host = document.createElement('div')
    const scene = await createVectorScene(viewer, host, 'click-popup', () => {})
    const overlay = host.querySelector<HTMLElement>('[data-demo-overlay]')

    expect(overlay?.style.display).toBe('none')

    await scene.actions.find((action) => action.id === 'show-first-popup')?.run()

    expect(overlay?.style.display).toBe('block')
    expect(overlay?.textContent).toContain('设备 A')
  })

  it('opens and closes the popup through the canvas click handler', async () => {
    const viewer = createViewer()
    const host = document.createElement('div')
    const scene = await createVectorScene(viewer, host, 'click-popup', () => {})
    const overlay = host.querySelector<HTMLElement>('[data-demo-overlay]')
    const mockViewer = viewerInstances[0]!
    const entity = mockViewer.entities.values[0]

    mockViewer.scene.pick.mockReturnValue({ id: entity })
    screenSpaceEventHandlerInstances[0]?.actions.get(ScreenSpaceEventType.LEFT_CLICK)?.({
      position: { x: 120, y: 240 },
    })

    expect(overlay?.style.display).toBe('block')
    expect(overlay?.textContent).toContain('设备 A')

    overlay
      ?.querySelector('[data-popup-close]')
      ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(overlay?.style.display).toBe('none')
    scene.dispose()
  })

  it('uses a native animated GIF overlay when ImageDecoder is unavailable', async () => {
    const statuses: string[] = []
    const viewer = createViewer()
    const host = document.createElement('div')
    const scene = await createVectorScene(viewer, host, 'gif', (message) => statuses.push(message))

    expect(statuses[statuses.length - 1]).toContain('原生 GIF 动画')
    expect(viewerInstances[0]?.entities.values).toHaveLength(1)
    expect(viewerInstances[0]?.entities.values[0]?.billboard?.scale).toBe(0.55)
    expect(viewerInstances[0]?.entities.values[0]?.show).toBe(false)
    const fallbackImage = host.querySelector<HTMLImageElement>('img[data-demo-gif]')
    expect(fallbackImage?.src).toContain('vector-demo-hurricane.gif')
    expect(fallbackImage?.style.filter).toBe('none')
    expect(scene.actions[0]?.id).toBe('replay-gif')

    scene.dispose()
    expect(host.querySelector('img[data-demo-gif]')).toBeNull()
  })
})
