import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ParticleSceneId } from '../data/layers'
import {
  PARTICLE_CAMERA_HEIGHT,
  PARTICLE_ORIGIN,
  createParticleScene,
} from '../demos/particles/particleScene'
import {
  Cartesian3,
  CircleEmitter,
  ConeEmitter,
  Viewer,
  cesiumMockState,
  particleEmitterInstances,
  particleSystemInstances,
  particleTextureRequests,
  resetCesiumMock,
  scenePrimitiveRemoves,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createParticleScene>[0]

const particleCases: Array<{
  id: ParticleSceneId
  texture: string
  emitter: 'cone' | 'circle'
  emitterValue: number
  startColor: [number, number, number, number]
  endColor: [number, number, number, number]
  gravity: boolean
  height: number
}> = [
  {
    emitter: 'cone',
    emitterValue: Math.PI / 4,
    endColor: [0.5, 0, 0, 0],
    gravity: false,
    height: 0,
    id: 'particle-fire',
    startColor: [1, 1, 1, 1],
    texture: 'fire.png',
  },
  {
    emitter: 'circle',
    emitterValue: 0.2,
    endColor: [0.8, 0.86, 1, 0.4],
    gravity: true,
    height: 0,
    id: 'particle-water-gun',
    startColor: [1, 1, 1, 0.6],
    texture: 'water.png',
  },
  {
    emitter: 'circle',
    emitterValue: 5,
    endColor: [1, 1, 0, 0.3],
    gravity: false,
    height: 0,
    id: 'particle-explosion',
    startColor: [1, 0, 0, 0.7],
    texture: 'explot.png',
  },
  {
    emitter: 'circle',
    emitterValue: 2,
    endColor: [1, 1, 0, 0.3],
    gravity: true,
    height: 0,
    id: 'particle-spray',
    startColor: [1, 0, 0, 0.7],
    texture: 'fire.png',
  },
  {
    emitter: 'circle',
    emitterValue: 2,
    endColor: [1, 1, 1, 0.3],
    gravity: true,
    height: 100,
    id: 'particle-smoke',
    startColor: [0, 0, 0, 0.7],
    texture: 'smoke.png',
  },
]

function createViewer() {
  return new Viewer(document.createElement('div'), {})
}

function asSceneViewer(viewer: Viewer) {
  return viewer as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    statuses,
    setStatus: (message: string) => statuses.push(message),
  }
}

