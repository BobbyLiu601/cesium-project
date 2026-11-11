import type { Viewer } from 'cesium'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createModelScene } from '../demos/modelScene'
import type { ModelSceneId } from '../data/layers'
import {
  EllipsoidTerrainProvider,
  modelInstances,
  resetCesiumMock,
  screenSpaceEventHandlerInstances,
  ScreenSpaceEventType,
  Viewer as ViewerMock,
  viewerInstances,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

const sceneIds: ModelSceneId[] = [
  'load-model',
  'primitive-model',
  'mass-models',
  'model-motion',
  'model-interpolation',
  'pick-child-node',
  'manual-model',
  'wind-turbine',
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

  it('loads the desktop mass-model count and removes every primitive on dispose', async () => {
    const viewer = createViewer()
    const statuses: string[] = []
    const scene = await createModelScene(
      viewer,
      document.createElement('div'),
      'mass-models',
      (message) => statuses.push(message),
    )

    expect(modelInstances).toHaveLength(1_000)
    expect(statuses[statuses.length - 1]).toContain('1,000')
    expect(statuses[statuses.length - 1]).toContain('桌面端')
    expect(viewerInstances[0]?.camera.viewBoundingSphere).toHaveBeenCalledOnce()

    scene.dispose()
    expect(viewerInstances[0]?.scene.primitives.remove).toHaveBeenCalledTimes(1_000)
  })

  it('falls back to 300 mass models on a narrow viewport', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 375,
    })

    try {
      const statuses: string[] = []
      await createModelScene(
        createViewer(),
        document.createElement('div'),
        'mass-models',
        (message) => statuses.push(message),
      )

      expect(modelInstances).toHaveLength(300)
      expect(statuses[statuses.length - 1]).toContain('300')
      expect(statuses[statuses.length - 1]).toContain('移动端降载')
    } finally {
      Object.defineProperty(window, 'innerWidth', {
        configurable: true,
        value: originalWidth,
      })
    }
  })

  it('keeps direct motion and interpolation motion as distinct demonstrations', async () => {
    const motionStatuses: string[] = []
    const motionViewer = createViewer()
    const motionScene = await createModelScene(
      motionViewer,
      document.createElement('div'),
      'model-motion',
      (message) => motionStatuses.push(message),
    )

    expect(motionStatuses[motionStatuses.length - 1]).toContain('第一人称')
    expect(motionViewer.clock.shouldAnimate).toBe(true)
    expect(motionScene.actions.map((action) => action.id)).toContain('toggle-first-person')
    expect(motionScene.actions.map((action) => action.id)).not.toContain('start-interpolation')
    motionScene.dispose()

    const interpolationStatuses: string[] = []
    const interpolationViewer = createViewer()
    const interpolationScene = await createModelScene(
      interpolationViewer,
      document.createElement('div'),
      'model-interpolation',
      (message) => interpolationStatuses.push(message),
    )

    expect(interpolationStatuses[interpolationStatuses.length - 1]).toContain('插值')
    expect(interpolationViewer.clock.shouldAnimate).toBe(false)
    expect(interpolationScene.actions.map((action) => action.id)).toEqual([
      'start-interpolation',
      'pause-interpolation',
      'resume-interpolation',
      'reset-interpolation',
    ])
    interpolationScene.dispose()
  })

  it('requests frames while model animations are playing and stops after dispose', async () => {
    const viewer = createViewer()
    const scene = await createModelScene(
      viewer,
      document.createElement('div'),
      'load-model',
      () => {},
    )
    const mockViewer = viewerInstances[0]!

    expect(viewer.clock.shouldAnimate).toBe(true)
    mockViewer.scene.requestRender.mockClear()
    mockViewer.scene.preUpdate.raiseEvent()
    expect(mockViewer.scene.requestRender).toHaveBeenCalledOnce()

    viewer.clock.shouldAnimate = false
    mockViewer.scene.preUpdate.raiseEvent()
    expect(mockViewer.scene.requestRender).toHaveBeenCalledOnce()

    scene.dispose()
    expect(viewer.clock.shouldAnimate).toBe(false)
    expect(mockViewer.scene.preUpdate.listeners.size).toBe(0)
  })

  it('reports the picked child node name without blocking dialogs', async () => {
    const statuses: string[] = []
    const viewer = createViewer()
    const scene = await createModelScene(
      viewer,
      document.createElement('div'),
      'pick-child-node',
      (message) => statuses.push(message),
    )
    const mockViewer = viewerInstances[0]!
    mockViewer.scene.pick.mockReturnValue({ detail: { node: { _name: 'Prop__2_' } } })

    screenSpaceEventHandlerInstances[0]?.actions.get(ScreenSpaceEventType.LEFT_CLICK)?.({
      position: { x: 120, y: 240 },
    })

    expect(statuses[statuses.length - 1]).toBe('已选择模型子节点：Prop__2_')
    scene.dispose()
    expect(screenSpaceEventHandlerInstances[0]?.destroy).toHaveBeenCalledOnce()
  })

  it('uses local licensed or project-generated model assets in every primitive path', async () => {
    const loadViewer = createViewer()
    await createModelScene(loadViewer, document.createElement('div'), 'load-model', () => {})
    expect(viewerInstances[0]?.entities.values[0]?.model?.uri).toContain('cesium-air.glb')

    resetCesiumMock()
    const primitiveViewer = createViewer()
    await createModelScene(
      primitiveViewer,
      document.createElement('div'),
      'primitive-model',
      () => {},
    )
    expect(modelInstances[0]?.options.url).toContain('cesium-man.glb')

    resetCesiumMock()
    const cityViewer = createViewer()
    await createModelScene(cityViewer, document.createElement('div'), 'manual-model', () => {})
    expect(viewerInstances[0]?.entities.values[0]?.model?.uri).toContain('city-block.glb')

    resetCesiumMock()
    const windViewer = createViewer()
    const windScene = await createModelScene(
      windViewer,
      document.createElement('div'),
      'wind-turbine',
      () => {},
    )
    const turbines = viewerInstances[0]?.entities.values ?? []
    expect(turbines).toHaveLength(5)
    expect(turbines.every((entity) => entity.model?.uri?.includes('wind-turbine.glb'))).toBe(true)
    expect(turbines.every((entity) => entity.model?.runAnimations)).toBe(true)

    await windScene.actions[0]?.run()
    expect(windViewer.clock.shouldAnimate).toBe(false)
    expect(turbines.every((entity) => entity.model?.runAnimations === false)).toBe(true)
  })
})
