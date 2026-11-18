import * as Cesium from 'cesium'
import { ref } from 'vue'

import {
  createFlowParticleSeeds,
  FLOW_TRAIL_LENGTH,
  OCEAN_FLOW_SEED,
  OCEAN_PARTICLE_COUNT,
  oceanCurrentColors,
  oceanFlowRegion,
  pickStableColor,
  sampleOceanCurrent,
  sampleWindField,
  WIND_FLOW_SEED,
  WIND_PARTICLE_COUNT,
  windFieldColors,
  windFlowRegion,
  type FlowParticleSeed,
  type FlowRegion,
  type FlowVector,
} from '@/data/dataVisualization'
import { framePositions, throwIfAborted } from '@/demos/visualization/shared'
import type {
  StatusReporter,
  VisualizationAnimationState,
  VisualizationScene,
} from '@/demos/visualization/types'

interface FlowFieldDefinition {
  colors: readonly string[]
  count: number
  height: number
  label: string
  pausedStatus: string
  playingStatus: string
  region: FlowRegion
  resumedStatus: string
  sample: (longitude: number, latitude: number) => FlowVector
  seed: number
  stepDegrees: number
  trailWidth: number
}

interface FlowParticle {
  latitude: number
  longitude: number
  seed: FlowParticleSeed
  trail: Array<[longitude: number, latitude: number]>
}

const OCEAN_FIELD: FlowFieldDefinition = {
  colors: oceanCurrentColors,
  count: OCEAN_PARTICLE_COUNT,
  height: 350,
  label: '海流',
  pausedStatus: '海流动画已暂停，可查看当前流向与流速。',
  playingStatus: '海流场已就绪，96 条确定性流线正在东亚至西太平洋循环。',
  region: oceanFlowRegion,
  resumedStatus: '海流动画继续播放中。',
  sample: sampleOceanCurrent,
  seed: OCEAN_FLOW_SEED,
  stepDegrees: 0.07,
  trailWidth: 3.2,
}

const WIND_FIELD: FlowFieldDefinition = {
  colors: windFieldColors,
  count: WIND_PARTICLE_COUNT,
  height: 900,
  label: '风场',
  pausedStatus: '风场动画已暂停，可查看当前风向与风速。',
  playingStatus: '风场已就绪，112 条确定性流线正在中国及周边区域循环。',
  region: windFlowRegion,
  resumedStatus: '风场动画继续播放中。',
  sample: sampleWindField,
  seed: WIND_FLOW_SEED,
  stepDegrees: 0.08,
  trailWidth: 2.8,
}

function seedTrail(seed: FlowParticleSeed, field: FlowFieldDefinition) {
  const trail: Array<[number, number]> = []
  let longitude = seed.longitude
  let latitude = seed.latitude

  for (let index = 0; index < FLOW_TRAIL_LENGTH; index += 1) {
    trail.unshift([longitude, latitude])
    const vector = field.sample(longitude, latitude)
    longitude -= vector.eastward * field.stepDegrees * 0.8
    latitude -= vector.northward * field.stepDegrees * 0.8
  }

  return trail
}

function advanceParticle(particle: FlowParticle, field: FlowFieldDefinition) {
  const vector = field.sample(particle.longitude, particle.latitude)
  particle.longitude += vector.eastward * field.stepDegrees
  particle.latitude += vector.northward * field.stepDegrees

  if (
    particle.longitude < field.region.west ||
    particle.longitude > field.region.east ||
    particle.latitude < field.region.south ||
    particle.latitude > field.region.north
  ) {
    particle.longitude = particle.seed.longitude
    particle.latitude = particle.seed.latitude
    particle.trail = seedTrail(particle.seed, field)
    return
  }

  particle.trail.push([particle.longitude, particle.latitude])
  if (particle.trail.length > FLOW_TRAIL_LENGTH) {
    particle.trail.shift()
  }
}

function toPositions(trail: Array<[number, number]>, height: number) {
  return Cesium.Cartesian3.fromDegreesArrayHeights(
    trail.flatMap(([longitude, latitude]) => [longitude, latitude, height]),
  )
}

function createFlowRegionPositions(region: FlowRegion, height: number) {
  return [
    Cesium.Cartesian3.fromDegrees(region.west, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.north, height),
    Cesium.Cartesian3.fromDegrees(region.west, region.north, height),
  ]
}

function createFlowFieldScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  field: FlowFieldDefinition,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  viewer.scene.globe.enableLighting = false
  viewer.clock.shouldAnimate = false

  const seeds = createFlowParticleSeeds(field.region, field.count, field.seed)
  const particles: FlowParticle[] = []
  const entities: Cesium.Entity[] = []

  for (const seed of seeds) {
    const vector = field.sample(seed.longitude, seed.latitude)
    const color = Cesium.Color.fromCssColorString(
      pickStableColor(vector.speed / 1.15, field.colors),
    ).withAlpha(0.94)
    const trail = seedTrail(seed, field)
    const particle: FlowParticle = {
      latitude: seed.latitude,
      longitude: seed.longitude,
      seed,
      trail,
    }
    particles.push(particle)

    entities.push(
      viewer.entities.add({
        id: `${field.label}-flow-${particles.length - 1}`,
        polyline: {
          positions: new Cesium.CallbackProperty(
            () => toPositions(particle.trail, field.height),
            false,
          ),
          width: field.trailWidth,
          material: color,
        },
      }),
    )
  }

  framePositions(viewer, createFlowRegionPositions(field.region, field.height), 0, -62, 1.6)
  setStatus(field.playingStatus)

  const animationState = ref<VisualizationAnimationState>('playing')
  let listening = false

  const tick = () => {
    if (animationState.value !== 'playing') {
      return
    }

    particles.forEach((particle) => {
      advanceParticle(particle, field)
    })
    viewer.scene.requestRender()
  }

  const startListening = () => {
    if (listening) {
      return
    }

    listening = true
    viewer.scene.preUpdate.addEventListener(tick)
    viewer.scene.requestRender()
  }

  const stopListening = () => {
    if (!listening) {
      return
    }

    listening = false
    viewer.scene.preUpdate.removeEventListener(tick)
  }

  startListening()

  return {
    actions: [],
    animationState,
    dispose() {
      stopListening()
      for (const entity of entities) {
        viewer.entities.remove(entity)
      }
      entities.length = 0
    },
    toggleAnimation() {
      if (animationState.value === 'playing') {
        animationState.value = 'paused'
        stopListening()
        setStatus(field.pausedStatus)
      } else {
        animationState.value = 'playing'
        startListening()
        setStatus(field.resumedStatus)
      }
      viewer.scene.requestRender()
    },
  }
}

export function createOceanCurrentScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  return createFlowFieldScene(viewer, setStatus, OCEAN_FIELD, signal)
}

export function createWindFieldScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  return createFlowFieldScene(viewer, setStatus, WIND_FIELD, signal)
}
