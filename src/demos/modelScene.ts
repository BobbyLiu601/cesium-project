import * as Cesium from 'cesium'

import cesiumAirUrl from '@/assets/models/cesium-air.glb?url'
import windTurbineUrl from '@/assets/models/wind-turbine.glb?url'
import type { ModelSceneId } from '@/data/layers'

export interface ModelAction {
  id: string
  label: string
  run: () => void | Promise<void>
}

export interface ModelScene {
  actions: ModelAction[]
  dispose: () => void
}

type StatusReporter = (message: string) => void

const INTERPOLATION_MODEL_SCALE = 18
// CesiumAir 未缩放包围盒约为 x [-12.87, 12.87]、z [-13.40, 8.00]。
// 缩放后模型长约 463，相机必须退到机尾之外并抬高，才能覆盖整机。
const INTERPOLATION_FOLLOW_OFFSET = new Cesium.Cartesian3(
  -50 * INTERPOLATION_MODEL_SCALE,
  0,
  25 * INTERPOLATION_MODEL_SCALE,
)
const WIND_TURBINE_TERRAIN_URL = 'https://data.mars3d.cn/terrain'
const TERRAIN_LOAD_TIMEOUT_MS = 12_000

// 坐标与高程取自参考站「2.4.8、风力发电机」示例。
const windTurbineReferencePositions = [
  { longitude: 112.227630577, latitude: 39.0613382363999, height: 1815 },
  { longitude: 112.229302206, latitude: 39.0579481036999, height: 1827 },
  { longitude: 112.226596341, latitude: 39.0584773033999, height: 1849 },
  { longitude: 112.22511174, latitude: 39.0574840383999, height: 1866 },
  { longitude: 112.225476722, latitude: 39.0550566812, height: 1866 },
  { longitude: 112.225643865, latitude: 39.0532631538, height: 1899 },
  { longitude: 112.229228645, latitude: 39.0525930380999, height: 1880 },
  { longitude: 112.224976033, latitude: 39.0502488098, height: 1926 },
  { longitude: 112.225661372999, latitude: 39.0484097539999, height: 1948 },
  { longitude: 112.229409737, latitude: 39.0474211486, height: 1910 },
  { longitude: 112.224894212, latitude: 39.0464248147999, height: 1983 },
  { longitude: 112.224022809, latitude: 39.0436919592999, height: 2036 },
  { longitude: 112.224492463, latitude: 39.0413040158, height: 2036 },
  { longitude: 112.223470676999, latitude: 39.0381470684, height: 2038 },
  { longitude: 112.220336836, latitude: 39.039450506, height: 2071 },
  { longitude: 112.221019662, latitude: 39.0367113260999, height: 2063 },
  { longitude: 112.221282611, latitude: 39.045567662, height: 2026 },
  { longitude: 112.221147308, latitude: 39.0439265946, height: 2048 },
  { longitude: 112.2216533, latitude: 39.041840792, height: 2056 },
  { longitude: 112.222813848, latitude: 39.0343489941, height: 2075 },
  { longitude: 112.225573092, latitude: 39.0307660108, height: 2015 },
  { longitude: 112.220069655, latitude: 39.0323883292, height: 2022 },
  { longitude: 112.217448043999, latitude: 39.0310627231, height: 2021 },
  { longitude: 112.230322327, latitude: 39.0281575923999, height: 1965 },
] as const

function requestRender(viewer: Cesium.Viewer) {
  viewer.scene.requestRender()
}

function headingPitchRoll(heading: number, pitch = 0, roll = 0) {
  return new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(heading),
    Cesium.Math.toRadians(pitch),
    Cesium.Math.toRadians(roll),
  )
}

function positionAndOrientation(
  longitude: number,
  latitude: number,
  height: number,
  heading: number,
) {
  const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    position,
    headingPitchRoll(heading),
  )
  return { position, orientation }
}

function framePositions(viewer: Cesium.Viewer, positions: Cesium.Cartesian3[], rangeFactor = 2.4) {
  if (positions.length === 0) {
    return
  }

  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(12),
      Cesium.Math.toRadians(-42),
      Math.max(1_000, sphere.radius * rangeFactor),
    ),
  )
}

