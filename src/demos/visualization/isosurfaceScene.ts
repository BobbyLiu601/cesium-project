import { featureCollection, point } from '@turf/helpers'
import { isobands } from '@turf/isobands'
import { isolines } from '@turf/isolines'
import * as Cesium from 'cesium'

import { isosurfaceBreaks, isosurfaceColors, isosurfaceGrid } from '@/data/gisClient'
import {
  addPolygonEntities,
  addPolylineEntities,
  createSamplePositions,
  framePositions,
  throwIfAborted,
} from '@/demos/visualization/shared'
import type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'

const BAND_HEIGHT = 100
const LINE_HEIGHT = 145
const CAMERA_RANGE_FACTOR = 1.55

export function createIsosurfaceScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  const points = featureCollection(
    isosurfaceGrid.map(({ latitude, longitude, value }) =>
      point([longitude, latitude], { speed: value }),
    ),
  )
  const bands = isobands(points, [...isosurfaceBreaks], {
    breaksProperties: isosurfaceColors.map((_, index) => ({ band: index })),
    zProperty: 'speed',
  })
  const lines = isolines(points, [...isosurfaceBreaks], {
    zProperty: 'speed',
  })

  let renderedBandCount = 0
  const bandEntities = bands.features.flatMap((band, index) => {
    const entities = addPolygonEntities(viewer, band.geometry, {
      color: Cesium.Color.fromCssColorString(
        isosurfaceColors[index % isosurfaceColors.length]!,
      ).withAlpha(0.76),
      height: BAND_HEIGHT,
      idPrefix: `isosurface-band-${index}`,
      outlineColor: Cesium.Color.fromCssColorString('rgba(15,23,42,0.7)'),
    })
    if (entities.length > 0) {
      renderedBandCount += 1
    }
    return entities
  })
  const lineEntities = lines.features.flatMap((line, index) =>
    addPolylineEntities(viewer, line.geometry, {
      color: Cesium.Color.BLACK.withAlpha(0.9),
      height: LINE_HEIGHT,
      idPrefix: `isosurface-line-${index}`,
      width: 1.4,
    }),
  )

  throwIfAborted(signal)
  framePositions(
    viewer,
    createSamplePositions(isosurfaceGrid, BAND_HEIGHT),
    0,
    -74,
    CAMERA_RANGE_FACTOR,
  )
  setStatus(
    `已展示 ${renderedBandCount} 级固定风场等值面与 ${lineEntities.length} 条等值线，共 ${isosurfaceGrid.length} 个采样点`,
  )

  return {
    actions: [],
    dispose() {
      for (const entity of [...bandEntities, ...lineEntities]) {
        viewer.entities.remove(entity)
      }
    },
  }
}
