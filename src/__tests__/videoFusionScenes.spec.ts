import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  primitiveInstances,
  resetCesiumMock,
  scenePrimitiveAdds,
  scenePrimitiveRemoves,
  Viewer,
} from './mocks/cesium'
import {
  createVideoFusionScene,
  type CreateVideoFusionSceneOptions,
} from '../demos/spatial/videoFusionScene'
import type { VideoFusionPlayback } from '../demos/spatial/videoFusionPlayback'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createVideoFusionScene>[0]

function createViewer() {
  return new Viewer(document.createElement('div'), {}) as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    statuses,
    setStatus: (message: string) => statuses.push(message),
  }
}

function createPlayback(): {
  playback: VideoFusionPlayback
  start: ReturnType<typeof vi.fn<() => Promise<void>>>
  dispose: ReturnType<typeof vi.fn<() => void>>
} {
  const start = vi.fn<() => Promise<void>>(() => Promise.resolve())
  const dispose = vi.fn<() => void>()

  return {
    playback: {
      dispose,
      element: document.createElement('video'),
      start,
    },
    start,
    dispose,
  }
}

function getPrimitiveFrustum(index: number) {
  const geometryInstance = primitiveInstances[index]?.options.geometryInstances as
    | { options?: { geometry?: { options?: { frustum?: { options?: Record<string, number> } } } } }
    | undefined

  return geometryInstance?.options?.geometry?.options?.frustum?.options
}

function getPolygonMaterialImage(entity: { polygon?: Record<string, unknown> } | undefined) {
  const material = entity?.polygon?.material
  if (!material || typeof material !== 'object') {
    return undefined
  }

  return (material as { options?: { image?: HTMLVideoElement } }).options?.image
}

describe('video fusion scenes', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  it('maps one local video onto a facade and a ground plane', async () => {
    const viewer = createViewer()
    const { playback, start, dispose } = createPlayback()
    const { setStatus, statuses } = collectStatus()

    const scene = await createVideoFusionScene(viewer, 'video-texture', setStatus, {
      playback,
    })
    const mockViewer = viewer as unknown as Viewer

    expect(start).toHaveBeenCalledOnce()
    expect(mockViewer.entities.values).toHaveLength(2)
    expect(mockViewer.entities.values.map((entity) => entity.id)).toEqual([
      'video-texture-facade',
      'video-texture-plane',
    ])
    expect(mockViewer.entities.values[0]?.polygon?.perPositionHeight).toBe(true)
    expect(getPolygonMaterialImage(mockViewer.entities.values[0])).toBe(playback.element)
    expect(getPolygonMaterialImage(mockViewer.entities.values[1])).toBe(playback.element)
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalled()
    expect(statuses[statuses.length - 1]).toContain('立体立面与平面')
    expect(scene.attribution).toContain('CC BY 3.0')

    scene.dispose()

    expect(dispose).toHaveBeenCalledOnce()
    expect(mockViewer.entities.values).toHaveLength(0)
  })

  it('draws a fixed 60 by 40 degree projection frustum and cleans it up', async () => {
    const viewer = createViewer()
    const { playback, start, dispose } = createPlayback()
    const { setStatus, statuses } = collectStatus()

    const scene = await createVideoFusionScene(viewer, 'video-projection-livestream', setStatus, {
      playback,
    })
    const mockViewer = viewer as unknown as Viewer

    expect(start).toHaveBeenCalledOnce()
    expect(mockViewer.camera.setView).toHaveBeenCalledOnce()
    expect(mockViewer.camera.setView.mock.calls[0]?.[0]).toMatchObject({
      destination: {
        height: 1_300,
        latitude: 33.248737,
        longitude: 112.681287,
      },
      orientation: {
        heading: expect.closeTo(4.702, 3),
        pitch: expect.closeTo(-0.506, 3),
        roll: 0,
      },
    })
    expect(primitiveInstances).toHaveLength(2)
    expect(scenePrimitiveAdds).toHaveLength(2)

    const faceFrustum = getPrimitiveFrustum(0)
    const outlineFrustum = getPrimitiveFrustum(1)
    expect(faceFrustum?.fov).toBeCloseTo(Math.PI / 3)
    expect(faceFrustum?.aspectRatio).toBeCloseTo(Math.tan(Math.PI / 6) / Math.tan(Math.PI / 9))
    expect((faceFrustum?.far ?? 0) - (faceFrustum?.near ?? 0)).toBeCloseTo(0.01, 1)
    expect(outlineFrustum?.near).toBeCloseTo((outlineFrustum?.far ?? 0) * 0.0001, 4)
    expect(outlineFrustum?.far).toBeGreaterThan(1_000)
    expect(statuses[statuses.length - 1]).toContain('60° × 40° 视锥')

    scene.dispose()

    expect(scenePrimitiveRemoves).toHaveLength(2)
    expect(primitiveInstances.every((primitive) => primitive.destroyed === true)).toBe(true)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('disposes the scene when playback startup fails', async () => {
    const viewer = createViewer()
    const { playback, start, dispose } = createPlayback()
    const { setStatus } = collectStatus()
    start.mockRejectedValueOnce(new Error('video start failed'))

    await expect(
      createVideoFusionScene(viewer, 'video-texture', setStatus, {
        playback,
      } satisfies CreateVideoFusionSceneOptions),
    ).rejects.toThrow('video start failed')

    expect(dispose).toHaveBeenCalledOnce()
    expect((viewer as unknown as Viewer).entities.values).toHaveLength(0)
  })
})
