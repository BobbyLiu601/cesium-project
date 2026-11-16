import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialShapeSceneId } from '../data/layers'
import { createSpecialShapeScene } from '../demos/specialShapeScene'
import { SOLID_WALL_SHADER } from '../demos/specialShapes/wallScenes'
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  Transforms,
  Viewer,
  cesiumMockState,
  primitiveInstances,
  resetCesiumMock,
  scenePrimitiveRemoves,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createSpecialShapeScene>[0]

const sceneCases: Array<{
  animated: boolean
  entities: number
  id: SpecialShapeSceneId
  primitives: number
  status: RegExp
}> = [
  {
    animated: false,
    entities: 0,
    id: 'frustum',
    primitives: 2,
    status: /红色半透明视锥体/,
  },
  {
    animated: true,
    entities: 4,
    id: 'manual-frustum',
    primitives: 0,
    status: /视锥侧面/,
  },
  {
    animated: true,
    entities: 0,
    id: 'moving-frustum',
    primitives: 1,
    status: /沿航线持续移动/,
  },
  {
    animated: true,
    entities: 1,
    id: 'cone',
    primitives: 0,
    status: /雷达条纹圆锥体/,
  },
  {
    animated: true,
    entities: 1,
    id: 'solid-wall',
    primitives: 0,
    status: /立体墙持续流动/,
  },
  {
    animated: false,
    entities: 209,
    id: 'curve-interpolation',
    primitives: 0,
    status: /Catmull-Rom/,
  },
  {
    animated: false,
    entities: 2,
    id: 'outline-cone',
    primitives: 0,
    status: /轮廓线/,
  },
  {
    animated: true,
    entities: 1,
    id: 'radar-scan',
    primitives: 0,
    status: /雷达圆盘/,
  },
  {
    animated: true,
    entities: 1,
    id: 'electronic-fence',
    primitives: 0,
    status: /电子围栏/,
  },
  {
    animated: true,
    entities: 1,
    id: 'electronic-fence-2',
    primitives: 0,
    status: /电子围栏/,
  },
  {
    animated: true,
    entities: 1,
    id: 'radar-mask-scan',
    primitives: 0,
    status: /半球遮罩/,
  },
]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as SceneViewer
}

function getPreUpdateListenerCount(viewer: SceneViewer) {
  return (
    viewer.scene.preUpdate as unknown as {
      listeners: Set<() => void>
    }
  ).listeners.size
}