describe('particle scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it.each(particleCases)(
    'creates the $id scene with reference parameters and pause semantics',
    async ({ id, texture, emitter, emitterValue, startColor, endColor, gravity, height }) => {
      const viewer = createViewer()
      const { setStatus, statuses } = collectStatus()

      const scene = await createParticleScene(asSceneViewer(viewer), id, setStatus)
      const system = particleSystemInstances[0]!
      const options = system.options as Record<string, unknown>
      const createdEmitter = particleEmitterInstances[0]!
      const entity = viewer.entities.values[0]!

      expect(particleSystemInstances).toHaveLength(1)
      expect(options.image).toEqual(expect.stringContaining(texture))
      expect(options).toMatchObject({
        emissionRate: 5,
        endScale: 10,
        lifetime: 16,
        loop: true,
        maximumParticleLife: 6,
        maximumSpeed: 4,
        minimumParticleLife: 1,
        minimumSpeed: 1,
        sizeInMeters: true,
        startScale: 0,
      })
      expect(options.imageSize).toMatchObject({ x: 25, y: 25 })
      expect(options.startColor).toMatchObject(colorObject(startColor))
      expect(options.endColor).toMatchObject(colorObject(endColor))
      const emitterConstructor = emitter === 'cone' ? ConeEmitter : CircleEmitter
      const emitterValueKey = emitter === 'cone' ? 'angle' : 'radius'
      expect(createdEmitter).toBeInstanceOf(emitterConstructor)
      expect((createdEmitter as unknown as Record<string, number>)[emitterValueKey]).toBeCloseTo(
        emitterValue,
      )
      expect(options.updateCallback === undefined).toBe(!gravity)
      expect(viewer.clock.shouldAnimate).toBe(true)
      expect(viewer.scene.requestRenderMode).toBe(false)
      expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
      expect(particleTextureRequests[0]).toContain(texture)
      expect(entity.position?.getValue()).toMatchObject({ height })
      expect(viewer.camera.setView).toHaveBeenCalledWith({
        destination: {
          height: PARTICLE_CAMERA_HEIGHT,
          latitude: PARTICLE_ORIGIN.latitude,
          longitude: PARTICLE_ORIGIN.longitude,
        },
      })
      expect(statuses[statuses.length - 1]).toContain('默认循环播放')
      expect(viewer.scene.preUpdate.listeners.size).toBe(1)

      viewer.scene.preUpdate.raiseEvent()
      expect(system.modelMatrix).toBeTruthy()
      expect(system.emitterModelMatrix).toMatchObject({
        translation: { x: -4, y: 0, z: 1.4 },
        type: 'translation',
      })

      scene.pause()
      expect(scene.paused.value).toBe(true)
      expect(viewer.clock.shouldAnimate).toBe(false)
      expect(viewer.scene.requestRenderMode).toBe(true)
      expect(statuses[statuses.length - 1]).toContain('已暂停')

      scene.resume()
      expect(scene.paused.value).toBe(false)
      expect(viewer.clock.shouldAnimate).toBe(true)
      expect(viewer.scene.requestRenderMode).toBe(false)
      expect(statuses[statuses.length - 1]).toContain('循环播放中')

      scene.dispose()
      expect(viewer.scene.preUpdate.listeners.size).toBe(0)
      expect(scenePrimitiveRemoves).toContain(system)
      expect(system.destroyed).toBe(true)
      expect(viewer.entities.values).toHaveLength(0)
      expect(viewer.clock.shouldAnimate).toBe(false)
      expect(viewer.scene.requestRenderMode).toBe(true)
      expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    },
  )

  it('applies the water jet gravity callback in the reference direction', async () => {
    const viewer = createViewer()
    const scene = await createParticleScene(
      asSceneViewer(viewer),
      'particle-water-gun',
      () => undefined,
    )
    const options = particleSystemInstances[0]!.options as {
      updateCallback: (particle: { position: Cartesian3; velocity: Cartesian3 }, dt: number) => void
    }
    const particle = {
      position: new Cartesian3(3, 4, 0),
      velocity: new Cartesian3(0, 0, 0),
    }

    options.updateCallback(particle, 2)

    expect(particle.velocity.x).toBeCloseTo(40)
    expect(particle.velocity.y).toBeCloseTo(1.6)
    expect(particle.velocity.z).toBeCloseTo(-60)

    scene.dispose()
  })

  it('restores the previous clock and render state after dispose', async () => {
    const viewer = createViewer()
    viewer.clock.shouldAnimate = true
    viewer.scene.requestRenderMode = false
    viewer.scene.globe.depthTestAgainstTerrain = true

    const scene = await createParticleScene(
      asSceneViewer(viewer),
      'particle-smoke',
      () => undefined,
    )

    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    scene.dispose()

    expect(viewer.clock.shouldAnimate).toBe(true)
    expect(viewer.scene.requestRenderMode).toBe(false)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(true)
  })

  it('rejects before creating scene resources when the local texture cannot load', async () => {
    const viewer = createViewer()
    cesiumMockState.particleTextureOutcome = 'failure'

    await expect(
      createParticleScene(asSceneViewer(viewer), 'particle-fire', () => undefined),
    ).rejects.toThrow('mock particle texture failure')

    expect(particleSystemInstances).toHaveLength(0)
    expect(viewer.entities.values).toHaveLength(0)
    expect(viewer.scene.preUpdate.listeners.size).toBe(0)
    expect(viewer.camera.setView).not.toHaveBeenCalled()
  })
})

function colorObject([red, green, blue, alpha]: [number, number, number, number]) {
  return { alpha, blue, green, red }
}
