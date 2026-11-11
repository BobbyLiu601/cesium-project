import type { Viewer } from 'cesium'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createModelScene } from '../demos/modelScene'
import type { ModelSceneId } from '../data/layers'
import {
  EllipsoidTerrainProvider,
  resetCesiumMock,
  Viewer as ViewerMock,
  viewerInstances,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

const sceneIds: ModelSceneId[] = ['model-interpolation', 'wind-turbine']
const referenceElevations = [
  1815, 1827, 1849, 1866, 1866, 1899, 1880, 1926, 1948, 1910, 1983, 2036, 2036, 2038, 2071, 2063,
  2026, 2048, 2056, 2075, 2015, 2022, 2021, 1965,
]

function createViewer() {
  return new ViewerMock(document.createElement('div'), {
    terrainProvider: new EllipsoidTerrainProvider(),
  }) as unknown as Viewer
}

describe('model scene builders', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it.each(sceneIds)(
    'creates and disposes the %s scene through the Cesium seam',
    async (sceneId) => {
      const viewer = createViewer()
      const statuses: string[] = []
      const scene = await createModelScene(
        viewer,
        document.createElement('div'),
        sceneId,
        (message) => statuses.push(message),
      )

      expect(scene.actions.length).toBeGreaterThan(0)
      expect(statuses[statuses.length - 1]).toBeTruthy()
      expect(() => scene.dispose()).not.toThrow()
    },
  )

  it('draws the full interpolation route and toggles camera follow', async () => {
    const viewer = createViewer()
    const statuses: string[] = []
    const scene = await createModelScene(
      viewer,
      document.createElement('div'),
      'model-interpolation',
      (message) => statuses.push(message),
    )
    const mockViewer = viewerInstances[0]!
    const route = mockViewer.entities.values.find(
      (entity) => entity.id === 'model-interpolation-route',
    )
    const model = mockViewer.entities.values.find(
      (entity) => entity.id === 'model-interpolation-demo',
    )

    expect(route?.polyline).toMatchObject({ show: true, width: 5 })
    expect(route?.polyline?.positions as unknown[]).toHaveLength(5)
    expect(model?.model?.uri).toContain('cesium-air.glb')
    expect(statuses[statuses.length - 1]).toContain('完整运动轨迹')
    expect(scene.actions.map((action) => action.id)).toEqual([
      'toggle-camera-follow',
      'start-interpolation',
      'pause-interpolation',
      'resume-interpolation',
      'reset-interpolation',
    ])

    const toggleFollow = scene.actions.find((action) => action.id === 'toggle-camera-follow')
    await toggleFollow?.run()
    expect(statuses[statuses.length - 1]).toContain('已开启视角跟随')

    mockViewer.camera.lookAtTransform.mockClear()
    mockViewer.scene.preUpdate.raiseEvent()
    expect(mockViewer.camera.lookAtTransform).toHaveBeenCalledOnce()

    await toggleFollow?.run()
    expect(statuses[statuses.length - 1]).toContain('已关闭视角跟随')
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalled()

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(mockViewer.scene.preUpdate.listeners.size).toBe(0)
  })

  it('requires frames while wind animations play and stops the ticker on dispose', async () => {
    const viewer = createViewer()
    const scene = await createModelScene(
      viewer,
      document.createElement('div'),
      'wind-turbine',
      () => {},
    )
    const mockViewer = viewerInstances[0]!

    expect(viewer.clock.shouldAnimate).toBe(true)
    mockViewer.scene.requestRender.mockClear()
    mockViewer.scene.preUpdate.raiseEvent()
    expect(mockViewer.scene.requestRender).toHaveBeenCalledOnce()

    await scene.actions[0]?.run()
    expect(viewer.clock.shouldAnimate).toBe(false)
    mockViewer.scene.requestRender.mockClear()
    mockViewer.scene.preUpdate.raiseEvent()
    expect(mockViewer.scene.requestRender).not.toHaveBeenCalled()

    scene.dispose()
    expect(viewer.clock.shouldAnimate).toBe(false)
    expect(mockViewer.scene.preUpdate.listeners.size).toBe(0)
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('places all reference wind turbines at their source elevations', async () => {
    const viewer = createViewer()
    const statuses: string[] = []
    await createModelScene(viewer, document.createElement('div'), 'wind-turbine', (message) =>
      statuses.push(message),
    )
    const mockViewer = viewerInstances[0]!
    const turbines = mockViewer.entities.values.filter((entity) =>
      entity.id.startsWith('wind-turbine-'),
    )
    const positions = turbines.map(
      (entity) =>
        entity.position?.getValue() as {
          longitude: number
          latitude: number
          height: number
        },
    )

    expect(turbines).toHaveLength(24)
    expect(positions[0]).toEqual({
      longitude: 112.227630577,
      latitude: 39.0613382363999,
      height: 1815,
    })
    expect(positions[positions.length - 1]).toEqual({
      longitude: 112.230322327,
      latitude: 39.0281575923999,
      height: 1965,
    })
    expect(positions.map((position) => position.height)).toEqual(referenceElevations)
    expect(turbines.every((entity) => entity.model?.uri?.includes('wind-turbine.glb'))).toBe(true)
    expect(turbines.every((entity) => entity.model?.runAnimations)).toBe(true)
    expect(statuses[statuses.length - 1]).toContain('24 台本地风力发电机')
    expect(statuses[statuses.length - 1]).toContain('高程')

    const view = mockViewer.camera.setView.mock.calls[0]?.[0] as {
      destination: { longitude: number; latitude: number; height: number }
      orientation: { heading: number; pitch: number; roll: number }
    }
    expect(view.destination).toEqual({
      longitude: 112.245269,
      latitude: 39.066518,
      height: 2913,
    })
    expect(view.orientation.heading).toBeCloseTo((226 * Math.PI) / 180)
    expect(view.orientation.pitch).toBeCloseTo((-21 * Math.PI) / 180)
    expect(view.orientation.roll).toBe(0)
  })
})
