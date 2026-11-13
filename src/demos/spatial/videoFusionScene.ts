import * as Cesium from 'cesium'

import {
  createContinuousRenderTicker,
  framePositions,
  getPublicAssetUrl,
} from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter } from '@/demos/spatial/types'
import {
  createVideoFusionPlayback,
  type VideoFusionPlayback,
} from '@/demos/spatial/videoFusionPlayback'

const LOCAL_VIDEO_PATH = 'spatial-analysis/video-fusion/sheboygan-falls-drone.mp4'
const VIDEO_ATTRIBUTION = '航拍视频：WLUK-TV FOX 11 · Wikimedia Commons · CC BY 3.0'
const FACADE_POSITIONS = [
  114.25985245208585, 30.5752892693654, 14.23, 114.25923491594841, 30.5752027998838, 13.62,
  114.25922774520328, 30.5752225398922, 47.51, 114.25985290311769, 30.5753018567495, 47.57,
  114.25985245208585, 30.5752892693617, 14.23,
] as const

const PLANE_POSITIONS = [
  114.26109123956515, 30.575196063095532, 114.26002868416131, 30.575029970052253,
  114.25995067898559, 30.575610284720895, 114.26093508652325, 30.57571375633287, 114.26109123956515,
  30.575196063095532,
] as const

const PROJECTION_CAMERA = {
  heading: 269.4,
  pitch: -29,
} as const

const PROJECTION_VIEW = {
  position: { longitude: 112.66669, latitude: 33.248659, height: 1_220 },
  target: { longitude: 112.66669, latitude: 33.247659, height: 30 },
  horizontalViewAngle: 60,
  verticalViewAngle: 40,
} as const

export type VideoFusionSceneId = 'video-texture' | 'video-projection-livestream'

export interface CreateVideoFusionSceneOptions {
  host?: HTMLElement
  playback?: VideoFusionPlayback
  signal?: AbortSignal
}

interface LocalOffset {
  east: number
  north: number
  up: number
}

function getLocalOffset(
  from: { longitude: number; latitude: number; height: number },
  to: { longitude: number; latitude: number; height: number },
): LocalOffset {
  const meanLatitude = Cesium.Math.toRadians((from.latitude + to.latitude) / 2)
  return {
    east: (to.longitude - from.longitude) * 111_320 * Math.cos(Cesium.Math.toRadians(meanLatitude)),
    north: (to.latitude - from.latitude) * 110_540,
    up: to.height - from.height,
  }
}

