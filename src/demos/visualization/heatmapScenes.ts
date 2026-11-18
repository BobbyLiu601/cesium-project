import * as Cesium from 'cesium'

import {
  heatmap3dColors,
  heatmap3dRegion,
  HEATMAP_3D_GRID_SIZE,
  HEATMAP_3D_MAX_HEIGHT,
  HEATMAP_3D_TEXTURE_SIZE,
  honeycombCells,
  honeycombColors,
  HONEYCOMB_COLUMNS,
  HONEYCOMB_MAX_HEIGHT,
  HONEYCOMB_ROWS,
  honeycombRegion,
  sampleHeatColor,
  sampleHeatmap3dField,
  sampleHoneycombColorCss,
} from '@/data/dataVisualization'
import { framePositions, throwIfAborted } from '@/demos/visualization/shared'
import { createRgbaPngDataUri } from '@/demos/visualization/texture'
import type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'

function createLegend(colors: readonly string[], title: string, maximumLabel: string) {
  return {
    colors,
    maximumLabel,
    minimumLabel: '0',
    title,
  }
}

function createRegionPositions(
  region: { east: number; north: number; south: number; west: number },
  height: number,
) {
  return [
    Cesium.Cartesian3.fromDegrees(region.west, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.north, height),
    Cesium.Cartesian3.fromDegrees(region.west, region.north, height),
  ]
}

function createHeatmapTexture() {
  const size = HEATMAP_3D_TEXTURE_SIZE
  const pixels = new Uint8Array(size * size * 4)

  for (let row = 0; row < size; row += 1) {
    const latitude =
      heatmap3dRegion.south + ((row + 0.5) / size) * (heatmap3dRegion.north - heatmap3dRegion.south)

    for (let column = 0; column < size; column += 1) {
      const longitude =
        heatmap3dRegion.west +
        ((column + 0.5) / size) * (heatmap3dRegion.east - heatmap3dRegion.west)
      const value = sampleHeatmap3dField(longitude, latitude)
      const [red, green, blue] = sampleHeatColor(value)
      const offset = (row * size + column) * 4
      pixels[offset] = red
      pixels[offset + 1] = green
      pixels[offset + 2] = blue
      pixels[offset + 3] = 255
    }
  }

  return createRgbaPngDataUri(size, size, pixels)
}

function createHeatmap3dPrimitive(viewer: Cesium.Viewer) {
  const gridSize = HEATMAP_3D_GRID_SIZE
  const positions: number[] = []
  const textureCoordinates: number[] = []
  const indices: number[] = []

  for (let row = 0; row < gridSize; row += 1) {
    const latitude =
      heatmap3dRegion.south +
      (row / (gridSize - 1)) * (heatmap3dRegion.north - heatmap3dRegion.south)

    for (let column = 0; column < gridSize; column += 1) {
      const longitude =
        heatmap3dRegion.west +
        (column / (gridSize - 1)) * (heatmap3dRegion.east - heatmap3dRegion.west)
      const value = sampleHeatmap3dField(longitude, latitude)
      const position = Cesium.Cartesian3.fromDegrees(
        longitude,
        latitude,
        value * HEATMAP_3D_MAX_HEIGHT,
      )
      positions.push(position.x, position.y, position.z)
      textureCoordinates.push(column / (gridSize - 1), row / (gridSize - 1))
    }
  }

  for (let row = 0; row < gridSize - 1; row += 1) {
    for (let column = 0; column < gridSize - 1; column += 1) {
      const lowerLeft = row * gridSize + column
      const lowerRight = lowerLeft + 1
      const upperLeft = lowerLeft + gridSize
      const upperRight = upperLeft + 1
      indices.push(lowerLeft, lowerRight, upperLeft)
      indices.push(upperLeft, lowerRight, upperRight)
    }
  }

  const attributes = new Cesium.GeometryAttributes()
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: new Float64Array(positions),
  })
  attributes.st = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 2,
    values: new Float32Array(textureCoordinates),
  })

  const geometry = new Cesium.Geometry({
    attributes,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    indices: new Uint32Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
  })
  const primitive = new Cesium.Primitive({
    allowPicking: false,
    appearance: new Cesium.MaterialAppearance({
      material: new Cesium.Material({
        fabric: {
          type: 'Image',
          uniforms: {
            image: createHeatmapTexture(),
          },
        },
        translucent: false,
      }),
      materialSupport: Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
      translucent: false,
    }),
    asynchronous: false,
    geometryInstances: new Cesium.GeometryInstance({ geometry }),
  })

  viewer.scene.primitives.add(primitive)
  return primitive
}

export function createHeatmap3dScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
): VisualizationScene {
  throwIfAborted(signal)

  viewer.scene.globe.enableLighting = false
  const primitive = createHeatmap3dPrimitive(viewer)

  throwIfAborted(signal)
  framePositions(viewer, createRegionPositions(heatmap3dRegion, 0), 24, -38, 2.7)
  setStatus(
    `已渲染 ${HEATMAP_3D_GRID_SIZE} × ${HEATMAP_3D_GRID_SIZE} 网格的三维热力地形，峰值约 ${HEATMAP_3D_MAX_HEIGHT} 米，颜色与高度使用同一热力值。`,
  )

  return {
    actions: [],
    dispose() {
      viewer.scene.primitives.remove(primitive)
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
  const entities: Cesium.Entity[] = []

  for (const cell of honeycombCells) {
    const west = honeycombRegion.west + cell.column * longitudeStep
    const east = west + longitudeStep
    const south = honeycombRegion.south + cell.row * latitudeStep
    const north = south + latitudeStep
    entities.push(
      viewer.entities.add({
        id: `honeycomb-cell-${cell.row}-${cell.column}`,
        polygon: {
          extrudedHeight: cell.height,
          height: 0,
          hierarchy: Cesium.Cartesian3.fromDegreesArray([
            west,
            south,
            east,
            south,
            east,
            north,
            west,
            north,
          ]),
          material: Cesium.Color.fromCssColorString(sampleHoneycombColorCss(cell.value)),
          outline: false,
        },
      }),
    )
  }

  throwIfAborted(signal)
  framePositions(viewer, createRegionPositions(honeycombRegion, 0), 18, -56, 3)
  setStatus(
    `已渲染 ${HONEYCOMB_COLUMNS} × ${HONEYCOMB_ROWS} 个固定网格热力单元，单元从地表挤出至最高 ${HONEYCOMB_MAX_HEIGHT} 米。`,
  )

  return {
    actions: [],
    dispose() {
      for (const entity of entities) {
        viewer.entities.remove(entity)
      }
      entities.length = 0
    },
    legend: createLegend(honeycombColors, '蜂窝热力强度', '800 m'),
  }
}
