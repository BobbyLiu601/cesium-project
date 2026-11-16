import * as Cesium from 'cesium'

import { removeEntities } from '@/demos/specialShapes/shared'
import type { SpecialShapeScene, StatusReporter } from '@/demos/specialShapes/types'

const TIMES = [0, 0.25, 0.5, 0.75, 1]

export function createCurveInterpolationScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const controls = [
    Cesium.Cartesian3.fromDegrees(110, 10),
    Cesium.Cartesian3.fromDegrees(111, 11),
    Cesium.Cartesian3.fromDegrees(112, 9),
    Cesium.Cartesian3.fromDegrees(114, 10),
    Cesium.Cartesian3.fromDegrees(113, 8),
  ]
  const entities = controls.map((position) =>
    viewer.entities.add({
      position,
      point: {
        color: Cesium.Color.RED,
        pixelSize: 10,
      },
    }),
  )

  const linearPositions = sampleSpline(
    new Cesium.LinearSpline({
      points: controls,
      times: TIMES,
    }),
  )
  for (const position of linearPositions) {
    entities.push(
      viewer.entities.add({
        position,
        point: {
          color: Cesium.Color.YELLOW,
          pixelSize: 6,
        },
      }),
    )
  }
  entities.push(
    viewer.entities.add({
      name: 'LinearSpline',
      polyline: {
        material: Cesium.Color.GREEN,
        positions: linearPositions,
        width: 3,
      },
    }),
  )

  const curvedPositions = sampleSpline(
    new Cesium.CatmullRomSpline({
      points: controls,
      times: TIMES,
    }),
  )
  for (const position of curvedPositions) {
    entities.push(
      viewer.entities.add({
        position,
        point: {
          color: Cesium.Color.BLUE,
          pixelSize: 6,
        },
      }),
    )
  }
  entities.push(
    viewer.entities.add({
      name: 'CatmullRomSpline',
      polyline: {
        material: Cesium.Color.WHITE,
        positions: curvedPositions,
        width: 3,
      },
    }),
  )

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(112, 9.5, 1_800_000),
  })
  setStatus('绿色线性插值、白色 Catmull-Rom 曲线与 100 个采样点已生成')

  return {
    actions: [],
    dispose: () => removeEntities(viewer, entities),
  }
}

function sampleSpline(
  spline: Cesium.LinearSpline | Cesium.CatmullRomSpline,
  samples = 100,
): Cesium.Cartesian3[] {
  return Array.from(
    { length: samples + 1 },
    (_, index) => spline.evaluate(index / samples) as Cesium.Cartesian3,
  )
}
