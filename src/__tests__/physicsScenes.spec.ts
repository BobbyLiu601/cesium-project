import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { watch } from 'vue'
import { Cartesian2, ScreenSpaceEventType } from 'cesium'

import type { PhysicsEngineSceneId } from '@/data/layers'
import { PHYSICS_SCENE_DEFINITIONS, createPhysicsEngineScene } from '../demos/physicsScene'
import type { PhysicsEngineScene } from '../demos/physicsEngine/types'
import {
  Viewer,
  resetCesiumMock,
  scenePrimitiveAdds,
  scenePrimitiveRemoves,
  screenSpaceEventHandlerInstances,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

const sceneCases: Array<{
  controlCount: number
  fire: boolean
  id: PhysicsEngineSceneId
  softBodyCount: number
}> = [
  { controlCount: 4, fire: false, id: 'vehicle-motion', softBodyCount: 0 },
  { controlCount: 2, fire: false, id: 'flag-rotation', softBodyCount: 1 },
  { controlCount: 2, fire: false, id: 'ball-rotation', softBodyCount: 1 },
  { controlCount: 0, fire: true, id: 'soft-body-collision', softBodyCount: 2 },
  { controlCount: 0, fire: true, id: 'fracture-collision', softBodyCount: 0 },
]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as Parameters<
    typeof createPhysicsEngineScene
  >[0]
}

function preUpdateListenerCount(viewer: ReturnType<typeof createViewer>) {
  return (viewer.scene.preUpdate as unknown as { listeners: Set<() => void> }).listeners.size
}

describe('physics engine scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each(sceneCases)(
    'creates, pauses, resets, and cleans up $id',
    async ({ controlCount, fire, id, softBodyCount }) => {
      const viewer = createViewer()
      const statuses: string[] = []
      const scene: PhysicsEngineScene = await createPhysicsEngineScene(viewer, id, (message) =>
        statuses.push(message),
      )

      expect(PHYSICS_SCENE_DEFINITIONS[id].hint.length).toBeGreaterThan(0)
      expect(scene.controls).toHaveLength(controlCount)
      expect(scene.stats.value.bodyCount).toBeGreaterThan(0)
      expect(scene.stats.value.softBodyCount).toBe(softBodyCount)
      expect(scene.animationState.value).toBe('playing')
      expect(preUpdateListenerCount(viewer)).toBe(1)
      expect(statuses[statuses.length - 1]).toContain('Ammo.js')

      const initialBodyCount = scene.stats.value.bodyCount
      expect(viewer.scene.canvas).toBeDefined()
      expect(screenSpaceEventHandlerInstances).toHaveLength(fire ? 1 : 0)
      if (fire) {
        const handler = screenSpaceEventHandlerInstances[0]!
        handler.actions.get(ScreenSpaceEventType.LEFT_DOWN)?.({
          position: new Cartesian2(120, 120),
        })
      }
      expect(scene.stats.value.projectileCount).toBe(fire ? 1 : 0)

      scene.toggleAnimation()
      expect(scene.animationState.value).toBe('paused')
      scene.toggleAnimation()
      expect(scene.animationState.value).toBe('playing')

      scene.reset()
      expect(scene.animationState.value).toBe('playing')
      expect(scene.stats.value.bodyCount).toBe(initialBodyCount)
      expect(scene.stats.value.projectileCount).toBe(0)
      expect(scene.stats.value.softBodyCount).toBe(softBodyCount)
      expect(preUpdateListenerCount(viewer)).toBe(1)

      scene.dispose()
      expect(preUpdateListenerCount(viewer)).toBe(0)
      expect(viewer.entities.values).toHaveLength(0)
      expect(scenePrimitiveRemoves).toHaveLength(scenePrimitiveAdds.length)
      expect(screenSpaceEventHandlerInstances.every((handler) => handler.actions.size === 0)).toBe(
        true,
      )
    },
  )

  it('rejects a scene when its abort signal is already cancelled', async () => {
    const viewer = createViewer()
    const controller = new AbortController()
    controller.abort()

    await expect(
      createPhysicsEngineScene(viewer, 'vehicle-motion', vi.fn(), {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
  })

  it('limits reactive physics stats updates while simulation frames keep running', async () => {
    const viewer = createViewer()
    const scene = await createPhysicsEngineScene(viewer, 'vehicle-motion', vi.fn())
    let now = performance.now()
    vi.spyOn(performance, 'now').mockImplementation(() => now)
    const statsUpdates: number[] = []
    const stopWatching = watch(scene.stats, () => statsUpdates.push(now), { flush: 'sync' })

    for (let frame = 0; frame < 120; frame += 1) {
      now += 1_000 / 60
      viewer.scene.preUpdate.raiseEvent()
    }

    stopWatching()
    expect(statsUpdates.length).toBeLessThanOrEqual(5)
    scene.dispose()
  })

  it('reduces render effects and resolution when frame pacing stays below the target', async () => {
    const viewer = createViewer()
    const scene = await createPhysicsEngineScene(viewer, 'vehicle-motion', vi.fn())
    let now = performance.now()
    vi.spyOn(performance, 'now').mockImplementation(() => now)

    for (let frame = 0; frame < 120; frame += 1) {
      now += 60
      viewer.scene.preUpdate.raiseEvent()
    }

    expect(viewer.scene.msaaSamples).toBe(1)
    expect(viewer.scene.postProcessStages.fxaa.enabled).toBe(false)
    expect(viewer.scene.fog.enabled).toBe(false)
    expect(viewer.scene.globe.showGroundAtmosphere).toBe(false)
    expect(viewer.resolutionScale).toBeLessThan(1)
    scene.dispose()
  })

  it('supports an injected Ammo loader failure without leaking a viewer session', async () => {
    const viewer = createViewer()
    const error = new Error('ammo unavailable')

    await expect(
      createPhysicsEngineScene(viewer, 'soft-body-collision', vi.fn(), {
        loadAmmo: () => Promise.reject(error),
      }),
    ).rejects.toBe(error)
    expect(viewer.entities.values).toHaveLength(0)
  })
})
