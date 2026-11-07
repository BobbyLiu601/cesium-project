import * as Cesium from 'cesium'
import type { Viewer } from 'cesium'

export const RADAR_SITE = {
  longitude: 113.32,
  latitude: 23.08,
} as const

export const RADAR_RADIUS_METERS = 3_500
export const RADAR_SWEEP_PERIOD_SECONDS = 8

const RADAR_COLOR = new Cesium.Color(0.16, 0.95, 0.82, 1)
const DOME_COLOR = new Cesium.Color(0.32, 0.7, 1, 1)

const GROUND_SWEEP_SHADER = `
uniform vec4 color;
uniform float time;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 position = materialInput.st * 2.0 - 1.0;
  float radius = length(position);
  float inside = 1.0 - smoothstep(0.94, 1.0, radius);

  float angle = atan(position.y, position.x);
  float angle01 = fract(angle / 6.283185307179586);
  float sweepPhase = fract(angle01 - time);
  float beam = smoothstep(0.94, 1.0, sweepPhase);

  float rings = 0.0;
  for (int index = 1; index <= 4; index++) {
    float ringRadius = float(index) * 0.22;
    rings += 1.0 - smoothstep(0.004, 0.012, abs(radius - ringRadius));
  }

  float wave = smoothstep(0.9, 0.99, fract(radius * 2.0 - time * 2.0)) * inside;
  float glow = 1.0 - smoothstep(0.0, 0.16, radius);

  material.diffuse = mix(color.rgb, vec3(1.0), beam * 0.55);
  material.alpha = inside * color.a *
    (0.1 + beam * 0.72 + rings * 0.28 + wave * 0.22 + glow * 0.38);
  return material;
}
`

const DOME_SWEEP_SHADER = `
uniform vec4 color;
uniform float time;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);
  float azimuth = fract(0.5 - materialInput.st.x);
  float cone = (1.0 - materialInput.st.y) * 3.141592653589793;
  float cone01 = cone / 1.5707963267948966;

  float sweepPhase = fract(azimuth - time);
  float beam = smoothstep(0.92, 1.0, sweepPhase);

  float ringDistance = abs(fract(cone01 * 6.0 + 0.5) - 0.5);
  float rings = 1.0 - smoothstep(0.0, 0.035, ringDistance);

  float meridianDistance = abs(fract(azimuth * 24.0 + 0.5) - 0.5);
  float meridians = 1.0 - smoothstep(0.0, 0.018, meridianDistance);

  float verticalFade =
    smoothstep(0.0, 0.12, cone01) *
    (1.0 - smoothstep(0.92, 1.0, cone01));

  material.diffuse = mix(color.rgb, vec3(0.72, 0.95, 1.0), beam * 0.62);
  material.alpha = color.a * verticalFade *
    (0.075 + rings * 0.17 + meridians * 0.13 + beam * 0.55);
  return material;
}
`

export interface RadarEffect {
  destroy: () => void
}

interface AddableCollection {
  add: (primitive: Cesium.GroundPrimitive | Cesium.Primitive) => unknown
  remove: (primitive: Cesium.GroundPrimitive | Cesium.Primitive) => unknown
}

function addGroundSweep(
  viewer: Viewer,
  material: Cesium.Material,
  radius: number,
  allowGroundPrimitive: boolean,
): Cesium.GroundPrimitive | Cesium.Primitive {
  const center = Cesium.Cartesian3.fromDegrees(RADAR_SITE.longitude, RADAR_SITE.latitude)
  const vertexFormat = Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat

  let supportsMaterials = false
  if (allowGroundPrimitive) {
    try {
      supportsMaterials = Cesium.GroundPrimitive.supportsMaterials(viewer.scene)
    } catch {
      supportsMaterials = false
    }
  }

  if (supportsMaterials) {
    try {
      const groundPrimitive = new Cesium.GroundPrimitive({
        geometryInstances: new Cesium.GeometryInstance({
          geometry: new Cesium.EllipseGeometry({
            center,
            semiMajorAxis: radius,
            semiMinorAxis: radius,
            vertexFormat,
          }),
        }),
        appearance: new Cesium.MaterialAppearance({
          material,
          translucent: true,
          closed: false,
        }),
        classificationType: Cesium.ClassificationType.TERRAIN,
        asynchronous: false,
      })

      viewer.scene.primitives.add(groundPrimitive)
      return groundPrimitive
    } catch (error) {
      console.error('雷达贴地扫描盘创建失败，已降级为固定高度扫描盘', error)
    }
  }

  const fallback = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.EllipseGeometry({
        center,
        semiMajorAxis: radius,
        semiMinorAxis: radius,
        height: 24,
        vertexFormat,
      }),
    }),
    appearance: new Cesium.MaterialAppearance({
      material,
      translucent: true,
      closed: false,
    }),
    asynchronous: false,
  })

  viewer.scene.primitives.add(fallback)
  return fallback
}

