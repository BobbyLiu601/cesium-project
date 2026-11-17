import { area } from '@turf/area'
import { featureCollection, polygon } from '@turf/helpers'
import { intersect } from '@turf/intersect'
import * as Cesium from 'cesium'

import { overlayPolygonA, overlayPolygonB } from '@/data/gisClient'
import {
  addPolygonEntities,
  framePositions,
  throwIfAborted,
  type ArealGeometry,
} from '@/demos/visualization/shared'
import type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'

const SURFACE_HEIGHT = 100
const CAMERA_RANGE_FACTOR = 2.4

function clonePolygon(coordinates: typeof overlayPolygonA) {
  return coordinates.map(([longitude, latitude]) => [longitude, latitude] as [number, number])
}

function getLabelCoordinate(geometry: ArealGeometry) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const outerRing = polygons[0]?.[0]?.slice(0, -1) ?? []
  const total = outerRing.reduce(
    (coordinate, point) => ({
      longitude: coordinate.longitude + (point[0] ?? 0),
      latitude: coordinate.latitude + (point[1] ?? 0),
    }),
    { longitude: 0, latitude: 0 },
  )
  const divisor = Math.max(1, outerRing.length)

  return {
    latitude: total.latitude / divisor,
    longitude: total.longitude / divisor,
  }
}

function getPolygonPositions() {
  return [...overlayPolygonA, ...overlayPolygonB].map(([longitude, latitude]) =>
    Cesium.Cartesian3.fromDegrees(longitude, latitude, SURFACE_HEIGHT),
  )
}

export function createOverlayAnalysisScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)
  const polygonA = clonePolygon(overlayPolygonA)
  const polygonB = clonePolygon(overlayPolygonB)

  const redPolygon = addPolygonEntities(
    viewer,
    { type: 'Polygon', coordinates: [polygonA] },
    {
      color: Cesium.Color.RED.withAlpha(0.48),
      height: SURFACE_HEIGHT,
      idPrefix: 'overlay-source-a',
      outlineColor: Cesium.Color.WHITE.withAlpha(0.82),
    },
  )
  const greenPolygon = addPolygonEntities(
    viewer,
    { type: 'Polygon', coordinates: [polygonB] },
    {
      color: Cesium.Color.GREEN.withAlpha(0.48),
      height: SURFACE_HEIGHT,
      idPrefix: 'overlay-source-b',
      outlineColor: Cesium.Color.WHITE.withAlpha(0.82),
    },
  )

  const intersection = intersect(
    featureCollection([
      polygon([polygonA], { name: '叠加分析区域 A' }),
      polygon([polygonB], { name: '叠加分析区域 B' }),
    ]),
  )

  if (!intersection) {
    throw new Error('参考多边形没有相交区域')
  }

  throwIfAborted(signal)
  const intersectionEntities = addPolygonEntities(viewer, intersection.geometry, {
    color: Cesium.Color.BLUE.withAlpha(0.72),
    height: SURFACE_HEIGHT + 20,
    idPrefix: 'overlay-intersection',
    outlineColor: Cesium.Color.WHITE,
  })
  const areaSquareMeters = area(intersection)
  const formattedArea = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: 0,
  }).format(areaSquareMeters)
  const labelCoordinate = getLabelCoordinate(intersection.geometry)
  const labelEntity = viewer.entities.add({
    id: 'overlay-area-label',
    position: Cesium.Cartesian3.fromDegrees(
      labelCoordinate.longitude,
      labelCoordinate.latitude,
      SURFACE_HEIGHT + 240,
    ),
    label: {
      text: `相交部分\n${formattedArea} m²`,
      font: '16px sans-serif',
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.BLACK,
      outlineWidth: 3,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  })

  framePositions(viewer, getPolygonPositions(), 0, -72, CAMERA_RANGE_FACTOR)
  setStatus(`已计算两块区域的相交部分，面积 ${formattedArea} 平方米`)

  return {
    actions: [],
    dispose() {
      for (const entity of [...redPolygon, ...greenPolygon, ...intersectionEntities, labelEntity]) {
        viewer.entities.remove(entity)
      }
    },
  }
}
