import * as Cesium from 'cesium'

export const PROJECTION_CAMERA = {
  heading: 269.4,
  pitch: -29,
} as const

const PROJECTION_VIEW = {
  position: { longitude: 112.66669, latitude: 33.248659, height: 1_220 },
  target: { longitude: 112.66669, latitude: 33.247659, height: 30 },
  horizontalViewAngle: 60,
  verticalViewAngle: 40,
} as const

export interface LocalOffset {
  east: number
  north: number
  up: number
}

export interface VideoFusionProjectionGeometry {
  aspectRatio: number
  cameraFrustum: Cesium.PerspectiveFrustum
  distance: number
  faceFrustum: Cesium.PerspectiveFrustum
  horizontalFov: number
  orientation: Cesium.Quaternion
  origin: Cesium.Cartesian3
  projectionRadius: number
  projectionTarget: Cesium.Cartesian3
  verticalFov: number
}

export function getLocalOffset(
  from: { longitude: number; latitude: number; height: number },
  to: { longitude: number; latitude: number; height: number },
): LocalOffset {
  const meanLatitude = Cesium.Math.toRadians((from.latitude + to.latitude) / 2)
  return {
    east: (to.longitude - from.longitude) * 111_320 * Math.cos(meanLatitude),
    north: (to.latitude - from.latitude) * 110_540,
    up: to.height - from.height,
  }
}

export function getFrustumOrientation(
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

export function createProjectionGeometry(): VideoFusionProjectionGeometry {
  const origin = Cesium.Cartesian3.fromDegrees(
    PROJECTION_VIEW.position.longitude,
    PROJECTION_VIEW.position.latitude,
    PROJECTION_VIEW.position.height,
  )
  const offset = getLocalOffset(PROJECTION_VIEW.position, PROJECTION_VIEW.target)
  const distance = Math.hypot(offset.east, offset.north, offset.up)
  const horizontalFov = Cesium.Math.toRadians(PROJECTION_VIEW.horizontalViewAngle)
  const verticalFov = Cesium.Math.toRadians(PROJECTION_VIEW.verticalViewAngle)
  const aspectRatio = Math.tan(horizontalFov / 2) / Math.tan(verticalFov / 2)
  const projectionTarget = Cesium.Cartesian3.fromDegrees(
    PROJECTION_VIEW.target.longitude,
    PROJECTION_VIEW.target.latitude,
    PROJECTION_VIEW.target.height,
  )

  return {
    aspectRatio,
    cameraFrustum: new Cesium.PerspectiveFrustum({
      fov: horizontalFov,
      aspectRatio,
      near: distance * 0.0001,
      far: distance,
    }),
    distance,
    faceFrustum: new Cesium.PerspectiveFrustum({
      fov: horizontalFov,
      aspectRatio,
      near: distance - 0.01,
      far: distance,
    }),
    horizontalFov,
    orientation: getFrustumOrientation(origin, offset),
    origin,
    projectionRadius: distance * Math.hypot(Math.tan(horizontalFov / 2), Math.tan(verticalFov / 2)),
    projectionTarget,
    verticalFov,
  }
}
