import * as Cesium from 'cesium'

import {
  createOrbitOrientation,
  createSpecialShapeAnimation,
  loadTerrainWithoutBlocking,
  removeEntities,
  removePrimitives,
  throwIfAborted,
} from '@/demos/specialShapes/shared'
import type {
  CreateSpecialShapeSceneOptions,
  SpecialShapeScene,
  StatusReporter,
} from '@/demos/specialShapes/types'

const VIEWER_FRUSTUM_ORIGIN = Cesium.Cartesian3.fromDegrees(120, 30, 1_000)
const VIEWER_FRUSTUM_TARGET = Cesium.Cartesian3.fromDegrees(125, 30, 0)

export function createFrustumScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const frustum = new Cesium.PerspectiveFrustum({
    aspectRatio: 1.4,
    far: 5_000,
    fov: Cesium.Math.toRadians(30),
    near: 10,
  })
  const orientation = createOrbitOrientation(VIEWER_FRUSTUM_ORIGIN, VIEWER_FRUSTUM_TARGET)
  const fill = new Cesium.GeometryInstance({
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(1, 0, 0, 0.3)),
    },
    geometry: new Cesium.FrustumGeometry({
      frustum,
      orientation,
      origin: VIEWER_FRUSTUM_ORIGIN,
      vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
    }),
  })
  const outline = new Cesium.GeometryInstance({
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE),
    },
    geometry: new Cesium.FrustumOutlineGeometry({
      frustum,
      orientation,
      origin: VIEWER_FRUSTUM_ORIGIN,
    }),
  })
  const primitives = [
    new Cesium.Primitive({
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
        translucent: true,
      }),
      asynchronous: false,
      geometryInstances: [fill],
    }),
    new Cesium.Primitive({
      appearance: new Cesium.PerInstanceColorAppearance({
        closed: true,
        flat: true,
      }),
      asynchronous: false,
      geometryInstances: [outline],
    }),
  ]

  for (const primitive of primitives) {
    viewer.scene.primitives.add(primitive)
  }
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(120, 30, 3_000),
  })
  setStatus('红色半透明视锥体与白色轮廓线已生成')

  return {
    actions: [],
    dispose: () => removePrimitives(viewer, primitives),
  }
}

export function createManualFrustumScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  options: CreateSpecialShapeSceneOptions = {},
): SpecialShapeScene {
  throwIfAborted(options.signal)

  const points = {
    p1: { x: -90, y: 40, z: 0 },
    p2: { x: -90, y: 30, z: 0 },
    p3: { x: -100, y: 30, z: 0 },
    p4: { x: -100, y: 40, z: 0 },
    p5: { x: -95, y: 35, z: 2_000_000 },
  }
  const sides = [
    [points.p1, points.p2, points.p5],
    [points.p3, points.p2, points.p5],
    [points.p3, points.p4, points.p5],
    [points.p1, points.p4, points.p5],
  ]
  let offset = 0
  const entities = sides.map((side) =>
    viewer.entities.add({
      polygon: {
        hierarchy: new Cesium.CallbackProperty(
          () =>
            new Cesium.PolygonHierarchy(
              Cesium.Cartesian3.fromDegreesArrayHeights(
                side.flatMap((point) => [point.x + offset, point.y + offset, point.z]),
              ),
            ),
          false,
        ),
        material: Cesium.Color.CYAN.withAlpha(0.5),
        outline: true,
        outlineColor: Cesium.Color.BLACK,
        perPositionHeight: true,
      },
    }),
  )
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    offset = elapsedMs * 0.0005
  })

  viewer.camera.lookAt(
    Cesium.Cartesian3.fromDegrees(-95, 35, 1_000_000),
    new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 5_000_000),
  )
  setStatus('4 个青色视锥侧面持续移动播放中')
  loadTerrainWithoutBlocking(viewer, setStatus, options.signal)

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, entities)
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '视锥体移动已暂停' : '视锥体继续自动移动播放中')
    },
  }
}

export function createMovingFrustumScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const position = {
    latitude: 40.03883,
    longitude: -75.59777,
    height: 3_000,
  }
  const origin = Cesium.Cartesian3.fromDegrees(
    position.longitude,
    position.latitude,
    position.height,
  )
  const orientation = Cesium.Quaternion.fromHeadingPitchRoll(
    new Cesium.HeadingPitchRoll(0, 0, Cesium.Math.toRadians(135)),
  )
  const instance = new Cesium.GeometryInstance({
    attributes: {
      color: Cesium.ColorGeometryInstanceAttribute.fromColor(new Cesium.Color(1, 0, 0, 0.5)),
    },
    geometry: new Cesium.FrustumGeometry({
      frustum: new Cesium.PerspectiveFrustum({
        aspectRatio: 16 / 9,
        far: 2_000,
        fov: Cesium.Math.toRadians(45),
        near: 1,
      }),
      orientation,
      origin: Cesium.Cartesian3.ZERO,
      vertexFormat: Cesium.VertexFormat.POSITION_ONLY,
    }),
  })
  const primitive = new Cesium.Primitive({
    appearance: new Cesium.PerInstanceColorAppearance({
      closed: true,
      translucent: true,
    }),
    asynchronous: false,
    geometryInstances: [instance],
    modelMatrix: Cesium.Transforms.eastNorthUpToFixedFrame(origin),
  })
  const primitives = [primitive]

  viewer.scene.primitives.add(primitive)
  viewer.camera.lookAt(origin, new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 9_000))
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    const nextOrigin = Cesium.Cartesian3.fromDegrees(
      position.longitude,
      position.latitude + elapsedMs * 0.0000067,
      position.height,
    )
    primitive.modelMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(nextOrigin)
  })
  setStatus('航空视锥体沿航线持续移动播放中')

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removePrimitives(viewer, primitives)
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '视锥体移动已暂停' : '视锥体继续移动播放中')
    },
  }
}
