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

type Region = { east: number; north: number; south: number; west: number }

function createLegend(colors: readonly string[], title: string, maximumLabel: string) {
  return {
    colors,
    maximumLabel,
    minimumLabel: '0',
    title,
  }
}

function createRegionPositions(region: Region, height: number) {
  return [
    Cesium.Cartesian3.fromDegrees(region.west, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.south, height),
    Cesium.Cartesian3.fromDegrees(region.east, region.north, height),
    Cesium.Cartesian3.fromDegrees(region.west, region.north, height),
  ]
}

function sampleHeatmap3dFieldAt(longitude: number, latitude: number) {
  return sampleHeatmap3dField(longitude, latitude)
}

function createHeatmapTexture() {
  const size = HEATMAP_3D_TEXTURE_SIZE
  const longitudeStep = (heatmap3dRegion.east - heatmap3dRegion.west) / size
  const latitudeStep = (heatmap3dRegion.north - heatmap3dRegion.south) / size
  const pixels = new Uint8Array(size * size * 4)

  for (let row = 0; row < size; row += 1) {
    const latitude =
      heatmap3dRegion.south + ((row + 0.5) / size) * (heatmap3dRegion.north - heatmap3dRegion.south)

    for (let column = 0; column < size; column += 1) {
      const longitude =
        heatmap3dRegion.west +
        ((column + 0.5) / size) * (heatmap3dRegion.east - heatmap3dRegion.west)
      const value = sampleHeatmap3dFieldAt(longitude, latitude)
      const [red, green, blue] = sampleHeatColor(value)
      const west = sampleHeatmap3dFieldAt(longitude - longitudeStep, latitude)
      const east = sampleHeatmap3dFieldAt(longitude + longitudeStep, latitude)
      const south = sampleHeatmap3dFieldAt(longitude, latitude - latitudeStep)
      const north = sampleHeatmap3dFieldAt(longitude, latitude + latitudeStep)
      const light = clamp(0.82 + (west - east) * 1.8 + (south - north) * 1.25, 0.58, 1.2)
      const offset = (row * size + column) * 4
      pixels[offset] = clampByte(red * light)
      pixels[offset + 1] = clampByte(green * light)
      pixels[offset + 2] = clampByte(blue * light)
      pixels[offset + 3] = 255
    }
  }

  return createRgbaPngDataUri(size, size, pixels)
}

function createHeatmapSurfaceGeometry() {
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
      const value = sampleHeatmap3dFieldAt(longitude, latitude)
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

  return new Cesium.Geometry({
    attributes,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    indices: new Uint32Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
  })
}

function createHeatmapSkirtGeometry() {
  const gridSize = HEATMAP_3D_GRID_SIZE
  const positions: number[] = []
  const normals: number[] = []
  const indices: number[] = []

  const addWall = (first: [number, number], second: [number, number]) => {
    const firstValue = sampleHeatmap3dFieldAt(first[0], first[1])
    const secondValue = sampleHeatmap3dFieldAt(second[0], second[1])
    const topFirst = Cesium.Cartesian3.fromDegrees(
      first[0],
      first[1],
      firstValue * HEATMAP_3D_MAX_HEIGHT,
    )
    const topSecond = Cesium.Cartesian3.fromDegrees(
      second[0],
      second[1],
      secondValue * HEATMAP_3D_MAX_HEIGHT,
    )
    const baseFirst = Cesium.Cartesian3.fromDegrees(first[0], first[1], 0)
    const baseSecond = Cesium.Cartesian3.fromDegrees(second[0], second[1], 0)
    const firstNormal = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.fromDegrees(first[0], first[1], 0),
      new Cesium.Cartesian3(),
    )
    const secondNormal = Cesium.Cartesian3.normalize(
      Cesium.Cartesian3.fromDegrees(second[0], second[1], 0),
      new Cesium.Cartesian3(),
    )
    const offset = positions.length / 3
    positions.push(
      topFirst.x,
      topFirst.y,
      topFirst.z,
      topSecond.x,
      topSecond.y,
      topSecond.z,
      baseSecond.x,
      baseSecond.y,
      baseSecond.z,
      baseFirst.x,
      baseFirst.y,
      baseFirst.z,
    )
    normals.push(
      firstNormal.x,
      firstNormal.y,
      firstNormal.z,
      secondNormal.x,
      secondNormal.y,
      secondNormal.z,
      secondNormal.x,
      secondNormal.y,
      secondNormal.z,
      firstNormal.x,
      firstNormal.y,
      firstNormal.z,
    )
    indices.push(
      offset,
      offset + 1,
      offset + 2,
      offset,
      offset + 2,
      offset + 3,
      offset,
      offset + 2,
      offset + 1,
      offset,
      offset + 3,
      offset + 2,
    )
  }

  for (let column = 0; column < gridSize - 1; column += 1) {
    const west =
      heatmap3dRegion.west +
      (column / (gridSize - 1)) * (heatmap3dRegion.east - heatmap3dRegion.west)
    const east =
      heatmap3dRegion.west +
      ((column + 1) / (gridSize - 1)) * (heatmap3dRegion.east - heatmap3dRegion.west)
    addWall([west, heatmap3dRegion.south], [east, heatmap3dRegion.south])
    addWall([west, heatmap3dRegion.north], [east, heatmap3dRegion.north])
  }

  for (let row = 0; row < gridSize - 1; row += 1) {
    const south =
      heatmap3dRegion.south +
      (row / (gridSize - 1)) * (heatmap3dRegion.north - heatmap3dRegion.south)
    const north =
      heatmap3dRegion.south +
      ((row + 1) / (gridSize - 1)) * (heatmap3dRegion.north - heatmap3dRegion.south)
    addWall([heatmap3dRegion.west, south], [heatmap3dRegion.west, north])
    addWall([heatmap3dRegion.east, south], [heatmap3dRegion.east, north])
  }

  const attributes = new Cesium.GeometryAttributes()
  attributes.position = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.DOUBLE,
    componentsPerAttribute: 3,
    values: new Float64Array(positions),
  })
  attributes.normal = new Cesium.GeometryAttribute({
    componentDatatype: Cesium.ComponentDatatype.FLOAT,
    componentsPerAttribute: 3,
    values: new Float32Array(normals),
  })

  return new Cesium.Geometry({
    attributes,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
    indices: new Uint32Array(indices),
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
  })
}

