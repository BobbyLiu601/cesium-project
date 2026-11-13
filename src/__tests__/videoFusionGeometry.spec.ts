import * as Cesium from 'cesium'
import { describe, expect, it } from 'vitest'

import {
  createProjectionGeometry,
  getLocalOffset,
  PROJECTION_CAMERA,
} from '../demos/spatial/videoFusionGeometry'

function createCamera(drawingBufferWidth: number, drawingBufferHeight: number) {
  const scene = {
    drawingBufferHeight,
    drawingBufferWidth,
    mapProjection: new Cesium.GeographicProjection(Cesium.Ellipsoid.WGS84),
    screenSpaceCameraController: {
      maximumZoomDistance: 50_000_000,
      minimumZoomDistance: 1,
    },
  } as unknown as Cesium.Scene

  return new Cesium.Camera(scene)
}

describe('video fusion projection geometry', () => {
  it('converts longitude offsets using latitude expressed in radians', () => {
    const latitude = 33
    const offset = getLocalOffset(
      { longitude: 112, latitude, height: 0 },
      { longitude: 112.01, latitude, height: 0 },
    )

    expect(offset.east).toBeCloseTo(0.01 * 111_320 * Math.cos(Cesium.Math.toRadians(latitude)), 4)
  })

  it('projects all four video-face corners inside the initial viewport', () => {
    const geometry = createProjectionGeometry()
    const frustumGeometry = Cesium.FrustumGeometry.createGeometry(
      new Cesium.FrustumGeometry({
        frustum: geometry.faceFrustum,
        origin: geometry.origin,
        orientation: geometry.orientation,
      }),
    )
    const positions = frustumGeometry?.attributes.position?.values
    expect(positions).toBeDefined()

    const width = 1_280
    const height = 720
    const camera = createCamera(width, height)
    camera.viewBoundingSphere(
      new Cesium.BoundingSphere(geometry.projectionTarget, geometry.projectionRadius),
      new Cesium.HeadingPitchRange(
        Cesium.Math.toRadians(PROJECTION_CAMERA.heading),
        Cesium.Math.toRadians(PROJECTION_CAMERA.pitch),
        0,
      ),
    )
    const viewProjection = Cesium.Matrix4.multiply(
      camera.frustum.projectionMatrix,
      camera.viewMatrix,
      new Cesium.Matrix4(),
    )

    for (let index = 0; index < 4; index += 1) {
      const offset = index * 3
      const corner = new Cesium.Cartesian3(
        positions![offset]!,
        positions![offset + 1]!,
        positions![offset + 2]!,
      )
      const clip = Cesium.Matrix4.multiplyByVector(
        viewProjection,
        new Cesium.Cartesian4(corner.x, corner.y, corner.z, 1),
        new Cesium.Cartesian4(),
      )
      const screenX = ((clip.x / clip.w + 1) * width) / 2
      const screenY = ((1 - clip.y / clip.w) * height) / 2

      expect(clip.w).toBeGreaterThan(0)
      expect(screenX).toBeGreaterThan(0)
      expect(screenX).toBeLessThan(width)
      expect(screenY).toBeGreaterThan(0)
      expect(screenY).toBeLessThan(height)
    }
  })
})
