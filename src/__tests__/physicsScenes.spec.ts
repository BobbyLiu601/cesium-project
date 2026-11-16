import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { PhysicsEngineSceneId } from '@/data/layers'
import { PHYSICS_SCENE_DEFINITIONS, createPhysicsEngineScene } from '../demos/physicsScene'
import type { PhysicsEngineScene } from '../demos/physicsEngine/types'
import { Viewer, resetCesiumMock, screenSpaceEventHandlerInstances } from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

const sceneCases: Array<{
  controlCount: number
  id: PhysicsEngineSceneId
  softBodyCount: number
}> = [
  { controlCount: 4, id: 'vehicle-motion', softBodyCount: 0 },
  { controlCount: 2, id: 'flag-rotation', softBodyCount: 1 },
  { controlCount: 2, id: 'ball-rotation', softBodyCount: 1 },
  { controlCount: 1, id: 'soft-body-collision', softBodyCount: 2 },
  { controlCount: 1, id: 'fracture-collision', softBodyCount: 0 },
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
    async ({ controlCount, id, softBodyCount }) => {
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
      const fireControl = scene.controls.find((control) => control.kind === 'tap')
      fireControl?.press()
      expect(scene.stats.value.projectileCount).toBe(fireControl ? 1 : 0)
      expect(viewer.scene.canvas).toBeDefined()
      expect(screenSpaceEventHandlerInstances).toHaveLength(fireControl ? 1 : 0)

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