function getFrustumOrientation(
  position: Cesium.Cartesian3,
  offset: LocalOffset,
): Cesium.Quaternion {
  const direction = Cesium.Cartesian3.normalize(
    new Cesium.Cartesian3(offset.east, offset.north, offset.up),
    new Cesium.Cartesian3(),
  )
  let right = Cesium.Cartesian3.cross(direction, Cesium.Cartesian3.UNIT_Z, new Cesium.Cartesian3())

  if (Cesium.Cartesian3.magnitudeSquared(right) < 1e-8) {
    const heading = Math.atan2(offset.east, offset.north)
    right = new Cesium.Cartesian3(Math.cos(heading), -Math.sin(heading), 0)
  }

  Cesium.Cartesian3.normalize(right, right)
  const up = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(right, direction, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  const enuRotation = Cesium.Matrix4.getMatrix3(
    Cesium.Transforms.eastNorthUpToFixedFrame(position),
    new Cesium.Matrix3(),
  )
  const worldDirection = Cesium.Matrix3.multiplyByVector(
    enuRotation,
    direction,
    new Cesium.Cartesian3(),
  )
  const worldUp = Cesium.Matrix3.multiplyByVector(enuRotation, up, new Cesium.Cartesian3())
  const worldRight = Cesium.Matrix3.multiplyByVector(enuRotation, right, new Cesium.Cartesian3())
  const orientationMatrix = new Cesium.Matrix3()

  Cesium.Matrix3.setColumn(
    orientationMatrix,
    0,
    Cesium.Cartesian3.negate(worldRight, new Cesium.Cartesian3()),
    orientationMatrix,
  )
  Cesium.Matrix3.setColumn(orientationMatrix, 1, worldUp, orientationMatrix)
  Cesium.Matrix3.setColumn(orientationMatrix, 2, worldDirection, orientationMatrix)

  return Cesium.Quaternion.fromRotationMatrix(orientationMatrix)
}

function destroyPrimitive(viewer: Cesium.Viewer, primitive: Cesium.Primitive) {
  viewer.scene.primitives.remove(primitive)
  if (!primitive.isDestroyed()) {
    primitive.destroy()
  }
}

function createVideoPlaceholder(width: number, height: number) {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  return canvas
}

function createTextureScene(
  viewer: Cesium.Viewer,
  playback: VideoFusionPlayback,
  setStatus: StatusReporter,
): SpatialScene {
  const material = new Cesium.ImageMaterialProperty({
    image: playback.element,
  })
  const facadeEntity = viewer.entities.add({
    id: 'video-texture-facade',
    name: '立体立面视频纹理',
    polygon: {
      hierarchy: new Cesium.PolygonHierarchy(
        Cesium.Cartesian3.fromDegreesArrayHeights([...FACADE_POSITIONS]),
      ),
      material,
      perPositionHeight: true,
      outline: true,
      outlineColor: Cesium.Color.fromCssColorString('rgba(225, 243, 255, 0.9)'),
    },
  })
  const planeEntity = viewer.entities.add({
    id: 'video-texture-plane',
    name: '平面视频纹理',
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArray([...PLANE_POSITIONS]),
      material,
    },
  })

  const cameraPositions = [
    ...Cesium.Cartesian3.fromDegreesArrayHeights([...FACADE_POSITIONS]),
    ...Cesium.Cartesian3.fromDegreesArray([...PLANE_POSITIONS]),
  ]
  framePositions(viewer, cameraPositions, 20, -52, 3.1)
  setStatus('视频纹理已应用到立体立面与平面，正在循环播放本地城市航拍视频')
  const stopRenderTicker = createContinuousRenderTicker(viewer)

  return {
    actions: [],
    attribution: VIDEO_ATTRIBUTION,
    dispose() {
      stopRenderTicker()
      viewer.entities.remove(facadeEntity)
      viewer.entities.remove(planeEntity)
      playback.dispose()
    },
  }
}

