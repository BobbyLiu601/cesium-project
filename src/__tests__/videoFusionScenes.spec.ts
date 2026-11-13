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
import type { VideoFusionPlayback, VideoFusionSource } from '../demos/spatial/videoFusionPlayback'

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
  emitSourceChange: (source: VideoFusionSource) => void
} {
  const start = vi.fn<() => Promise<void>>(() => Promise.resolve())
  const dispose = vi.fn<() => void>()
  let sourceListener: ((source: VideoFusionSource) => void) | undefined

  return {
    playback: {
      dispose,
      element: document.createElement('video'),
      start,
      subscribeSourceChange: vi.fn<(listener: (source: VideoFusionSource) => void) => () => void>(
        (listener) => {
          sourceListener = listener
          return () => {
            sourceListener = undefined
          }
        },
      ),
    },
    start,
    dispose,
    emitSourceChange(source) {
      sourceListener?.(source)
    },
  }
}

function setVideoDimensions(element: HTMLVideoElement, width: number, height: number) {
  Object.defineProperty(element, 'videoWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'videoHeight', { configurable: true, value: height })
}

function getPrimitiveFrustum(index: number) {
  const geometryInstance = primitiveInstances[index]?.options.geometryInstances as
    | { options?: { geometry?: { options?: { frustum?: { options?: Record<string, number> } } } } }
    | undefined

  return geometryInstance?.options?.geometry?.options?.frustum?.options
}

function getPrimitiveMaterialImage(index: number) {
  const appearance = primitiveInstances[index]?.options.appearance as
    { options?: { material?: { uniforms?: { image?: unknown } } } } | undefined

  return appearance?.options?.material?.uniforms?.image
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

  it('frames and draws the projection face after video metadata is available', async () => {
    const viewer = createViewer()
    const { playback, start, dispose } = createPlayback()
    const { setStatus, statuses } = collectStatus()

    const scene = await createVideoFusionScene(viewer, 'video-projection-livestream', setStatus, {
      playback,
    })
    const mockViewer = viewer as unknown as Viewer

    expect(start).toHaveBeenCalledOnce()
    expect(mockViewer.camera.viewBoundingSphere).toHaveBeenCalledOnce()
    const [projectionSphere, projectionOffset] =
      mockViewer.camera.viewBoundingSphere.mock.calls[0] ?? []
    expect(projectionSphere).toMatchObject({
      center: {
        height: 30,
        latitude: 33.247659,
        longitude: 112.66669,
      },
    })
    expect((projectionSphere as { radius?: number } | undefined)?.radius).toBeGreaterThan(800)
    expect(projectionOffset).toMatchObject({
      heading: expect.closeTo(4.702, 3),
      pitch: expect.closeTo(-0.506, 3),
      range: 0,
    })
    expect(primitiveInstances).toHaveLength(1)

    setVideoDimensions(playback.element, 1_280, 720)
    playback.element.dispatchEvent(new Event('loadedmetadata'))

    expect(primitiveInstances).toHaveLength(2)
    expect(scenePrimitiveAdds).toHaveLength(2)

    const outlineFrustum = getPrimitiveFrustum(0)
    const faceFrustum = getPrimitiveFrustum(1)
    expect(faceFrustum?.fov).toBeCloseTo(Math.PI / 3)
    expect(faceFrustum?.aspectRatio).toBeCloseTo(Math.tan(Math.PI / 6) / Math.tan(Math.PI / 9))
    expect((faceFrustum?.far ?? 0) - (faceFrustum?.near ?? 0)).toBeCloseTo(0.01, 1)
    expect(getPrimitiveMaterialImage(1)).toBe(playback.element)
    expect(outlineFrustum?.near).toBeCloseTo((outlineFrustum?.far ?? 0) * 0.0001, 4)
    expect(outlineFrustum?.far).toBeGreaterThan(1_000)
    expect(statuses[statuses.length - 1]).toContain('60° × 40° 视锥')

    scene.dispose()

    expect(scenePrimitiveRemoves).toHaveLength(2)
    expect(primitiveInstances.every((primitive) => primitive.destroyed === true)).toBe(true)
    expect(dispose).toHaveBeenCalledOnce()
  })

  it('rebuilds the projection face when the playback source changes dimensions', async () => {
    const viewer = createViewer()
    const { playback, emitSourceChange } = createPlayback()
    const { setStatus } = collectStatus()

    const scene = await createVideoFusionScene(viewer, 'video-projection-livestream', setStatus, {
      playback,
    })

    setVideoDimensions(playback.element, 1_280, 720)
    playback.element.dispatchEvent(new Event('loadedmetadata'))
    const firstFace = primitiveInstances[1]
    expect(scenePrimitiveAdds).toHaveLength(2)

    setVideoDimensions(playback.element, 960, 540)
    emitSourceChange('live')

    expect(firstFace?.destroyed).toBe(true)
    expect(scenePrimitiveAdds).toHaveLength(3)
    expect(scenePrimitiveRemoves).toHaveLength(1)

    scene.dispose()

    expect(primitiveInstances.every((primitive) => primitive.destroyed === true)).toBe(true)
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
