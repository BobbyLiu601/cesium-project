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
  pickStableColorIndex,
  sampleHeatColor,
  sampleOceanCurrent,
  sampleOceanCurrentHeat,
  sampleWindField,
  WIND_FLOW_SEED,
  WIND_FLOW_TRAIL_LENGTH,
  WIND_PARTICLE_COUNT,
  WIND_PARTICLE_MAX_AGE,
  WIND_TRAIL_FADE_STEPS,
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
  VisualizationLegend,
  VisualizationScene,
} from '@/demos/visualization/types'

interface FlowFieldDefinition {
  colors: readonly string[]
  count: number
  height: number
  legend: VisualizationLegend
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

interface WindParticle extends FlowParticle {
  colorIndex: number
  fadeStep: number
  remaining: number
}

const OCEAN_FIELD: FlowFieldDefinition = {
  colors: oceanCurrentColors,
  count: OCEAN_PARTICLE_COUNT,
  height: 620,
  legend: {
    colors: oceanCurrentColors,
    maximumLabel: '高流速',
    minimumLabel: '低流速',
    title: '海流速度',
  },
  pausedStatus: '海流速度热力图动画已暂停，可查看当前流向与流速。',
  playingStatus: `海流速度热力图已就绪，${OCEAN_PARTICLE_COUNT} 条确定性流线正在东亚至西太平洋循环。`,
  region: oceanFlowRegion,
  resumedStatus: '海流速度热力图继续播放中。',
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
  legend: {
    colors: windFieldColors,
    maximumLabel: '高风速',
    minimumLabel: '低风速',
    title: '风速',
  },
  pausedStatus: '风粒子动画已暂停，可查看当前风速色带与长尾轨迹。',
  playingStatus: `风粒子场已就绪，${WIND_PARTICLE_COUNT} 条带渐隐拖尾的确定性粒子正在中国及周边区域循环。`,
  region: windFlowRegion,
  resumedStatus: '风粒子动画继续播放中。',
  sample: sampleWindField,
  seed: WIND_FLOW_SEED,
  speedScale: 1.15,
  stepDegrees: 0.05,
  trailLength: WIND_FLOW_TRAIL_LENGTH,
  trailWidth: 1.05,
}

const WIND_FADE_ALPHAS = [0.92, 0.68, 0.43, 0.18] as const

function createOceanHeatmapTexture() {
  const width = 256
  const height = 192
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
      pixels[offset + 3] = Math.round(34 + value * 202)
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
        color: Cesium.Color.WHITE,
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
    return field.sample(particle.seed.longitude, particle.seed.latitude).speed
  }

  particle.trail.push([particle.longitude, particle.latitude])
  if (particle.trail.length > field.trailLength) {
    particle.trail.shift()
  }

  return vector.speed
}

function advanceWindParticle(particle: WindParticle, field: FlowFieldDefinition) {
  particle.remaining -= 1
  const speed = advanceParticle(particle, field)
  if (particle.remaining > 0) {
    return speed
  }

  resetWindParticle(particle, field)
  return field.sample(particle.seed.longitude, particle.seed.latitude).speed
}

function resetWindParticle(particle: WindParticle, field: FlowFieldDefinition) {
  particle.longitude = particle.seed.longitude
  particle.latitude = particle.seed.latitude
  particle.trail = seedTrail(particle.seed, field)
  particle.remaining = windParticleLifetime(particle.seed)
}

