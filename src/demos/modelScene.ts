import * as Cesium from 'cesium'

import cesiumAirUrl from '@/assets/models/cesium-air.glb?url'
import cesiumManUrl from '@/assets/models/cesium-man.glb?url'
import cityBlockUrl from '@/assets/models/city-block.glb?url'
import massModelUrl from '@/assets/models/mass-model.glb?url'
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

async function createLoadModelScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const { position, orientation } = positionAndOrientation(116.391, 39.907, 300, 90)
  const entity = viewer.entities.add({
    id: 'model-load-demo',
    name: 'Entity 模型',
    position,
    orientation,
    model: {
      uri: cesiumAirUrl,
      scale: 10,
      minimumPixelSize: 32,
      color: Cesium.Color.fromCssColorString('rgba(254, 129, 6, 0.65)'),
      silhouetteColor: Cesium.Color.fromCssColorString('#001aff'),
      silhouetteSize: 4,
      colorBlendMode: Cesium.ColorBlendMode.MIX,
      colorBlendAmount: 0.25,
      runAnimations: true,
      shadows: Cesium.ShadowMode.CAST_ONLY,
    },
  })
  let animationsEnabled = true
  viewer.clock.shouldAnimate = true
  const stopAnimationTicker = createAnimationTicker(viewer)

  await viewer.flyTo(entity)
  setStatus('Entity 已加载本地飞机模型，并启用轮廓、颜色混合、阴影和内置动画')

  return {
    actions: [
      {
        id: 'toggle-model-animation',
        label: '暂停/播放动画',
        run() {
          if (entity.model) {
            ;(entity.model as unknown as { runAnimations: boolean }).runAnimations =
              !animationsEnabled
          }
          animationsEnabled = !animationsEnabled
          viewer.clock.shouldAnimate = animationsEnabled
          setStatus(`模型内置动画已${animationsEnabled ? '播放' : '暂停'}`)
          requestRender(viewer)
        },
      },
      {
        id: 'focus-load-model',
        label: '重新聚焦模型',
        async run() {
          await viewer.flyTo(entity)
          setStatus('已重新聚焦 Entity 模型')
        },
      },
    ],
    dispose() {
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      viewer.entities.remove(entity)
    },
  }
}

async function createPrimitiveModelScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const origin = Cesium.Cartesian3.fromDegrees(116.391, 39.907, 200)
  const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(origin, headingPitchRoll(90))
  const model = await Cesium.Model.fromGltfAsync({
    url: cesiumManUrl,
    modelMatrix,
    scale: 20,
    allowPicking: false,
    enablePick: false,
    silhouetteColor: Cesium.Color.fromCssColorString('rgba(254, 129, 6, 0.65)'),
    silhouetteSize: 3,
  })
  viewer.scene.primitives.add(model)
  viewer.camera.lookAtTransform(modelMatrix, new Cesium.Cartesian3(-40, 0, 35))
  viewer.clock.shouldAnimate = true
  const stopAnimationTicker = createAnimationTicker(viewer)
  model.activeAnimations.addAll({
    loop: Cesium.ModelAnimationLoop.REPEAT,
    multiplier: 0.5,
    reverse: true,
  })
  setStatus('Primitive 已加载本地带动画模型，模型就绪后启用轮廓和循环动画')

  return {
    actions: [
      {
        id: 'toggle-primitive-animation',
        label: '暂停/播放内置动画',
        run() {
          const playing = model.activeAnimations.length > 0
          if (playing) {
            model.activeAnimations.removeAll()
          } else {
            model.activeAnimations.addAll({
              loop: Cesium.ModelAnimationLoop.REPEAT,
              multiplier: 0.5,
              reverse: true,
            })
          }
          viewer.clock.shouldAnimate = !playing
          setStatus(`Primitive 内置动画已${playing ? '暂停' : '播放'}`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      viewer.scene.primitives.remove(model)
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    },
  }
}

async function createMassModelScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const count = typeof window !== 'undefined' && window.innerWidth < 768 ? 300 : 1_000
  const positions: Cesium.Cartesian3[] = []
  const models: Cesium.Model[] = []
  let seed = 20261111
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return seed / 4_294_967_296
  }

  for (let index = 0; index < count; index += 1) {
    const origin = Cesium.Cartesian3.fromDegrees(
      -170 + random() * 340,
      -55 + random() * 110,
      60_000 + random() * 160_000,
    )
    positions.push(origin)
  }

  const batchSize = 32
  for (let start = 0; start < positions.length; start += batchSize) {
    const batch = await Promise.all(
      positions.slice(start, start + batchSize).map((origin) =>
        Cesium.Model.fromGltfAsync({
          url: massModelUrl,
          modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(origin),
          scale: 300_000,
          allowPicking: false,
          enablePick: false,
        }),
      ),
    )
    models.push(...batch)
  }

  models.forEach((model) => viewer.scene.primitives.add(model))
  framePositions(viewer, positions, 1.35)
  setStatus(
    `已加载 ${count.toLocaleString('zh-CN')} 个 Primitive 模型（${count === 300 ? '移动端降载' : '桌面端'}）`,
  )

  return {
    actions: [
      {
        id: 'focus-mass-models',
        label: '查看全部模型',
        run() {
          framePositions(viewer, positions, 1.35)
          requestRender(viewer)
          setStatus(`当前场景共 ${count.toLocaleString('zh-CN')} 个 Primitive 模型`)
        },
      },
    ],
    dispose() {
      models.forEach((model) => viewer.scene.primitives.remove(model))
    },
  }
}

