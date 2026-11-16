import * as Cesium from 'cesium'

import buildingTrailImage from '@/assets/special-shapes/building-trail.png'
import fenceArrowImage from '@/assets/special-shapes/fence-arrow.png'
import fenceTrailImage from '@/assets/special-shapes/fence-trail.png'
import {
  createSpecialShapeAnimation,
  createTextureTrailMaterial,
  removeEntities,
} from '@/demos/specialShapes/shared'
import type { SpecialShapeScene, StatusReporter } from '@/demos/specialShapes/types'

const SOLID_WALL_MATERIAL_TYPE = 'SpecialShapeSolidWallTrail'
const VERTICAL_FENCE_MATERIAL_TYPE = 'SpecialShapeVerticalFenceTrail'
const RING_FENCE_MATERIAL_TYPE = 'SpecialShapeRingFenceTrail'

const SOLID_WALL_SHADER = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 st = materialInput.st;
  vec4 imageColor = texture(image, vec2(fract(st.s - time), st.t));
  material.diffuse = (imageColor.rgb + color.rgb) * 0.5;
  material.alpha = imageColor.a * color.a;
  material.emission = imageColor.rgb;
  return material;
}
`

const VERTICAL_FENCE_SHADER = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 st = materialInput.st;
  vec4 imageColor = texture(image, vec2(fract(st.s), fract(3.0 * st.t - time)));
  material.diffuse = imageColor.rgb + color.rgb;
  material.alpha = imageColor.a * color.a;
  material.emission = imageColor.rgb;
  return material;
}
`

const RING_FENCE_SHADER = `
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 st = materialInput.st;
  vec4 imageColor = texture(image, vec2(fract(23.0 * st.s + time), st.t));
  material.diffuse = imageColor.rgb + color.rgb;
  material.alpha = imageColor.a * color.a;
  material.emission = imageColor.rgb;
  return material;
}
`

export function createSolidWallScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  let animationElapsedMs = 0
  const material = createTextureTrailMaterial(
    {
      color: Cesium.Color.ORANGE,
      durationMs: 3_000,
      image: buildingTrailImage,
      source: SOLID_WALL_SHADER,
      type: SOLID_WALL_MATERIAL_TYPE,
    },
    () => animationElapsedMs,
  )
  const entity = viewer.entities.add({
    name: '动态立体墙',
    wall: {
      material,
      maximumHeights: [60, 60, 60, 60],
      minimumHeights: [10, 10, 10, 10],
      positions: Cesium.Cartesian3.fromDegreesArray([
        117.154815, 31.853495, 117.151215, 31.844734, 117.154457, 31.848152, 117.154815, 31.853495,
      ]),
    },
  })
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    animationElapsedMs = elapsedMs
  })

  void viewer.flyTo(entity, {
    duration: 0,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(90),
      Cesium.Math.toRadians(-35),
      1_400,
    ),
  })
  setStatus('橙色纹理沿立体墙持续流动播放中')

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, [entity])
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '立体墙纹理已暂停' : '立体墙纹理继续流动播放中')
    },
  }
}

const FENCE_POSITIONS = [
  104.0185546875, 30.66235300961486, 104.01589393615723, 30.65652022496456, 104.029541015625,
  30.65053940942565, 104.0397548675537, 30.65777541087788, 104.03829574584961, 30.66604446357028,
  104.0255069732666, 30.667963963897005, 104.0185546875, 30.66235300961486,
]

export function createElectronicFenceScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  return createFenceScene({
    color: Cesium.Color.CYAN,
    durationMs: 1_500,
    height: 500,
    image: fenceTrailImage,
    materialType: VERTICAL_FENCE_MATERIAL_TYPE,
    setStatus,
    shader: VERTICAL_FENCE_SHADER,
    status: '青色电子围栏向上流动播放中',
    pausedStatus: '电子围栏动画已暂停',
    resumedStatus: '电子围栏动画继续播放中',
    viewer,
  })
}

export function createElectronicFence2Scene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  return createFenceScene({
    color: Cesium.Color.YELLOW,
    durationMs: 1_500,
    height: 200,
    image: fenceArrowImage,
    materialType: RING_FENCE_MATERIAL_TYPE,
    setStatus,
    shader: RING_FENCE_SHADER,
    status: '黄色箭头纹理沿电子围栏循环播放中',
    pausedStatus: '电子围栏2动画已暂停',
    resumedStatus: '电子围栏2动画继续播放中',
    viewer,
  })
}

interface FenceSceneOptions {
  color: Cesium.Color
  durationMs: number
  height: number
  image: string
  materialType: string
  pausedStatus: string
  resumedStatus: string
  setStatus: StatusReporter
  shader: string
  status: string
  viewer: Cesium.Viewer
}

function createFenceScene({
  color,
  durationMs,
  height,
  image,
  materialType,
  pausedStatus,
  resumedStatus,
  setStatus,
  shader,
  status,
  viewer,
}: FenceSceneOptions): SpecialShapeScene {
  const positions = Cesium.Cartesian3.fromDegreesArray(FENCE_POSITIONS)
  let animationElapsedMs = 0
  const material = createTextureTrailMaterial(
    {
      color,
      durationMs,
      image,
      source: shader,
      type: materialType,
    },
    () => animationElapsedMs,
  )
  const entity = viewer.entities.add({
    name: materialType,
    wall: {
      material,
      maximumHeights: Array.from({ length: positions.length }, () => height),
      minimumHeights: Array.from({ length: positions.length }, () => 0),
      positions,
    },
  })
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    animationElapsedMs = elapsedMs
  })

  void viewer.flyTo(entity, { duration: 0 })
  setStatus(status)

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, [entity])
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? pausedStatus : resumedStatus)
    },
  }
}
