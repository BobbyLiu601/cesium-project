import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { SpecialShapeSceneId } from '../data/layers'
import { createSpecialShapeScene } from '../demos/specialShapeScene'
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
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
})