async function createModelMotionScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const start = Cesium.JulianDate.now()
  const firstWaypoint = Cesium.JulianDate.addSeconds(start, 15, new Cesium.JulianDate())
  const secondWaypoint = Cesium.JulianDate.addSeconds(start, 30, new Cesium.JulianDate())
  const stop = Cesium.JulianDate.addSeconds(start, 60, new Cesium.JulianDate())
  const sampledPosition = new Cesium.SampledPositionProperty()
  sampledPosition.addSample(start, Cesium.Cartesian3.fromDegrees(112.4853, 18.6073, 10_000))
  sampledPosition.addSample(firstWaypoint, Cesium.Cartesian3.fromDegrees(112.36, 18.75, 80_000))
  sampledPosition.addSample(secondWaypoint, Cesium.Cartesian3.fromDegrees(112.12, 18.9, 130_000))
  sampledPosition.addSample(stop, Cesium.Cartesian3.fromDegrees(111.88, 18.97, 90_000))

  viewer.clock.startTime = start.clone()
  viewer.clock.stopTime = stop.clone()
  viewer.clock.currentTime = start.clone()
  viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
  viewer.clock.multiplier = 4
  viewer.clock.shouldAnimate = true
  const stopAnimationTicker = createAnimationTicker(viewer)

  const entity = viewer.entities.add({
    id: 'model-motion-demo',
    name: '沿路径运动的飞机',
    availability: new Cesium.TimeIntervalCollection([new Cesium.TimeInterval({ start, stop })]),
    position: sampledPosition,
    orientation: new Cesium.VelocityOrientationProperty(sampledPosition),
    model: {
      uri: cesiumAirUrl,
      scale: 30,
      minimumPixelSize: 24,
      silhouetteSize: 4,
      silhouetteColor: Cesium.Color.fromCssColorString('#001aff'),
      runAnimations: true,
    },
    path: {
      show: true,
      resolution: 1,
      width: 5,
      material: new Cesium.PolylineGlowMaterialProperty({
        glowPower: 0.12,
        color: Cesium.Color.PINK,
      }),
    },
  })

  let firstPerson = true
  const followModel = () => {
    if (!firstPerson) {
      return
    }

    const modelPosition = entity.position?.getValue(viewer.clock.currentTime)
    const modelOrientation = entity.orientation?.getValue(viewer.clock.currentTime)
    if (!modelPosition || !modelOrientation) {
      return
    }

    const transform = Cesium.Matrix4.fromRotationTranslation(
      Cesium.Matrix3.fromQuaternion(modelOrientation),
      modelPosition,
    )
    viewer.camera.lookAtTransform(transform, new Cesium.Cartesian3(-20, 0, 30))
  }
  viewer.scene.preUpdate.addEventListener(followModel)
  await viewer.flyTo(entity)
  setStatus('模型正在沿采样路径运动，轨迹已显示，相机保持第一人称跟随')

  return {
    actions: [
      {
        id: 'toggle-first-person',
        label: '切换第一人称跟随',
        run() {
          firstPerson = !firstPerson
          if (!firstPerson) {
            viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
          }
          setStatus(firstPerson ? '已启用第一人称跟随' : '已切换为自由视角')
          requestRender(viewer)
        },
      },
      {
        id: 'toggle-model-motion',
        label: '暂停/继续运动',
        run() {
          viewer.clock.shouldAnimate = !viewer.clock.shouldAnimate
          setStatus(`模型运动已${viewer.clock.shouldAnimate ? '继续' : '暂停'}`)
          requestRender(viewer)
        },
      },
      {
        id: 'restart-model-motion',
        label: '重新开始',
        run() {
          viewer.clock.currentTime = start.clone()
          viewer.clock.shouldAnimate = true
          setStatus('模型运动已回到起点')
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.scene.preUpdate.removeEventListener(followModel)
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
      viewer.entities.remove(entity)
    },
  }
}

async function createInterpolationScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
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

  const entity = viewer.entities.add({
    id: 'model-interpolation-demo',
    name: '插值运动飞机',
    position: sampledPosition,
    orientation: new Cesium.VelocityOrientationProperty(sampledPosition),
    model: {
      uri: cesiumAirUrl,
      scale: 18,
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
  await viewer.flyTo(entity)
  setStatus('已生成 5 个采样点和二阶拉格朗日插值路径，等待开始运动')

  return {
    actions: [
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
          setStatus('插值运动已重置到起点')
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      stopAnimationTicker()
      viewer.clock.shouldAnimate = false
      viewer.entities.remove(entity)
    },
  }
}

async function createPickChildNodeScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const origin = Cesium.Cartesian3.fromDegrees(121.507762, 31.233975, 500)
  const modelMatrix = Cesium.Transforms.headingPitchRollToFixedFrame(origin, headingPitchRoll(215))
  const model = await Cesium.Model.fromGltfAsync({
    url: cesiumAirUrl,
    modelMatrix,
    scale: 35,
    allowPicking: true,
    enablePick: true,
    id: 'pick-child-node-model',
  })
  viewer.scene.primitives.add(model)
  viewer.camera.lookAtTransform(modelMatrix, new Cesium.Cartesian3(-70, 0, 45))

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = viewer.scene.pick(movement.position) as
      | {
          detail?: { node?: { _name?: string; node?: { name?: string } } }
          node?: { _name?: string }
          id?: string | { id?: string; name?: string }
        }
      | undefined
    if (!picked) {
      setStatus('未拾取到模型，请点击模型表面')
      return
    }
    const id = picked?.id
    const nodeName =
      picked?.detail?.node?._name ??
      picked?.detail?.node?.node?.name ??
      picked?.node?._name ??
      (typeof id === 'string' ? id : (id?.name ?? id?.id)) ??
      '模型主体'
    setStatus(`已选择模型子节点：${nodeName}`)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  setStatus('点击模型任意子节点，状态区会显示拾取到的节点名称')

  return {
    actions: [
      {
        id: 'focus-pick-model',
        label: '重新聚焦模型',
        run() {
          viewer.camera.lookAtTransform(modelMatrix, new Cesium.Cartesian3(-70, 0, 45))
          requestRender(viewer)
          setStatus('已重新聚焦可拾取子节点的模型')
        },
      },
    ],
    dispose() {
      handler.destroy()
      viewer.scene.primitives.remove(model)
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY)
    },
  }
}

async function createManualModelScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const { position, orientation } = positionAndOrientation(121.507762, 31.233975, 200, 215)
  const entity = viewer.entities.add({
    id: 'manual-city-model',
    name: '上海城市人工模型',
    position,
    orientation,
    model: {
      uri: cityBlockUrl,
      scale: 1,
      silhouetteSize: 1.5,
      silhouetteColor: Cesium.Color.fromCssColorString('#4f8df7'),
      shadows: Cesium.ShadowMode.ENABLED,
    },
  })
  let silhouetteEnabled = true

  await viewer.flyTo(entity)
  setStatus('已加载项目自制的上海城市人工模型并自动定位')

  return {
    actions: [
      {
        id: 'toggle-city-silhouette',
        label: '切换模型轮廓',
        run() {
          if (!entity.model) {
            return
          }
          silhouetteEnabled = !silhouetteEnabled
          ;(entity.model as unknown as { silhouetteSize: number }).silhouetteSize =
            silhouetteEnabled ? 1.5 : 0
          setStatus(`城市模型轮廓已${silhouetteEnabled ? '开启' : '关闭'}`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.entities.remove(entity)
    },
  }
}

async function createWindTurbineScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<ModelScene> {
  const positions = [
    [112.227630577, 39.0613382363999, 1815],
    [112.229302206, 39.0579481036999, 1827],
    [112.226596341, 39.0584773033999, 1849],
    [112.22511174, 39.0574840383999, 1866],
    [112.225476722, 39.0550566812, 1866],
  ] as const
  const entities = positions.map(([longitude, latitude, height], index) => {
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

  viewer.clock.shouldAnimate = true
  const stopAnimationTicker = createAnimationTicker(viewer)
  framePositions(
    viewer,
    entities.flatMap((entity) => entity.position?.getValue(viewer.clock.currentTime) ?? []),
    2.2,
  )
  setStatus('已加载 5 台本地风力发电机，叶片动画与 Viewer 时钟同步')

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
    case 'load-model':
      return createLoadModelScene(viewer, setStatus)
    case 'primitive-model':
      return createPrimitiveModelScene(viewer, setStatus)
    case 'mass-models':
      return createMassModelScene(viewer, setStatus)
    case 'model-motion':
      return createModelMotionScene(viewer, setStatus)
    case 'model-interpolation':
      return createInterpolationScene(viewer, setStatus)
    case 'pick-child-node':
      return createPickChildNodeScene(viewer, setStatus)
    case 'manual-model':
      return createManualModelScene(viewer, setStatus)
    case 'wind-turbine':
      return createWindTurbineScene(viewer, setStatus)
  }
}
