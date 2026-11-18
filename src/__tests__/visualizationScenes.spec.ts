import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  HEATMAP_3D_GRID_SIZE,
  HONEYCOMB_COLUMNS,
  HONEYCOMB_ROWS,
  HONEYCOMB_SURFACE_ALPHA,
  OCEAN_FLOW_TRAIL_LENGTH,
  OCEAN_PARTICLE_COUNT,
  heatmap3dSamples,
  heatmap3dColors,
  honeycombCells,
  honeycombColors,
  sampleHeatmap3dField,
  WIND_FLOW_TRAIL_LENGTH,
  WIND_PARTICLE_COUNT,
  windFieldColors,
} from '@/data/dataVisualization'
import {
  isosurfaceGrid,
  overlayPolygonA,
  overlayPolygonB,
  thiessenSamplePoints,
} from '@/data/gisClient'
import { createVisualizationScene } from '@/demos/visualizationScene'
import {
  materialInstances,
  MaterialAppearance,
  PerInstanceColorAppearance,
  primitiveInstances,
  resetCesiumMock,
  scenePrimitiveRemoves,
  Viewer,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createVisualizationScene>[0]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    setStatus: (message: string) => statuses.push(message),
    statuses,
  }
}

function getPreUpdateListenerCount(viewer: Viewer) {
  return (
    viewer.scene.preUpdate as unknown as {
      listeners: Set<() => void>
    }
  ).listeners.size
}

interface AnimatedFlowExpectation {
  expectedMaxBatches: number
  expectedParticles: number
  expectedStatus: RegExp
  expectedLegend: string
  sceneId: 'ocean-current' | 'wind-field'
}

interface FlowGeometrySnapshot {
  indices: Uint32Array
  positions: Float64Array
  textureCoordinates: Float32Array
}

function readFlowGeometry(primitive: (typeof primitiveInstances)[number]): FlowGeometrySnapshot {
  const instance = primitive.options.geometryInstances as {
    options: {
      geometry: {
        options: {
          attributes: {
            position: { options: { values: Float64Array } }
            st: { options: { values: Float32Array } }
          }
          indices: Uint32Array
        }
      }
    }
  }
  const geometry = instance.options.geometry.options

  return {
    indices: geometry.indices,
    positions: geometry.attributes.position.options.values,
    textureCoordinates: geometry.attributes.st.options.values,
  }
}

function getTrailVertexCounts(geometry: FlowGeometrySnapshot) {
  const starts: number[] = []
  let previousProgress: number | undefined
  for (let index = 0; index < geometry.textureCoordinates.length; index += 2) {
    const progress = geometry.textureCoordinates[index] ?? 0
    if (progress === 0 && previousProgress !== 0) {
      starts.push(index / 2)
    }
    previousProgress = progress
  }

  const totalVertices = geometry.positions.length / 3
  starts.push(totalVertices)
  return starts.slice(0, -1).map((start, index) => (starts[index + 1] ?? totalVertices) - start)
}

async function expectAnimatedFlowScene(
  viewer: SceneViewer,
  {
    expectedLegend,
    expectedMaxBatches,
    expectedParticles,
    expectedStatus,
    sceneId,
  }: AnimatedFlowExpectation,
) {
  const mockViewer = viewer as unknown as Viewer
  const { setStatus, statuses } = collectStatus()
  const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)

  try {
    const scene = await createVisualizationScene(viewer, sceneId, setStatus)
    const flowPrimitives = [...primitiveInstances]
    const geometries = flowPrimitives.map(readFlowGeometry)
    const trailVertexCounts = geometries.flatMap(getTrailVertexCounts)

    expect(flowPrimitives).toHaveLength(materialInstances.length)
    expect(flowPrimitives.length).toBeGreaterThan(1)
    expect(flowPrimitives.length).toBeLessThanOrEqual(expectedMaxBatches)
    expect(trailVertexCounts).toHaveLength(expectedParticles)
    expect(Math.min(...trailVertexCounts)).toBeGreaterThanOrEqual(80)
    expect(geometries.every((geometry) => geometry.indices.length > 0)).toBe(true)
    expect(scene.legend?.title).toBe(expectedLegend)
    expect(statuses[statuses.length - 1]).toMatch(expectedStatus)
    expect(scene.animationState?.value).toBe('playing')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(1)
    const heatLayerImage = (
      mockViewer.entities.values.find((entity) => entity.rectangle)?.rectangle?.material as
        { options?: { image?: string } } | undefined
    )?.options?.image

    const initialTimes = materialInstances.map(
      (material) => material.uniforms.animationTime as number,
    )
    expect(initialTimes).toEqual(initialTimes.map(() => 0))
    now.mockReturnValue(1_200)
    mockViewer.scene.preUpdate.raiseEvent()
    const advancedTimes = materialInstances.map(
      (material) => material.uniforms.animationTime as number,
    )
    expect(Math.min(...advancedTimes)).toBeGreaterThan(0)
    expect(new Set(advancedTimes)).toEqual(new Set([advancedTimes[0]]))
    expect(mockViewer.scene.requestRender).toHaveBeenCalled()
    expect(primitiveInstances).toHaveLength(flowPrimitives.length)
    for (const [index, primitive] of flowPrimitives.entries()) {
      expect(primitiveInstances[index]).toBe(primitive)
    }

    scene.toggleAnimation?.()
    expect(scene.animationState?.value).toBe('paused')
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(statuses[statuses.length - 1]).toMatch(/已暂停/)
    const pausedTimes = materialInstances.map(
      (material) => material.uniforms.animationTime as number,
    )
    now.mockReturnValue(1_500)
    mockViewer.scene.preUpdate.raiseEvent()
    expect(materialInstances.map((material) => material.uniforms.animationTime as number)).toEqual(
      pausedTimes,
    )

    scene.toggleAnimation?.()
    expect(scene.animationState?.value).toBe('playing')
    expect(statuses[statuses.length - 1]).toMatch(/继续|播放中/)
    expect(getPreUpdateListenerCount(mockViewer)).toBe(1)

    let previousTime = materialInstances[0]?.uniforms.animationTime as number
    let wrapped = false
    for (let index = 0; index < 120; index += 1) {
      now.mockReturnValue(1_600 + index * 100)
      mockViewer.scene.preUpdate.raiseEvent()
      const currentTime = materialInstances[0]?.uniforms.animationTime as number
      wrapped ||= currentTime < previousTime
      previousTime = currentTime
    }
    expect(wrapped).toBe(true)

    scene.dispose()
    expect(getPreUpdateListenerCount(mockViewer)).toBe(0)
    expect(mockViewer.entities.values).toHaveLength(0)
    for (const primitive of flowPrimitives) {
      expect(scenePrimitiveRemoves).toContain(primitive)
    }

    return { heatLayerImage }
  } finally {
    now.mockRestore()
  }
}

