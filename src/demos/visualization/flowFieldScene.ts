import * as Cesium from 'cesium'
import { ref } from 'vue'

import {
  createFlowParticleSeeds,
  OCEAN_FLOW_SEED,
  OCEAN_FLOW_TRAIL_LENGTH,
  OCEAN_PARTICLE_COUNT,
  oceanCurrentColors,
  oceanFlowRegion,
  pickStableColorIndex,
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
  VisualizationLegend,
  VisualizationScene,
} from '@/demos/visualization/types'

interface FlowFieldDefinition {
  colors: readonly string[]
  count: number
  headingDegrees: number
  height: number
  legend: VisualizationLegend
  lineOpacity: number
  pausedStatus: string
  pitchDegrees: number
  playingStatus: string
  pulseRepeats: number
  pulseSpeed: number
  rangeFactor: number
  region: FlowRegion
  resumedStatus: string
  sample: (longitude: number, latitude: number) => FlowVector
  seed: number
  showOceanHeatmap: boolean
  speedScale: number
  stepDegrees: number
  trailLength: number
  trailWidth: number
}

interface FlowTrail {
  averageSpeed: number
  points: Array<[longitude: number, latitude: number]>
}

interface FlowBucket {
  colorIndex: number
  phaseIndex: number
  positions: Cesium.Cartesian3[][]
}

interface FlowMaterialUniforms {
  animationTime: number
  color: Cesium.Color
  phaseOffset: number
  pulseRepeats: number
  pulseSpeed: number
}

const FLOW_PHASE_BUCKETS = 4
const FLOW_PULSE_SHADER = `
uniform vec4 color;
uniform float animationTime;
uniform float phaseOffset;
uniform float pulseRepeats;
uniform float pulseSpeed;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
    czm_material material = czm_getDefaultMaterial(materialInput);
    float phase = fract(
        materialInput.st.s * pulseRepeats
        - animationTime * pulseSpeed
        + phaseOffset
    );
    float leadingEdge = smoothstep(0.0, 0.08, phase);
    float trailingEdge = 1.0 - smoothstep(0.28, 0.52, phase);
    float pulse = leadingEdge * trailingEdge;
    vec3 rgb = mix(color.rgb, vec3(1.0), pulse * 0.22);
    float alpha = color.a * (0.2 + 0.8 * pulse);
    vec4 lineColor = czm_gammaCorrect(vec4(rgb, alpha));

    material.emission = lineColor.rgb;
    material.alpha = lineColor.a;
    return material;
}
`

const OCEAN_FIELD: FlowFieldDefinition = {
  colors: oceanCurrentColors,
  count: OCEAN_PARTICLE_COUNT,
  headingDegrees: 0,
  height: 620,
  legend: {
    colors: oceanCurrentColors,
    maximumLabel: '高流速',
    minimumLabel: '低流速',
    title: '海流速度',
  },
  lineOpacity: 0.9,
  pausedStatus: '海流速度热力图动画已暂停，可查看当前流向与流速。',
  pitchDegrees: -66,
  playingStatus: `海流速度热力图已就绪，${OCEAN_PARTICLE_COUNT} 条确定性流线正在东亚至西太平洋循环。`,
  pulseRepeats: 1,
  pulseSpeed: 0.18,
  rangeFactor: 1.2,
  region: oceanFlowRegion,
  resumedStatus: '海流速度热力图继续播放中。',
  sample: sampleOceanCurrent,
  seed: OCEAN_FLOW_SEED,
  showOceanHeatmap: true,
  speedScale: 1.35,
  stepDegrees: 0.06,
  trailLength: OCEAN_FLOW_TRAIL_LENGTH,
  trailWidth: 1.45,
}

const WIND_FIELD: FlowFieldDefinition = {
  colors: windFieldColors,
  count: WIND_PARTICLE_COUNT,
  headingDegrees: -10,
  height: 1200,
  legend: {
    colors: windFieldColors,
    maximumLabel: '高风速',
    minimumLabel: '低风速',
    title: '风速',
  },
  lineOpacity: 0.84,
  pausedStatus: '风粒子动画已暂停，可查看当前风速色带与长尾轨迹。',
  pitchDegrees: -38,
  playingStatus: `风粒子场已就绪，${WIND_PARTICLE_COUNT} 条带渐隐拖尾的确定性粒子正在中国及周边区域循环。`,
  pulseRepeats: 1,
  pulseSpeed: 0.26,
  rangeFactor: 1.25,
  region: windFlowRegion,
  resumedStatus: '风粒子动画继续播放中。',
  sample: sampleWindField,
  seed: WIND_FLOW_SEED,
  showOceanHeatmap: false,
  speedScale: 1.15,
  stepDegrees: 0.075,
  trailLength: WIND_FLOW_TRAIL_LENGTH,
  trailWidth: 1.05,
}

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

function isInsideRegion(region: FlowRegion, longitude: number, latitude: number) {
  return (
    longitude >= region.west &&
    longitude <= region.east &&
    latitude >= region.south &&
    latitude <= region.north
  )
}

