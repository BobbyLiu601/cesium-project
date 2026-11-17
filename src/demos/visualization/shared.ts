import * as Cesium from 'cesium'

import type { GisPointSample } from '@/data/gisClient'

type Position = number[]

export interface PolygonGeometry {
  type: 'Polygon'
  coordinates: Position[][]
}

export interface MultiPolygonGeometry {
  type: 'MultiPolygon'
  coordinates: Position[][][]
}

export interface LineStringGeometry {
  type: 'LineString'
  coordinates: Position[]
}

export interface MultiLineStringGeometry {
  type: 'MultiLineString'
  coordinates: Position[][]
}

export type ArealGeometry = PolygonGeometry | MultiPolygonGeometry
export type LinearGeometry = LineStringGeometry | MultiLineStringGeometry

interface PolygonRenderOptions {
  color: Cesium.Color
  height?: number
  idPrefix: string
  outlineColor?: Cesium.Color
}

interface PolylineRenderOptions {
  color: Cesium.Color
  height?: number
  idPrefix: string
  width?: number
}

export function createAbortError() {
  return new DOMException('GIS 客户端场景加载已取消', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

export function createSamplePositions(samples: readonly GisPointSample[], height: number) {
  return samples.map(({ longitude, latitude }) =>
    Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
  )
}

export function framePositions(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  headingDegrees: number,
  pitchDegrees: number,
  rangeFactor: number,
) {
  if (positions.length === 0) {
    return
  }

  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(headingDegrees),
      Cesium.Math.toRadians(pitchDegrees),
      Math.max(800, sphere.radius * rangeFactor),
    ),
  )
}

function toCartesianPositions(coordinates: Position[], height: number) {
  const values: number[] = []

  for (const coordinate of coordinates) {
    const [longitude, latitude] = coordinate
    if (typeof longitude === 'number' && typeof latitude === 'number') {
      values.push(longitude, latitude, height)
    }
  }

  return Cesium.Cartesian3.fromDegreesArrayHeights(values)
}

function createPolygonHierarchy(coordinates: Position[][], height: number) {
  const [outerRing, ...holes] = coordinates
  if (!outerRing) {
    return undefined
  }

  return new Cesium.PolygonHierarchy(
    toCartesianPositions(outerRing, height),
    holes.map((hole) => new Cesium.PolygonHierarchy(toCartesianPositions(hole, height))),
  )
}

export function addPolygonEntities(
  viewer: Cesium.Viewer,
  geometry: ArealGeometry,
  options: PolygonRenderOptions,
) {
  const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const height = options.height ?? 120

  return polygons.flatMap((coordinates, index) => {
    const hierarchy = createPolygonHierarchy(coordinates, height)
    if (!hierarchy) {
      return []
    }

    return [
      viewer.entities.add({
        id: `${options.idPrefix}-${index}`,
        polygon: {
          hierarchy,
          material: options.color,
          outline: true,
          outlineColor:
            options.outlineColor ?? Cesium.Color.fromCssColorString('rgba(255,255,255,0.78)'),
          perPositionHeight: true,
        },
      }),
    ]
  })
}

export function addPolylineEntities(
  viewer: Cesium.Viewer,
  geometry: LinearGeometry,
  options: PolylineRenderOptions,
) {
  const lines = geometry.type === 'LineString' ? [geometry.coordinates] : geometry.coordinates
  const height = options.height ?? 140

  return lines.flatMap((coordinates, index) => {
    if (coordinates.length < 2) {
      return []
    }

    return [
      viewer.entities.add({
        id: `${options.idPrefix}-${index}`,
        polyline: {
          positions: toCartesianPositions(coordinates, height),
          width: options.width ?? 1.5,
          material: options.color,
        },
      }),
    ]
  })
}

export function addPointEntities(
  viewer: Cesium.Viewer,
  samples: readonly GisPointSample[],
  idPrefix: string,
  height = 180,
) {
  return samples.map(({ longitude, latitude }, index) =>
    viewer.entities.add({
      id: `${idPrefix}-${index}`,
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      point: {
        color: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.fromCssColorString('#102a43'),
        outlineWidth: 1,
        pixelSize: 5,
      },
    }),
  )
}