describe('GIS client visualization scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it('renders both source polygons, their intersection, and the measured area', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'overlay-analysis', setStatus)

    expect(mockViewer.entities.values).toHaveLength(4)
    expect(mockViewer.entities.values.map((entity) => entity.id)).toEqual(
      expect.arrayContaining([
        'overlay-source-a-0',
        'overlay-source-b-0',
        'overlay-intersection-0',
        'overlay-area-label',
      ]),
    )
    expect(statuses[statuses.length - 1]).toMatch(/面积 [\d,]+ 平方米/)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()
    expect(scene.actions).toEqual([])

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('builds a deterministic TIN with fixed sample markers', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'thiessen-polygon', setStatus)

    expect(thiessenSamplePoints).toHaveLength(54)
    expect(mockViewer.entities.values.length).toBeGreaterThan(thiessenSamplePoints.length)
    expect(statuses[statuses.length - 1]).toContain('54 个固定采样点')
    expect(statuses[statuses.length - 1]).toMatch(/TIN 三角面/)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('renders fixed-grid isobands and isolines with a complete legend range', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'isosurface', setStatus)

    expect(isosurfaceGrid).toHaveLength(300)
    expect(mockViewer.entities.values.length).toBeGreaterThan(10)
    expect(statuses[statuses.length - 1]).toContain('10 级固定风场等值面')
    expect(statuses[statuses.length - 1]).toContain('300 个采样点')
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()

    scene.dispose()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('cancels before adding geometry when the scene request is aborted', async () => {
    const viewer = createViewer()
    const controller = new AbortController()
    const { setStatus } = collectStatus()
    controller.abort()

    await expect(
      createVisualizationScene(viewer, 'overlay-analysis', setStatus, {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: 'AbortError' })
    expect((viewer as unknown as Viewer).entities.values).toHaveLength(0)
  })

  it('keeps the reference overlay coordinates fixed after the intersection calculation', async () => {
    const polygonASnapshot = overlayPolygonA.map((coordinate) => [...coordinate])
    const polygonBSnapshot = overlayPolygonB.map((coordinate) => [...coordinate])
    const viewer = createViewer()
    const { setStatus } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'overlay-analysis', setStatus)

    expect(overlayPolygonA).toHaveLength(6)
    expect(overlayPolygonB).toHaveLength(5)
    expect(overlayPolygonA[0]).toEqual([117.182288, 31.854164])
    expect(overlayPolygonB[0]).toEqual([117.267046, 31.842971])
    expect(overlayPolygonA).toEqual(polygonASnapshot)
    expect(overlayPolygonB).toEqual(polygonBSnapshot)

    scene.dispose()
  })

  it('renders a dense continuous 3D heatmap surface with shaded texture and a skirt', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, '3d-heatmap', setStatus)

    expect(heatmap3dSamples).toHaveLength(50)
    expect(sampleHeatmap3dField(116.46, 39.92)).toBe(sampleHeatmap3dField(116.46, 39.92))
    expect(HEATMAP_3D_GRID_SIZE).toBeGreaterThanOrEqual(128)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(2)
    const surface = primitiveInstances[0]
    const skirt = primitiveInstances[1]
    const surfaceInstance = surface?.options.geometryInstances as {
      options?: { geometry?: { options?: { attributes?: Record<string, unknown> } } }
    }
    const positions = (
      surfaceInstance.options?.geometry?.options?.attributes?.position as {
        options?: { values?: Float64Array }
      }
    )?.options?.values

    expect(positions?.length).toBe(HEATMAP_3D_GRID_SIZE ** 2 * 3)
    expect(skirt?.options.appearance).toBeInstanceOf(MaterialAppearance)
    expect(materialInstances[0]?.options.fabric.uniforms.image).toMatch(/^data:image\/png;base64,/)
    expect(statuses[statuses.length - 1]).toContain(
      `${HEATMAP_3D_GRID_SIZE} × ${HEATMAP_3D_GRID_SIZE} 网格的三维热力地形`,
    )
    expect(scene.animationState).toBeUndefined()
    expect(scene.toggleAnimation).toBeUndefined()
    expect(scene.legend).toEqual({
      colors: heatmap3dColors,
      maximumLabel: '1',
      minimumLabel: '0',
      title: '三维热力强度',
    })

    scene.dispose()
    expect(scenePrimitiveRemoves).toContain(surface)
    expect(scenePrimitiveRemoves).toContain(skirt)
  })

  it('renders a deterministic fine-grained honeycomb surface in one batched primitive', async () => {
    const viewer = createViewer()
    const mockViewer = viewer as unknown as Viewer
    const { setStatus, statuses } = collectStatus()
    const scene = await createVisualizationScene(viewer, 'honeycomb-heatmap', setStatus)

    expect(HONEYCOMB_COLUMNS).toBeGreaterThanOrEqual(40)
    expect(HONEYCOMB_ROWS).toBeGreaterThanOrEqual(40)
    expect(honeycombCells).toHaveLength(HONEYCOMB_COLUMNS * HONEYCOMB_ROWS)
    expect(new Set(honeycombCells.map((cell) => cell.height.toFixed(3))).size).toBeGreaterThan(1200)
    expect(mockViewer.entities.values).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(1)
    expect(primitiveInstances[0]?.options.geometryInstances).toHaveLength(honeycombCells.length)
    const firstHoneycombInstance = (
      primitiveInstances[0]!.options.geometryInstances as Array<{
        options: {
          attributes: {
            color: {
              color: {
                alpha: number
              }
            }
          }
          geometry: { options: { extrudedHeight: number } }
        }
      }>
    )[0]!
    const appearance = primitiveInstances[0]?.options.appearance
    expect(appearance).toBeInstanceOf(PerInstanceColorAppearance)
    expect((appearance as PerInstanceColorAppearance).options?.translucent).toBe(true)
    expect(firstHoneycombInstance.options.attributes.color.color.alpha).toBeCloseTo(
      HONEYCOMB_SURFACE_ALPHA,
    )
    expect(firstHoneycombInstance.options.geometry.options.extrudedHeight).toEqual(
      expect.any(Number),
    )
    expect(statuses[statuses.length - 1]).toContain(
      `${HONEYCOMB_COLUMNS} × ${HONEYCOMB_ROWS} 个固定网格热力单元`,
    )
    expect(scene.animationState).toBeUndefined()
    expect(scene.legend).toEqual({
      colors: honeycombColors,
      maximumLabel: '800 m',
      minimumLabel: '0',
      title: '蜂窝热力强度',
    })

    scene.dispose()
    expect(scenePrimitiveRemoves).toContain(primitiveInstances[0])
  })

  it('lays an ocean speed heat layer under long animated currents', async () => {
    const { heatLayerImage } = await expectAnimatedFlowScene(createViewer(), {
      expectedLegend: '海流速度',
      expectedMaxBatches: 7 * 4,
      expectedParticles: OCEAN_PARTICLE_COUNT,
      expectedStatus: /海流速度热力图.*260 条确定性流线.*东亚至西太平洋/,
      sceneId: 'ocean-current',
    })

    expect(heatLayerImage).toMatch(/^data:image\/png;base64,/)
    expect(OCEAN_FLOW_TRAIL_LENGTH).toBeGreaterThanOrEqual(120)
  })

  it('renders dense long wind trails in batched animation primitives', async () => {
    const { heatLayerImage } = await expectAnimatedFlowScene(createViewer(), {
      expectedLegend: '风速',
      expectedMaxBatches: 15 * 4,
      expectedParticles: WIND_PARTICLE_COUNT,
      expectedStatus: /风粒子场.*2000 条带渐隐拖尾的确定性粒子.*中国及周边区域/,
      sceneId: 'wind-field',
    })

    expect(heatLayerImage).toBeUndefined()
    expect(WIND_PARTICLE_COUNT).toBeGreaterThanOrEqual(2000)
    expect(windFieldColors).toHaveLength(15)
    expect(WIND_FLOW_TRAIL_LENGTH).toBeGreaterThanOrEqual(120)
  })
})
