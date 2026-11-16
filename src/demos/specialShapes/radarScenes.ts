import * as Cesium from 'cesium'

import radarColorImage from '@/assets/special-shapes/radar-color.png'
import { createSpecialShapeAnimation, removeEntities } from '@/demos/specialShapes/shared'
import type { SpecialShapeScene, StatusReporter } from '@/demos/specialShapes/types'

const RADAR_SCAN_DEGREES_PER_MS = 0.24
const RADAR_MASK_DEGREES_PER_MS = 0.12
const RADAR_CYAN = Cesium.Color.fromCssColorString('#00dcff82')

export function createRadarScanScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  let animationElapsedMs = 0
  const entity = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(114.40372, 30.52252),
    ellipse: {
      height: 0,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      material: new Cesium.ImageMaterialProperty({
        color: new Cesium.Color(1, 0, 0, 0.7),
        image: radarColorImage,
        transparent: true,
      }),
      outline: true,
      outlineColor: Cesium.Color.YELLOW,
      outlineWidth: 2,
      semiMajorAxis: 300,
      semiMinorAxis: 300,
      stRotation: new Cesium.CallbackProperty(() => {
        return Cesium.Math.toRadians(animationElapsedMs * RADAR_SCAN_DEGREES_PER_MS)
      }, false),
    },
  })
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    animationElapsedMs = elapsedMs
  })

  void viewer.flyTo(entity, { duration: 0 })
  setStatus('红黄雷达圆盘持续旋转扫描播放中')

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, [entity])
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '雷达扫描已暂停' : '雷达扫描继续播放中')
    },
  }
}

export function createRadarMaskScanScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const center = { longitude: -75, latitude: 39 }
  const position = Cesium.Cartesian3.fromDegrees(center.longitude, center.latitude)
  const radius = 100_000
  let positionArr = computeMaskPositions(center.longitude, center.latitude, radius, 0)

  const entity = viewer.entities.add({
    position,
    ellipsoid: {
      material: RADAR_CYAN,
      maximumCone: Cesium.Math.toRadians(90),
      outline: true,
      outlineColor: RADAR_CYAN,
      outlineWidth: 1,
      radii: new Cesium.Cartesian3(radius, radius, radius),
    },
    wall: {
      material: RADAR_CYAN,
      positions: new Cesium.CallbackProperty(() => {
        return Cesium.Cartesian3.fromDegreesArrayHeights(positionArr)
      }, false),
    },
  })
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    positionArr = computeMaskPositions(
      center.longitude,
      center.latitude,
      radius,
      (elapsedMs * RADAR_MASK_DEGREES_PER_MS) % 360,
    )
  })

  void viewer.flyTo(entity, { duration: 0 })
  setStatus('青色半球遮罩与扇形雷达墙持续旋转播放中')

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, [entity])
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '雷达遮罩扫描已暂停' : '雷达遮罩扫描继续播放中')
    },
  }
}

function computeMaskPositions(
  longitude: number,
  latitude: number,
  radius: number,
  heading: number,
) {
  const originFrame = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(longitude, latitude),
  )
  const radians = Cesium.Math.toRadians(heading)
  const translation = Cesium.Cartesian3.fromElements(
    radius * Math.cos(radians),
    radius * Math.sin(radians),
    0,
  )
  const edge = Cesium.Matrix4.multiplyByPoint(originFrame, translation, new Cesium.Cartesian3())
  const edgeCartographic = Cesium.Cartographic.fromCartesian(edge)
  const edgeLongitude = Cesium.Math.toDegrees(edgeCartographic.longitude)
  const edgeLatitude = Cesium.Math.toDegrees(edgeCartographic.latitude)
  const edgeRadius = Cesium.Cartesian3.distance(
    Cesium.Cartesian3.fromDegrees(longitude, latitude),
    Cesium.Cartesian3.fromDegrees(edgeLongitude, edgeLatitude),
  )
  const positions: number[] = [longitude, latitude, 0]

  for (let angle = 0; angle <= 90; angle += 1) {
    const radiansAtAngle = Cesium.Math.toRadians(angle)
    const scale = Math.cos(radiansAtAngle)
    positions.push(
      (edgeLongitude - longitude) * scale + longitude,
      (edgeLatitude - latitude) * scale + latitude,
      edgeRadius * Math.sin(radiansAtAngle),
    )
  }

  return positions
}
