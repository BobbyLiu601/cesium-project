import * as Cesium from 'cesium'
import { ref } from 'vue'

import explotTexture from '@/assets/particle-textures/explot.png'
import fireTexture from '@/assets/particle-textures/fire.png'
import smokeTexture from '@/assets/particle-textures/smoke.png'
import waterTexture from '@/assets/particle-textures/water.png'
import type { ParticleSceneId } from '@/data/layers'
import type { ParticleEffectsScene } from '@/demos/particles/types'

type GravityMode = 'none' | 'jet' | 'smoke'

interface ParticleSceneDefinition {
  gravity: GravityMode
  groundHeight: number
  image: string
  label: string
  startColor: Cesium.Color
  endColor: Cesium.Color
  createEmitter: () => Cesium.ParticleEmitter
}

export const PARTICLE_ORIGIN = {
  latitude: 32.71,
  longitude: -117.16,
} as const

export const PARTICLE_CAMERA_HEIGHT = 1_500

export const PARTICLE_SCENE_DEFINITIONS: Record<ParticleSceneId, ParticleSceneDefinition> = {
  'particle-fire': {
    createEmitter: () => new Cesium.ConeEmitter(Cesium.Math.toRadians(45)),
    endColor: new Cesium.Color(0.5, 0, 0, 0),
    gravity: 'none',
    groundHeight: 0,
    image: fireTexture,
    label: '火焰',
    startColor: new Cesium.Color(1, 1, 1, 1),
  },
  'particle-water-gun': {
    createEmitter: () => new Cesium.CircleEmitter(0.2),
    endColor: new Cesium.Color(0.8, 0.86, 1, 0.4),
    gravity: 'jet',
    groundHeight: 0,
    image: waterTexture,
    label: '水枪',
    startColor: new Cesium.Color(1, 1, 1, 0.6),
  },
  'particle-explosion': {
    createEmitter: () => new Cesium.CircleEmitter(5),
    endColor: Cesium.Color.YELLOW.withAlpha(0.3),
    gravity: 'none',
    groundHeight: 0,
    image: explotTexture,
    label: '爆炸',
    startColor: Cesium.Color.RED.withAlpha(0.7),
  },
  'particle-spray': {
    createEmitter: () => new Cesium.CircleEmitter(2),
    endColor: Cesium.Color.YELLOW.withAlpha(0.3),
    gravity: 'jet',
    groundHeight: 0,
    image: fireTexture,
    label: '喷雾',
    startColor: Cesium.Color.RED.withAlpha(0.7),
  },
  'particle-smoke': {
    createEmitter: () => new Cesium.CircleEmitter(2),
    endColor: Cesium.Color.WHITE.withAlpha(0.3),
    gravity: 'smoke',
    groundHeight: 100,
    image: smokeTexture,
    label: '烟',
    startColor: Cesium.Color.BLACK.withAlpha(0.7),
  },
}

function createGravityCallback(mode: Exclude<GravityMode, 'none'>) {
  const gravityScratch = new Cesium.Cartesian3()

  return (particle: Cesium.Particle, dt: number) => {
    const position = particle.position
    Cesium.Cartesian3.normalize(position, gravityScratch)
    if (mode === 'jet') {
      Cesium.Cartesian3.fromElements(20 * dt, gravityScratch.y * dt, -30 * dt, gravityScratch)
    } else {
      Cesium.Cartesian3.fromElements(20 * dt, 30 * dt, gravityScratch.y * dt, gravityScratch)
    }
    particle.velocity = Cesium.Cartesian3.add(particle.velocity, gravityScratch, particle.velocity)
  }
}

async function loadParticleTexture(image: string) {
  const request = Cesium.Resource.fetchImage({
    preferImageBitmap: false,
    url: image,
  })
  if (!request) {
    throw new Error('粒子纹理请求未能启动')
  }

  await request
}

export async function createParticleScene(
  viewer: Cesium.Viewer,
  sceneId: ParticleSceneId,
  setStatus: (message: string) => void,
): Promise<ParticleEffectsScene> {
  const definition = PARTICLE_SCENE_DEFINITIONS[sceneId]
  await loadParticleTexture(definition.image)

  const originalRequestRenderMode = viewer.scene.requestRenderMode
  const originalShouldAnimate = viewer.clock.shouldAnimate
  const originalDepthTest = viewer.scene.globe.depthTestAgainstTerrain
  const paused = ref(false)
  let disposed = false

  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(
      PARTICLE_ORIGIN.longitude,
      PARTICLE_ORIGIN.latitude,
      definition.groundHeight,
    ),
  })
  const emitterModelMatrix = Cesium.Matrix4.fromTranslation(new Cesium.Cartesian3(-4, 0, 1.4))

  viewer.clock.shouldAnimate = true
  viewer.scene.requestRenderMode = false
  viewer.scene.globe.depthTestAgainstTerrain = false

  const particleSystem = new Cesium.ParticleSystem({
    emissionRate: 5,
    emitter: definition.createEmitter(),
    endColor: definition.endColor,
    endScale: 10,
    image: definition.image,
    imageSize: new Cesium.Cartesian2(25, 25),
    lifetime: 16,
    loop: true,
    maximumParticleLife: 6,
    maximumSpeed: 4,
    minimumParticleLife: 1,
    minimumSpeed: 1,
    sizeInMeters: true,
    startColor: definition.startColor,
    startScale: 0,
    updateCallback:
      definition.gravity === 'none' ? undefined : createGravityCallback(definition.gravity),
  })

  viewer.scene.primitives.add(particleSystem)
  const preUpdateListener = (_scene: Cesium.Scene, time: Cesium.JulianDate) => {
    particleSystem.modelMatrix = entity.computeModelMatrix(time)
    particleSystem.emitterModelMatrix = emitterModelMatrix
  }
  viewer.scene.preUpdate.addEventListener(preUpdateListener)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(
      PARTICLE_ORIGIN.longitude,
      PARTICLE_ORIGIN.latitude,
      PARTICLE_CAMERA_HEIGHT,
    ),
  })
  setStatus(`已加载${definition.label}粒子效果，默认循环播放`)

  return {
    actions: [],
    pause: () => {
      if (disposed || paused.value) {
        return
      }

      viewer.clock.shouldAnimate = false
      viewer.scene.requestRenderMode = true
      viewer.scene.requestRender()
      paused.value = true
      setStatus(`${definition.label}粒子效果已暂停，可继续播放或拖拽观察`)
    },
    paused,
    resume: () => {
      if (disposed || !paused.value) {
        return
      }

      viewer.clock.shouldAnimate = true
      viewer.scene.requestRenderMode = false
      paused.value = false
      setStatus(`${definition.label}粒子效果循环播放中`)
    },
    dispose: () => {
      if (disposed) {
        return
      }
      disposed = true
      viewer.scene.preUpdate.removeEventListener(preUpdateListener)
      viewer.scene.primitives.remove(particleSystem)
      if (typeof particleSystem.isDestroyed !== 'function' || !particleSystem.isDestroyed()) {
        particleSystem.destroy()
      }
      viewer.entities.remove(entity)
      viewer.clock.shouldAnimate = originalShouldAnimate
      viewer.scene.requestRenderMode = originalRequestRenderMode
      viewer.scene.globe.depthTestAgainstTerrain = originalDepthTest
      viewer.scene.requestRender()
    },
  }
}