function buildFlowTrail(seed: FlowParticleSeed, field: FlowFieldDefinition): FlowTrail {
  const upstream: Array<[longitude: number, latitude: number]> = []
  const upstreamSteps = Math.floor((field.trailLength - 1) / 2)
  const downstreamSteps = field.trailLength - 1 - upstreamSteps
  let totalSpeed = 0
  let sampleCount = 0
  let longitude = seed.longitude
  let latitude = seed.latitude

  for (let index = 0; index < upstreamSteps; index += 1) {
    const vector = field.sample(longitude, latitude)
    totalSpeed += vector.speed
    sampleCount += 1
    longitude -= vector.eastward * field.stepDegrees
    latitude -= vector.northward * field.stepDegrees
    if (!isInsideRegion(field.region, longitude, latitude)) {
      break
    }
    upstream.push([longitude, latitude])
  }

  upstream.reverse()
  const points: Array<[longitude: number, latitude: number]> = [
    ...upstream,
    [seed.longitude, seed.latitude],
  ]
  longitude = seed.longitude
  latitude = seed.latitude

  for (let index = 0; index < downstreamSteps; index += 1) {
    const vector = field.sample(longitude, latitude)
    totalSpeed += vector.speed
    sampleCount += 1
    longitude += vector.eastward * field.stepDegrees
    latitude += vector.northward * field.stepDegrees
    if (!isInsideRegion(field.region, longitude, latitude)) {
      break
    }
    points.push([longitude, latitude])
  }

  return {
    averageSpeed: totalSpeed / Math.max(1, sampleCount),
    points,
  }
}

function toPositions(points: ReadonlyArray<[longitude: number, latitude: number]>, height: number) {
  const values: number[] = []

  for (const [longitude, latitude] of points) {
    values.push(longitude, latitude, height)
  }

  return Cesium.Cartesian3.fromDegreesArrayHeights(values)
}

function createFlowRegionPositions(region: FlowRegion, height: number) {
  return [
    Cesium.Cartesian3.fromDegrees(region.west, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.north, height),
    Cesium.Cartesian3.fromDegrees(region.west, region.north, height),
  ]
}

function createFlowMaterial(uniforms: FlowMaterialUniforms) {
  const material = new Cesium.Material({
    fabric: {
      type: 'FlowPulse',
      uniforms,
      source: FLOW_PULSE_SHADER,
    },
    translucent: true,
  })
  // Each polyline owns its material for safe teardown; the shared uniforms keep batching and updates cheap.
  material.uniforms = uniforms
  return material
}

function createFlowCollections(viewer: Cesium.Viewer, field: FlowFieldDefinition) {
  const seeds = createFlowParticleSeeds(field.region, field.count, field.seed)
  const buckets = new Map<string, FlowBucket>()

  for (const seed of seeds) {
    const trail = buildFlowTrail(seed, field)
    const colorIndex = pickStableColorIndex(
      trail.averageSpeed / field.speedScale,
      field.colors.length,
    )
    const phaseIndex = Math.min(FLOW_PHASE_BUCKETS - 1, Math.floor(seed.phase * FLOW_PHASE_BUCKETS))
    const key = `${colorIndex}:${phaseIndex}`
    const bucket = buckets.get(key) ?? { colorIndex, phaseIndex, positions: [] }
    bucket.positions.push(toPositions(trail.points, field.height))
    buckets.set(key, bucket)
  }

  const collections: Cesium.PolylineCollection[] = []
  const uniformGroups: FlowMaterialUniforms[] = []

  for (const bucket of buckets.values()) {
    const collection = new Cesium.PolylineCollection()
    const uniforms: FlowMaterialUniforms = {
      animationTime: 0,
      color: Cesium.Color.fromCssColorString(
        field.colors[bucket.colorIndex] ?? field.colors[0] ?? '#ffffff',
      ).withAlpha(field.lineOpacity),
      phaseOffset: bucket.phaseIndex / FLOW_PHASE_BUCKETS,
      pulseRepeats: field.pulseRepeats,
      pulseSpeed: field.pulseSpeed,
    }
    uniformGroups.push(uniforms)

    for (const positions of bucket.positions) {
      collection.add({
        material: createFlowMaterial(uniforms),
        positions,
        width: field.trailWidth,
      })
    }

    viewer.scene.primitives.add(collection)
    collections.push(collection)
  }

  return { collections, uniformGroups }
}

function buildAnimatedFlowScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  field: FlowFieldDefinition,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  viewer.scene.globe.enableLighting = false
  viewer.clock.shouldAnimate = false

  const entities = field.showOceanHeatmap ? [createOceanHeatmapEntity(viewer)] : []
  const { collections, uniformGroups } = createFlowCollections(viewer, field)

  throwIfAborted(signal)
  framePositions(
    viewer,
    createFlowRegionPositions(field.region, field.height),
    field.headingDegrees,
    field.pitchDegrees,
    field.rangeFactor,
  )
  setStatus(field.playingStatus)

  const animationState = ref<VisualizationAnimationState>('playing')
  let listening = false
  let animationTime = 0
  let lastTickTime = performance.now()

  const tick = () => {
    if (animationState.value !== 'playing') {
      return
    }

    const now = performance.now()
    animationTime += Math.min(0.05, Math.max(0, (now - lastTickTime) / 1000))
    lastTickTime = now
    for (const uniforms of uniformGroups) {
      uniforms.animationTime = animationTime
    }
    viewer.scene.requestRender()
  }

  const startListening = () => {
    if (listening) {
      return
    }

    listening = true
    lastTickTime = performance.now()
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
      for (const collection of collections) {
        viewer.scene.primitives.remove(collection)
      }
      collections.length = 0
      uniformGroups.length = 0
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

export function createOceanCurrentScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  return buildAnimatedFlowScene(viewer, setStatus, OCEAN_FIELD, signal)
}

export function createWindFieldScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  return buildAnimatedFlowScene(viewer, setStatus, WIND_FIELD, signal)
}