describe('special shape scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it.each(sceneCases)(
    'creates, animates when needed, and cleans up $id',
    async ({ animated, entities, primitives, id, status }) => {
      const viewer = createViewer()
      const statuses: string[] = []
      const scene = await createSpecialShapeScene(viewer, id, (message) => statuses.push(message))

      expect(viewer.entities.values).toHaveLength(entities)
      expect(primitiveInstances).toHaveLength(primitives)
      expect(statuses[statuses.length - 1]).toMatch(status)
      expect(scene.animationState?.value).toBe(animated ? 'playing' : undefined)
      expect(typeof scene.toggleAnimation === 'function').toBe(animated)
      expect(getPreUpdateListenerCount(viewer)).toBe(animated ? 1 : 0)

      scene.toggleAnimation?.()
      expect(scene.animationState?.value).toBe(animated ? 'paused' : undefined)
      expect(getPreUpdateListenerCount(viewer)).toBe(0)
      expect(statuses[statuses.length - 1]).toMatch(animated ? /暂停/ : status)

      scene.toggleAnimation?.()
      expect(scene.animationState?.value).toBe(animated ? 'playing' : undefined)
      expect(getPreUpdateListenerCount(viewer)).toBe(animated ? 1 : 0)
      expect(statuses[statuses.length - 1]).toMatch(animated ? /继续|播放/ : status)

      scene.dispose()
      expect(viewer.entities.values).toHaveLength(0)
      expect(getPreUpdateListenerCount(viewer)).toBe(0)
      expect(scenePrimitiveRemoves).toHaveLength(primitives)
      expect(primitiveInstances.filter((primitive) => primitive.destroyed)).toHaveLength(primitives)
    },
  )

  it('falls back to the ellipsoid while keeping the manual frustum usable', async () => {
    cesiumMockState.cesiumTerrainProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const viewer = createViewer()
    const statuses: string[] = []

    const scene = await createSpecialShapeScene(viewer, 'manual-frustum', (message) =>
      statuses.push(message),
    )

    await vi.waitFor(() => {
      expect(statuses[statuses.length - 1]).toContain('已回退椭球地形')
    })
    expect(viewer.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    expect(viewer.entities.values).toHaveLength(4)
    expect(consoleError).toHaveBeenCalledWith(
      '特殊形状地形加载失败，已回退椭球地形。',
      expect.any(Error),
    )

    scene.dispose()
  })

  it('keeps the Mars3D terrain and reports the animated frustum state', async () => {
    const viewer = createViewer()
    const statuses: string[] = []

    const scene = await createSpecialShapeScene(viewer, 'manual-frustum', (message) =>
      statuses.push(message),
    )

    await vi.waitFor(() => {
      expect(statuses[statuses.length - 1]).toContain('已加载 Mars3D 地形')
    })
    expect(viewer.terrainProvider).toBeInstanceOf(CesiumTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(true)
    expect(scene.animationState?.value).toBe('playing')

    scene.dispose()
  })

  it('matches the reference solid wall color without additive emission', () => {
    expect(SOLID_WALL_SHADER).toContain('material.diffuse = (imageColor.rgb + color.rgb) * 0.5;')
    expect(SOLID_WALL_SHADER).not.toContain('material.emission')
  })

  it('keeps the relocated special-shape scenes inside China', async () => {
    const frustumViewer = createViewer()
    const frustumScene = await createSpecialShapeScene(frustumViewer, 'frustum', () => {})

    expect(frustumViewer.camera.setView).toHaveBeenCalledWith({
      destination: {
        height: 3_000,
        latitude: 30,
        longitude: 110,
      },
    })
    frustumScene.dispose()

    const outlineViewer = createViewer()
    const outlineScene = await createSpecialShapeScene(outlineViewer, 'outline-cone', () => {})
    const fillPosition = outlineViewer.entities.values[0]?.position?.getValue()
    const outlinePosition = outlineViewer.entities.values[1]?.position?.getValue()

    expect(fillPosition).toMatchObject({ latitude: 39.909, longitude: 116.397 })
    expect(outlinePosition).toMatchObject({ latitude: 39.909, longitude: 116.396 })
    outlineScene.dispose()

    const manualViewer = createViewer()
    const manualScene = await createSpecialShapeScene(manualViewer, 'manual-frustum', () => {})

    expect(manualViewer.camera.lookAt).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 35, longitude: 95 }),
      expect.anything(),
    )
    const manualHierarchy = (
      manualViewer.entities.values[0]?.polygon?.hierarchy as
        { getValue: () => { positions: unknown[] } } | undefined
    )?.getValue()

    expect(manualHierarchy?.positions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ latitude: 40, longitude: 100 }),
        expect.objectContaining({ latitude: 30, longitude: 100 }),
        expect.objectContaining({ latitude: 35, longitude: 95 }),
      ]),
    )
    manualScene.dispose()

    const movingViewer = createViewer()
    const movingScene = await createSpecialShapeScene(movingViewer, 'moving-frustum', () => {})

    expect(Transforms.eastNorthUpToFixedFrame).toHaveBeenCalledWith(
      expect.objectContaining({ latitude: 39.909, longitude: 116.397 }),
    )
    movingScene.dispose()

    const splineViewer = createViewer()
    const splineScene = await createSpecialShapeScene(splineViewer, 'curve-interpolation', () => {})
    const splinePositions = splineViewer.entities.values
      .slice(0, 5)
      .map((entity) => entity.position?.getValue())

    expect(splinePositions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ latitude: 30, longitude: 110 }),
        expect.objectContaining({ latitude: 31, longitude: 111 }),
        expect.objectContaining({ latitude: 29, longitude: 112 }),
        expect.objectContaining({ latitude: 30, longitude: 114 }),
        expect.objectContaining({ latitude: 28, longitude: 113 }),
      ]),
    )
    splineScene.dispose()
  })
})