function windParticleLifetime(seed: FlowParticleSeed) {
  return Math.round(
    WIND_FLOW_TRAIL_LENGTH + seed.phase * (WIND_PARTICLE_MAX_AGE - WIND_FLOW_TRAIL_LENGTH),
  )
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

function createWindMaterial(color: string, alpha: number) {
  return new Cesium.Material({
    fabric: {
      type: 'PolylineGlow',
      uniforms: {
        color: Cesium.Color.fromCssColorString(color).withAlpha(alpha),
        glowPower: 0.16,
        taperPower: 0.48,
      },
    },
    translucent: true,
  })
}

function windFadeStep(remaining: number) {
  const normalized = Math.min(0.999_999, Math.max(0, 1 - remaining / WIND_PARTICLE_MAX_AGE))
  return Math.min(WIND_TRAIL_FADE_STEPS - 1, Math.floor(normalized * WIND_TRAIL_FADE_STEPS))
}

function buildOceanCurrentScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  viewer.scene.globe.enableLighting = false
  viewer.clock.shouldAnimate = false

  const field = OCEAN_FIELD
  const seeds = createFlowParticleSeeds(field.region, field.count, field.seed)
  const particles: FlowParticle[] = []
  const entities: Cesium.Entity[] = [createOceanHeatmapEntity(viewer)]

  for (const seed of seeds) {
    const vector = field.sample(seed.longitude, seed.latitude)
    const color = Cesium.Color.fromCssColorString(
      pickStableColor(vector.speed / field.speedScale, field.colors),
    ).withAlpha(0.9)
    const particle: FlowParticle = {
      latitude: seed.latitude,
      longitude: seed.longitude,
      seed,
      trail: seedTrail(seed, field),
    }
    particles.push(particle)

    entities.push(
      viewer.entities.add({
        id: `ocean-current-flow-${particles.length - 1}`,
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

  throwIfAborted(signal)
  framePositions(viewer, createFlowRegionPositions(field.region, field.height), 0, -66, 1.2)
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
    legend: field.legend,
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

function buildWindFieldScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  viewer.scene.globe.enableLighting = false
  viewer.clock.shouldAnimate = false

  const field = WIND_FIELD
  const seeds = createFlowParticleSeeds(field.region, field.count, field.seed)
  const collection = new Cesium.PolylineCollection()
  const materials: Cesium.Material[] = []
  const particles: WindParticle[] = []
  const polylines: Cesium.Polyline[] = []

  for (const seed of seeds) {
    const initialVector = field.sample(seed.longitude, seed.latitude)
    const particle: WindParticle = {
      colorIndex: pickStableColorIndex(initialVector.speed / field.speedScale, field.colors.length),
      fadeStep: 0,
      latitude: seed.latitude,
      longitude: seed.longitude,
      remaining: windParticleLifetime(seed),
      seed,
      trail: seedTrail(seed, field),
    }
    particles.push(particle)
    const material = createWindMaterial(
      field.colors[particle.colorIndex] ?? field.colors[0] ?? '#ffffff',
      WIND_FADE_ALPHAS[particle.fadeStep] ?? WIND_FADE_ALPHAS[0],
    )
    materials.push(material)

    const polyline = collection.add({
      positions: toPositions(particle.trail, field.height),
      width: field.trailWidth,
      material,
    })
    polylines.push(polyline)
  }

  viewer.scene.primitives.add(collection)
  throwIfAborted(signal)
  framePositions(viewer, createFlowRegionPositions(field.region, field.height), -10, -38, 1.25)
  setStatus(field.playingStatus)

  const animationState = ref<VisualizationAnimationState>('playing')
  let listening = false

  const tick = () => {
    if (animationState.value !== 'playing') {
      return
    }

    particles.forEach((particle, index) => {
      const speed = advanceWindParticle(particle, field)
      const colorIndex = pickStableColorIndex(speed / field.speedScale, field.colors.length)
      const fadeStep = windFadeStep(particle.remaining)
      const polyline = polylines[index]
      if (!polyline) {
        return
      }

      polyline.positions = toPositions(particle.trail, field.height)
      if (colorIndex !== particle.colorIndex || fadeStep !== particle.fadeStep) {
        particle.colorIndex = colorIndex
        particle.fadeStep = fadeStep
        const material = materials[index]
        if (material) {
          material.uniforms.color = Cesium.Color.fromCssColorString(
            field.colors[colorIndex] ?? field.colors[0] ?? '#ffffff',
          ).withAlpha(WIND_FADE_ALPHAS[fadeStep] ?? WIND_FADE_ALPHAS[0])
        }
      }
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
      viewer.scene.primitives.remove(collection)
      particles.length = 0
      polylines.length = 0
      materials.length = 0
    },
    legend: field.legend,
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
  return buildOceanCurrentScene(viewer, setStatus, signal)
}

export function createWindFieldScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  return buildWindFieldScene(viewer, setStatus, signal)
}