function createProjectionScene(
  viewer: Cesium.Viewer,
  playback: VideoFusionPlayback,
  setStatus: StatusReporter,
): SpatialScene {
  const viewPosition = Cesium.Cartesian3.fromDegrees(
    PROJECTION_VIEW.position.longitude,
    PROJECTION_VIEW.position.latitude,
    PROJECTION_VIEW.position.height,
  )
  const offset = getLocalOffset(PROJECTION_VIEW.position, PROJECTION_VIEW.target)
  const distance = Math.hypot(offset.east, offset.north, offset.up)
  const horizontalFov = Cesium.Math.toRadians(PROJECTION_VIEW.horizontalViewAngle)
  const verticalFov = Cesium.Math.toRadians(PROJECTION_VIEW.verticalViewAngle)
  const aspectRatio = Math.tan(horizontalFov / 2) / Math.tan(verticalFov / 2)
  const orientation = getFrustumOrientation(viewPosition, offset)
  const projectionRadius =
    distance * Math.hypot(Math.tan(horizontalFov / 2), Math.tan(verticalFov / 2))
  const projectionTarget = Cesium.Cartesian3.fromDegrees(
    PROJECTION_VIEW.target.longitude,
    PROJECTION_VIEW.target.latitude,
    PROJECTION_VIEW.target.height,
  )

  // 保留参考视角朝向，同时按投射面自动取景，确保初始画面完整包含视频。
  viewer.camera.viewBoundingSphere(
    new Cesium.BoundingSphere(projectionTarget, projectionRadius),
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(PROJECTION_CAMERA.heading),
      Cesium.Math.toRadians(PROJECTION_CAMERA.pitch),
      0,
    ),
  )

  const cameraFrustum = new Cesium.PerspectiveFrustum({
    fov: horizontalFov,
    aspectRatio,
    near: distance * 0.0001,
    far: distance,
  })
  const faceFrustum = new Cesium.PerspectiveFrustum({
    fov: horizontalFov,
    aspectRatio,
    near: distance - 0.01,
    far: distance,
  })
  let videoFace: Cesium.Primitive | undefined
  let videoFaceWidth = 0
  let videoFaceHeight = 0

  function removeVideoFace() {
    if (!videoFace) {
      return
    }

    destroyPrimitive(viewer, videoFace)
    videoFace = undefined
    videoFaceWidth = 0
    videoFaceHeight = 0
    viewer.scene.requestRender()
  }

  function addVideoFace() {
    if (videoFace) {
      return
    }

    const { videoWidth, videoHeight } = playback.element
    if (videoWidth <= 0 || videoHeight <= 0) {
      return
    }

    const imageMaterial = new Cesium.Material({
      fabric: {
        type: 'Image',
        uniforms: {
          color: Cesium.Color.WHITE,
          image: createVideoPlaceholder(videoWidth, videoHeight),
        },
      },
    })
    imageMaterial.uniforms.image = playback.element
    const primitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        geometry: new Cesium.FrustumGeometry({
          frustum: faceFrustum,
          origin: viewPosition,
          orientation,
        }),
      }),
      appearance: new Cesium.EllipsoidSurfaceAppearance({
        material: imageMaterial,
        flat: true,
        renderState: {
          cull: { enabled: false },
          depthTest: { enabled: false },
        },
      }),
      asynchronous: false,
    })
    viewer.scene.primitives.add(primitive)
    videoFace = primitive
    videoFaceWidth = videoWidth
    videoFaceHeight = videoHeight
    viewer.scene.requestRender()
  }

  function refreshVideoFace() {
    const { videoWidth, videoHeight } = playback.element
    if (videoFace && videoFaceWidth === videoWidth && videoFaceHeight === videoHeight) {
      return
    }

    if (videoFace) {
      removeVideoFace()
    }

    if (videoWidth > 0 && videoHeight > 0) {
      addVideoFace()
    }
  }

  refreshVideoFace()
  const handleVideoSizeChange = () => refreshVideoFace()
  playback.element.addEventListener('loadedmetadata', handleVideoSizeChange)
  playback.element.addEventListener('resize', handleVideoSizeChange)
  const unsubscribeSourceChange = playback.subscribeSourceChange?.(refreshVideoFace)
  const outline = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.FrustumOutlineGeometry({
        frustum: cameraFrustum,
        origin: viewPosition,
        orientation,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
    }),
    asynchronous: false,
  })
  viewer.scene.primitives.add(outline)
  setStatus('已绘制 60° × 40° 视锥，正在连接直播流')
  const stopRenderTicker = createContinuousRenderTicker(viewer)

  return {
    actions: [],
    attribution: VIDEO_ATTRIBUTION,
    dispose() {
      stopRenderTicker()
      playback.element.removeEventListener('loadedmetadata', handleVideoSizeChange)
      playback.element.removeEventListener('resize', handleVideoSizeChange)
      unsubscribeSourceChange?.()
      removeVideoFace()
      destroyPrimitive(viewer, outline)
      playback.dispose()
    },
  }
}

export async function createVideoFusionScene(
  viewer: Cesium.Viewer,
  sceneId: VideoFusionSceneId,
  setStatus: StatusReporter,
  options: CreateVideoFusionSceneOptions = {},
): Promise<SpatialScene> {
  const playback =
    options.playback ??
    createVideoFusionPlayback({
      host: options.host ?? document.body,
      localVideoUrl: getPublicAssetUrl(LOCAL_VIDEO_PATH),
      messages:
        sceneId === 'video-texture'
          ? {
              localPlaying: '视频纹理正在循环播放本地城市航拍视频',
              localFailed: '本地视频播放失败，请关闭后重试',
              liveConnecting: '',
              livePlaying: '',
              liveFallback: '',
            }
          : {
              localPlaying: '正在连接直播流，当前播放本地回退视频',
              localFailed: '本地回退视频播放失败，请关闭后重试',
              liveConnecting: '正在连接直播流，当前播放本地回退视频',
              livePlaying: '直播流已连接，视频正通过 60° × 40° 视锥投射',
              liveFallback: '直播流不可用，已切换本地回退视频',
            },
      mode: sceneId === 'video-texture' ? 'local' : 'live-with-fallback',
      setStatus,
      signal: options.signal,
    })

  const scene =
    sceneId === 'video-texture'
      ? createTextureScene(viewer, playback, setStatus)
      : createProjectionScene(viewer, playback, setStatus)

  try {
    await playback.start()
  } catch (error) {
    scene.dispose()
    throw error
  }

  return scene
}
