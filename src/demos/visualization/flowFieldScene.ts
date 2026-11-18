import * as Cesium from 'cesium'
import { ref } from 'vue'

import {
  createFlowParticleSeeds,
  OCEAN_FLOW_SEED,
  OCEAN_FLOW_TRAIL_LENGTH,
  OCEAN_PARTICLE_COUNT,
  oceanCurrentColors,
  oceanFlowRegion,
  pickStableColor,
  sampleHeatColor,
  sampleOceanCurrent,
  sampleOceanCurrentHeat,
  sampleWindField,
  WIND_FLOW_SEED,
  WIND_FLOW_TRAIL_LENGTH,
  WIND_PARTICLE_COUNT,
  windFieldColors,
  windFlowRegion,
  type FlowParticleSeed,
  type FlowRegion,
  type FlowVector,
} from '@/data/dataVisualization'
import { framePositions, throwIfAborted } from '@/demos/visualization/shared'
import { createRgbaPngDataUri } from '@/demos/visualization/texture'
import type {
  StatusReporter,
  VisualizationAnimationState,
  VisualizationScene,
} from '@/demos/visualization/types'

interface FlowFieldDefinition {
  colors: readonly string[]
  count: number
  height: number
  idPrefix: string
  opacity: number
  pausedStatus: string
  playingStatus: string
  region: FlowRegion
  resumedStatus: string
  sample: (longitude: number, latitude: number) => FlowVector
  seed: number
  speedScale: number
  stepDegrees: number
  trailLength: number
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
  height: 620,
  idPrefix: 'ocean-current',
  opacity: 0.9,
  pausedStatus: '海流热力图动画已暂停，可查看当前流向与流速。',
  playingStatus: `海流热力图已就绪，${OCEAN_PARTICLE_COUNT} 条确定性流线正在东亚至西太平洋循环。`,
  region: oceanFlowRegion,
  resumedStatus: '海流热力图继续播放中。',
  sample: sampleOceanCurrent,
  seed: OCEAN_FLOW_SEED,
  speedScale: 1.35,
  stepDegrees: 0.035,
  trailLength: OCEAN_FLOW_TRAIL_LENGTH,
  trailWidth: 1.45,
}

const WIND_FIELD: FlowFieldDefinition = {
  colors: windFieldColors,
  count: WIND_PARTICLE_COUNT,
  height: 1200,
  idPrefix: 'wind-field',
  opacity: 0.82,
  pausedStatus: '风场流线动画已暂停，可查看当前风向与风速。',
  playingStatus: `风场流线已就绪，${WIND_PARTICLE_COUNT} 条确定性流线正在中国及周边区域循环。`,
  region: windFlowRegion,
  resumedStatus: '风场流线继续播放中。',
  sample: sampleWindField,
  seed: WIND_FLOW_SEED,
  speedScale: 2.1,
  stepDegrees: 0.022,
  trailLength: WIND_FLOW_TRAIL_LENGTH,
  trailWidth: 0.95,
}

function createOceanHeatmapTexture() {
  const width = 192
  const height = 144
  const pixels = new Uint8Array(width * height * 4)

  for (let row = 0; row < height; row += 1) {
    const latitude =
      oceanFlowRegion.north -
      ((row + 0.5) / height) * (oceanFlowRegion.north - oceanFlowRegion.south)

    for (let column = 0; column < width; column += 1) {
      const longitude =
        oceanFlowRegion.west +
        ((column + 0.5) / width) * (oceanFlowRegion.east - oceanFlowRegion.west)
      const value = sampleOceanCurrentHeat(longitude, latitude)
      const [red, green, blue] = sampleHeatColor(value)
      const offset = (row * width + column) * 4
      pixels[offset] = red
      pixels[offset + 1] = green
      pixels[offset + 2] = blue
      pixels[offset + 3] = Math.round(45 + value * 185)
    }
  }

  return createRgbaPngDataUri(width, height, pixels)
}

function createOceanHeatmapEntity(viewer: Cesium.Viewer) {
  return viewer.entities.add({
    id: 'ocean-current-heatmap',
    rectangle: {
      coordinates: Cesium.Rectangle.fromDegrees(
        oceanFlowRegion.west,
        oceanFlowRegion.south,
        oceanFlowRegion.east,
        oceanFlowRegion.north,
      ),
      height: 220,
      material: new Cesium.ImageMaterialProperty({
        color: Cesium.Color.WHITE.withAlpha(0.9),
        image: createOceanHeatmapTexture(),
        transparent: true,
      }),
    },
  })
}

function seedTrail(seed: FlowParticleSeed, field: FlowFieldDefinition) {
  const trail: Array<[number, number]> = []
  let longitude = seed.longitude
  let latitude = seed.latitude

  for (let index = 0; index < field.trailLength; index += 1) {
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
  if (particle.trail.length > field.trailLength) {
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

  if (field.idPrefix === 'ocean-current') {
    entities.push(createOceanHeatmapEntity(viewer))
  }

  for (const seed of seeds) {
    const vector = field.sample(seed.longitude, seed.latitude)
    const color = Cesium.Color.fromCssColorString(
      pickStableColor(vector.speed / field.speedScale, field.colors),
    ).withAlpha(field.opacity)
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
        id: `${field.idPrefix}-flow-${particles.length - 1}`,
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

  framePositions(
    viewer,
    createFlowRegionPositions(field.region, field.height),
    field.idPrefix === 'wind-field' ? -10 : 0,
    field.idPrefix === 'wind-field' ? -38 : -66,
    field.idPrefix === 'wind-field' ? 1.25 : 1.2,
  )
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