function setModelSceneDefaults(viewer: Cesium.Viewer) {
  viewer.scene.globe.enableLighting = true
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07111f')
  viewer.clock.multiplier = 1
}

function createAnimationTicker(viewer: Cesium.Viewer) {
  const renderAnimatedFrame = () => {
    if (viewer.clock.shouldAnimate) {
      viewer.scene.requestRender()
    }
  }
  viewer.scene.preUpdate.addEventListener(renderAnimatedFrame)
  return () => viewer.scene.preUpdate.removeEventListener(renderAnimatedFrame)
}

async function loadWindTurbineTerrain(viewer: Cesium.Viewer) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  try {
    const terrainProvider = await Promise.race([
      Cesium.CesiumTerrainProvider.fromUrl(WIND_TURBINE_TERRAIN_URL),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error('参考站高程地形加载超时')),
          TERRAIN_LOAD_TIMEOUT_MS,
        )
      }),
    ])
    viewer.terrainProvider = terrainProvider
    viewer.scene.globe.depthTestAgainstTerrain = true
    return true
  } catch (error) {
    console.error('参考站高程地形加载失败，已回退椭球地形。', error)
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
    viewer.scene.globe.depthTestAgainstTerrain = false
    return false
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
  }
}

function createInterpolationScene(viewer: Cesium.Viewer, setStatus: StatusReporter): ModelScene {
  const start = Cesium.JulianDate.now()
  const stop = Cesium.JulianDate.addSeconds(start, 40, new Cesium.JulianDate())
  const sampledPosition = new Cesium.SampledPositionProperty()
  const waypoints = [
    [121.38, 31.18, 800],
    [121.42, 31.22, 1_200],
    [121.48, 31.19, 900],
    [121.52, 31.26, 1_500],
    [121.58, 31.23, 1_000],
  ] as const
  const routePositions = waypoints.map(([longitude, latitude, height]) =>
    Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
  )

  waypoints.forEach(([longitude, latitude, height], index) => {
    const time = Cesium.JulianDate.addSeconds(
      start,
      (index / (waypoints.length - 1)) * 40,
      new Cesium.JulianDate(),
    )
    sampledPosition.addSample(time, Cesium.Cartesian3.fromDegrees(longitude, latitude, height))
  })
  sampledPosition.setInterpolationOptions({
    interpolationDegree: 2,
    interpolationAlgorithm: Cesium.LagrangePolynomialApproximation,
  })

  viewer.clock.startTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  viewer.clock.currentTime = start.clone()
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  viewer.clock.multiplier = 3
  viewer.clock.shouldAnimate = false
  const stopAnimationTicker = createAnimationTicker(viewer)

  const routeEntity = viewer.entities.add({
    id: 'model-interpolation-route',
    name: '插值运动完整轨迹',
    polyline: {
      show: true,
      positions: routePositions,
      width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.16,
        color: Cesium.Color.fromCssColorString('#ffd166'),
      }),
    },
  })

  const entity = viewer.entities.add({
    id: 'model-interpolation-demo',
    name: '插值运动飞机',
    position: sampledPosition,
    orientation: new Cesium.VelocityOrientationProperty(sampledPosition),
    model: {
      uri: cesiumAirUrl,
      scale: INTERPOLATION_MODEL_SCALE,
      minimumPixelSize: 24,
      runAnimations: true,
    },
    path: {
      show: true,
      resolution: 2,
      width: 4,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.08,
        color: Cesium.Color.CYAN,
      }),
    },
  })

  let cameraFollowEnabled = false
  const applyCameraFollow = () => {
    const modelPosition = entity.position?.getValue(viewer.clock.currentTime)
    const modelOrientation = entity.orientation?.getValue(viewer.clock.currentTime)
    if (!modelPosition || !modelOrientation) {
      return false
    }

    const transform = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromQuaternion(modelOrientation),
      modelPosition,
    )
    viewer.camera.lookAtTransform(transform, INTERPOLATION_FOLLOW_OFFSET)
    return true
  }
  const followCamera = () => {
    if (cameraFollowEnabled) {
      applyCameraFollow()
    }
  }

  viewer.scene.preUpdate.addEventListener(followCamera)
  framePositions(viewer, routePositions, 2.2)
  setStatus('已生成 5 个采样点和二阶拉格朗日插值路径，完整运动轨迹已显示；可切换视角跟随')

  return {
    actions: [
      {
        id: 'toggle-camera-follow',
        label: '切换视角跟随',
        run() {
          cameraFollowEnabled = !cameraFollowEnabled
          if (cameraFollowEnabled) {
            applyCameraFollow()
            setStatus('已开启视角跟随（机外构图），相机将随插值运动模型移动')
          } else {
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
            framePositions(viewer, routePositions, 2.2)
            setStatus('已关闭视角跟随，已恢复完整轨迹视角')
          }
          requestRender(viewer)
        },
      },
      {
        id: 'start-interpolation',
        label: '开始',
        run() {
          viewer.clock.currentTime = start.clone()
          viewer.clock.shouldAnimate = true
          setStatus('插值运动已开始')
          requestRender(viewer)
        },
      },
      {
        id: 'pause-interpolation',
        label: '暂停',
        run() {
          viewer.clock.shouldAnimate = false
          setStatus('插值运动已暂停')
          requestRender(viewer)
        },
      },
      {
        id: 'resume-interpolation',
        label: '继续',
        run() {
          viewer.clock.shouldAnimate = true
          setStatus('插值运动已继续')
          requestRender(viewer)
        },
      },
      {
        id: 'reset-interpolation',
        label: '重置',
        run() {
          viewer.clock.currentTime = start.clone()
          viewer.clock.shouldAnimate = false
          if (cameraFollowEnabled) {
            applyCameraFollow()
          }
          setStatus('插值运动已重置到起点')
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.scene.preUpdate.removeEventListener(followCamera)
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      viewer.entities.remove(entity)
      viewer.entities.remove(routeEntity)
    },
  }
}

async function createWindTurbineScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const terrainLoaded = await loadWindTurbineTerrain(viewer)
  const entities = windTurbineReferencePositions.map(({ longitude, latitude, height }, index) => {
    const { position, orientation } = positionAndOrientation(longitude, latitude, height, 135)
    return viewer.entities.add({
      id: `wind-turbine-${index + 1}`,
      name: `风力发电机 ${index + 1}`,
      position,
      orientation,
      model: {
        uri: windTurbineUrl,
        scale: 8,
        runAnimations: true,
      },
    })
  })
  let animationsEnabled = true

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(112.245269, 39.066518, 2913),
    orientation: {
      heading: Cesium.Math.toRadians(226),
      pitch: Cesium.Math.toRadians(-21),
      roll: 0,
    },
  })
  viewer.clock.shouldAnimate = true
  const stopAnimationTicker = createAnimationTicker(viewer)
  setStatus(
    terrainLoaded
      ? '已加载参考站高程地形，并放置 24 台本地风力发电机，模型高程为 1815 至 2075 米'
      : '参考站高程地形加载失败，已回退椭球地形；24 台本地风力发电机仍按带高程的参考位置显示',
  )

  return {
    actions: [
      {
        id: 'toggle-wind-animations',
        label: '暂停/播放叶片动画',
        run() {
          animationsEnabled = !animationsEnabled
          viewer.clock.shouldAnimate = animationsEnabled
          entities.forEach((entity) => {
            if (entity.model) {
              ;(entity.model as unknown as { runAnimations: boolean }).runAnimations =
                animationsEnabled
            }
          })
          setStatus(`风力发电机叶片动画已${animationsEnabled ? '播放' : '暂停'}`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

export async function createModelScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  sceneId: ModelSceneId,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  void host
  setModelSceneDefaults(viewer)

  switch (sceneId) {
    case 'model-interpolation':
      return createInterpolationScene(viewer, setStatus)
    case 'wind-turbine':
      return createWindTurbineScene(viewer, setStatus)
  }
}