function addDomeSweep(viewer: Viewer, material: Cesium.Material, radius: number): Cesium.Primitive {
  const origin = Cesium.Cartesian3.fromDegrees(RADAR_SITE.longitude, RADAR_SITE.latitude, 24)
  const height = Math.round(radius * 0.58)
  const shellThickness = 28
  const vertexFormat = Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat

  const dome = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.EllipsoidGeometry({
        radii: new Cesium.Cartesian3(radius, radius, height),
        innerRadii: new Cesium.Cartesian3(
          radius - shellThickness,
          radius - shellThickness,
          height - shellThickness,
        ),
        minimumClock: 0,
        maximumClock: Cesium.Math.TWO_PI,
        minimumCone: 0,
        maximumCone: Cesium.Math.PI_OVER_TWO,
        stackPartitions: 48,
        slicePartitions: 64,
        vertexFormat,
      }),
    }),
    appearance: new Cesium.MaterialAppearance({
      material,
      translucent: true,
      closed: false,
      faceForward: true,
    }),
    modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(origin),
    asynchronous: false,
  })

  viewer.scene.primitives.add(dome)
  return dome
}

export async function createRadarEffect(
  viewer: Viewer,
  shouldAbort: () => boolean = () => false,
): Promise<RadarEffect> {
  const groundMaterial = new Cesium.Material({
    fabric: {
      type: 'RadarGroundSweep',
      uniforms: {
        color: RADAR_COLOR,
        time: 0,
      },
      source: GROUND_SWEEP_SHADER,
    },
    translucent: true,
  })
  const domeMaterial = new Cesium.Material({
    fabric: {
      type: 'RadarDomeSweep',
      uniforms: {
        color: DOME_COLOR,
        time: 0,
      },
      source: DOME_SWEEP_SHADER,
    },
    translucent: true,
  })

  let terrainHeightsReady = true
  try {
    await Cesium.GroundPrimitive.initializeTerrainHeights()
  } catch (error) {
    terrainHeightsReady = false
    console.error('雷达地形高度初始化失败，已降级为固定高度扫描盘', error)
  }

  if (shouldAbort()) {
    return { destroy: () => {} }
  }

  const ground = addGroundSweep(viewer, groundMaterial, RADAR_RADIUS_METERS, terrainHeightsReady)
  const dome = addDomeSweep(viewer, domeMaterial, RADAR_RADIUS_METERS)
  const primitives = viewer.scene.primitives as unknown as AddableCollection

  const startedAt = performance.now()
  let frameId: number | undefined

  function tick() {
    const elapsedSeconds = (performance.now() - startedAt) / 1000
    const phase = (elapsedSeconds % RADAR_SWEEP_PERIOD_SECONDS) / RADAR_SWEEP_PERIOD_SECONDS

    groundMaterial.uniforms.time = phase
    domeMaterial.uniforms.time = phase
    viewer.scene.requestRender()
    frameId = requestAnimationFrame(tick)
  }

  frameId = requestAnimationFrame(tick)

  return {
    destroy() {
      if (frameId !== undefined) {
        cancelAnimationFrame(frameId)
        frameId = undefined
      }

      primitives.remove(ground)
      primitives.remove(dome)
    },
  }
}
