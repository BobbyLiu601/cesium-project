import * as Cesium from 'cesium'

import {
  heatmap3dCells,
  heatmap3dColors,
  heatmap3dRegion,
  HEATMAP_3D_COLUMNS,
  HEATMAP_3D_ROWS,
  honeycombCells,
  honeycombColors,
  honeycombRegion,
  HONEYCOMB_COLUMNS,
  HONEYCOMB_ROWS,
  pickStableColor,
} from '@/data/dataVisualization'
import { framePositions, throwIfAborted } from '@/demos/visualization/shared'
import type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'

function createCellPositions(cells: typeof heatmap3dCells, height: number) {
  return cells.map(({ latitude, longitude }) =>
    Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
  )
}

function createLegend(colors: readonly string[], title: string, maximumLabel: string) {
  return {
    colors,
    maximumLabel,
    minimumLabel: '0',
    title,
  }
}

export function createHeatmap3dScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  const longitudeStep = (heatmap3dRegion.east - heatmap3dRegion.west) / HEATMAP_3D_COLUMNS
  const latitudeStep = (heatmap3dRegion.north - heatmap3dRegion.south) / HEATMAP_3D_ROWS
  const centerLatitude = (heatmap3dRegion.north + heatmap3dRegion.south) / 2
  const cellWidth = longitudeStep * 111_320 * Math.cos((centerLatitude * Math.PI) / 180) * 0.66
  const cellDepth = latitudeStep * 110_540 * 0.66
  const entities: Cesium.Entity[] = []

  for (const cell of heatmap3dCells) {
    const color = Cesium.Color.fromCssColorString(
      pickStableColor(cell.value, heatmap3dColors),
    ).withAlpha(0.84)
    entities.push(
      viewer.entities.add({
        id: `heatmap-3d-cell-${entities.length}`,
        position: Cesium.Cartesian3.fromDegrees(cell.longitude, cell.latitude, cell.height / 2),
        box: {
          dimensions: new Cesium.Cartesian3(cellWidth, cellDepth, cell.height),
          material: color,
          outline: false,
        },
      }),
    )
  }

  throwIfAborted(signal)
  framePositions(viewer, createCellPositions(heatmap3dCells, 0), 0, -58, 1.55)
  setStatus(
    `已渲染 ${heatmap3dCells.length} 个固定热力网格柱体，覆盖中国中东部区域，颜色与高度使用同一归一化热力值。`,
  )

  return {
    actions: [],
    dispose() {
      for (const entity of entities) {
        viewer.entities.remove(entity)
      }
      entities.length = 0
    },
    legend: createLegend(heatmap3dColors, '三维热力强度', '1'),
  }
}

export function createHoneycombHeatmapScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  const longitudeStep = (honeycombRegion.east - honeycombRegion.west) / HONEYCOMB_COLUMNS
  const latitudeStep = (honeycombRegion.north - honeycombRegion.south) / HONEYCOMB_ROWS
  const centerLatitude = (honeycombRegion.north + honeycombRegion.south) / 2
  const radius =
    Math.min(
      longitudeStep * 111_320 * Math.cos((centerLatitude * Math.PI) / 180),
      latitudeStep * 110_540,
    ) * 0.46
  const entities: Cesium.Entity[] = []

  for (const cell of honeycombCells) {
    const color = Cesium.Color.fromCssColorString(
      pickStableColor(cell.value, honeycombColors),
    ).withAlpha(0.9)
    entities.push(
      viewer.entities.add({
        id: `honeycomb-cell-${entities.length}`,
        position: Cesium.Cartesian3.fromDegrees(cell.longitude, cell.latitude, cell.height / 2),
        cylinder: {
          bottomRadius: radius,
          length: cell.height,
          material: color,
          outline: false,
          slices: 6,
          topRadius: radius,
        },
      }),
    )
  }

  throwIfAborted(signal)
  framePositions(viewer, createCellPositions(honeycombCells, 0), 0, -57, 1.6)
  setStatus(
    `已渲染 ${honeycombCells.length} 个固定六边形蜂窝单元，单元高度与颜色均由同一热力值映射。`,
  )

  return {
    actions: [],
    dispose() {
      for (const entity of entities) {
        viewer.entities.remove(entity)
      }
      entities.length = 0
    },
    legend: createLegend(honeycombColors, '蜂窝热力强度', '1'),
  }
}
