import { featureCollection, point } from '@turf/helpers'
import { tin } from '@turf/tin'
import * as Cesium from 'cesium'

import { thiessenSamplePoints } from '@/data/gisClient'
import {
  addPointEntities,
  addPolygonEntities,
  createSamplePositions,
  framePositions,
  throwIfAborted,
} from '@/demos/visualization/shared'
import type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'

const SURFACE_HEIGHT = 100
const CAMERA_RANGE_FACTOR = 1.9
const TRIANGLE_COLORS = [
  '#ef476f',
  '#f78c6b',
  '#ffd166',
  '#06d6a0',
  '#118ab2',
  '#7b2cbf',
  '#2a9d8f',
  '#e76f51',
  '#4361ee',
  '#8ac926',
].map((color) => Cesium.Color.fromCssColorString(color).withAlpha(0.76))

export function createThiessenPolygonScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  const points = featureCollection(
    thiessenSamplePoints.map(({ latitude, longitude, value }) =>
      point([longitude, latitude], { value }),
    ),
  )
  const triangles = tin(points, 'value').features
  const triangleEntities = triangles.flatMap((triangle, index) =>
    addPolygonEntities(viewer, triangle.geometry, {
      color: TRIANGLE_COLORS[index % TRIANGLE_COLORS.length]!,
      height: SURFACE_HEIGHT,
      idPrefix: `thiessen-triangle-${index}`,
      outlineColor: Cesium.Color.WHITE.withAlpha(0.82),
    }),
  )
  const pointEntities = addPointEntities(
    viewer,
    thiessenSamplePoints,
    'thiessen-sample',
    SURFACE_HEIGHT + 70,
  )

  throwIfAborted(signal)
  framePositions(
    viewer,
    createSamplePositions(thiessenSamplePoints, SURFACE_HEIGHT),
    0,
    -68,
    CAMERA_RANGE_FACTOR,
  )
  setStatus(
    `已根据 ${thiessenSamplePoints.length} 个固定采样点生成 ${triangles.length} 个 TIN 三角面`,
  )

  return {
    actions: [],
    dispose() {
      for (const entity of [...triangleEntities, ...pointEntities]) {
        viewer.entities.remove(entity)
      }
    },
  }
}