function createHeatmap3dPrimitive(viewer: Cesium.Viewer) {
  const surface = new Cesium.Primitive({
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
    geometryInstances: new Cesium.GeometryInstance({ geometry: createHeatmapSurfaceGeometry() }),
  })
  const skirt = new Cesium.Primitive({
    allowPicking: false,
    appearance: new Cesium.MaterialAppearance({
      closed: false,
      faceForward: true,
      flat: true,
      material: new Cesium.Material({
        fabric: {
          type: 'Color',
          uniforms: {
            color: Cesium.Color.fromCssColorString('#10243a'),
          },
        },
        translucent: false,
      }),
      materialSupport: Cesium.MaterialAppearance.MaterialSupport.BASIC,
      translucent: false,
    }),
    asynchronous: false,
    geometryInstances: new Cesium.GeometryInstance({ geometry: createHeatmapSkirtGeometry() }),
  })

  viewer.scene.primitives.add(surface)
  viewer.scene.primitives.add(skirt)
  return [surface, skirt]
}

function createHoneycombPrimitive(viewer: Cesium.Viewer) {
  const longitudeStep = (honeycombRegion.east - honeycombRegion.west) / HONEYCOMB_COLUMNS
  const latitudeStep = (honeycombRegion.north - honeycombRegion.south) / HONEYCOMB_ROWS
  const instances = honeycombCells.map((cell) => {
    const west = honeycombRegion.west + cell.column * longitudeStep
    const east = west + longitudeStep
    const south = honeycombRegion.south + cell.row * latitudeStep
    const north = south + latitudeStep
    const positions = Cesium.Cartesian3.fromDegreesArray([
      west,
      south,
      east,
      south,
      east,
      north,
      west,
      north,
    ])

    return new Cesium.GeometryInstance({
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString(sampleHoneycombColorCss(cell.value)),
        ),
      },
      geometry: Cesium.PolygonGeometry.fromPositions({
        extrudedHeight: Math.max(4, cell.height),
        height: 0,
        positions,
        vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT,
      }),
    })
  })

  const primitive = new Cesium.Primitive({
    allowPicking: false,
    appearance: new Cesium.PerInstanceColorAppearance({
      closed: true,
      flat: false,
      translucent: false,
    }),
    asynchronous: false,
    geometryInstances: instances,
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
  const primitives = createHeatmap3dPrimitive(viewer)

  throwIfAborted(signal)
  framePositions(viewer, createRegionPositions(heatmap3dRegion, 0), 24, -34, 3.2)
  setStatus(
    `已渲染 ${HEATMAP_3D_GRID_SIZE} × ${HEATMAP_3D_GRID_SIZE} 网格的三维热力地形，峰值约 ${HEATMAP_3D_MAX_HEIGHT} 米，颜色与高度使用同一热力值。`,
  )

  return {
    actions: [],
    dispose() {
      for (const primitive of primitives) {
        viewer.scene.primitives.remove(primitive)
      }
      primitives.length = 0
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

  const primitive = createHoneycombPrimitive(viewer)

  throwIfAborted(signal)
  framePositions(viewer, createRegionPositions(honeycombRegion, 0), 18, -48, 3)
  setStatus(
    `已渲染 ${HONEYCOMB_COLUMNS} × ${HONEYCOMB_ROWS} 个固定网格热力单元，单元从地表挤出至最高 ${HONEYCOMB_MAX_HEIGHT} 米。`,
  )

  return {
    actions: [],
    dispose() {
      viewer.scene.primitives.remove(primitive)
    },
    legend: createLegend(honeycombColors, '蜂窝热力强度', '800 m'),
  }
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function clampByte(value: number) {
  return Math.round(clamp(value, 0, 255))
}
