import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

import { createEffectsScene } from '../demos/effectsScene'
import {
  NEAR_GROUND_SKYBOX_THRESHOLD,
  createNearGroundSkyboxScene,
} from '../demos/effects/nearGroundSkyboxScene'
import { createThunderAudio } from '../demos/effects/thunderAudio'
import type { ThunderAudioController, ThunderAudioState } from '../demos/effects/types'
import {
  CesiumTerrainProvider,
  EllipsoidTerrainProvider,
  Viewer,
  billboardCollectionInstances,
  cesiumMockState,
  postProcessStageInstances,
  resetCesiumMock,
  scenePrimitiveRemoves,
  skyBoxInstances,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

type SceneViewer = Parameters<typeof createEffectsScene>[0]

function createViewer() {
  return new Viewer(document.createElement('div'), {})
}

function asSceneViewer(viewer: Viewer) {
  return viewer as unknown as SceneViewer
}

function collectStatus() {
  const statuses: string[] = []
  return {
    statuses,
    setStatus: (message: string) => statuses.push(message),
  }
}

function captureRejection(promise: Promise<unknown>) {
  return promise.then(
    () => {
      throw new Error('Expected the scene creation to reject')
    },
    (error: unknown) => error,
  )
}

describe('scene effects', () => {
  beforeEach(() => {
    resetCesiumMock()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('loads the local six-face skybox and restores the original sky on dispose', async () => {
    const viewer = createViewer()
    const originalSkyBox = {}
    viewer.scene.skyBox = originalSkyBox
    const { setStatus, statuses } = collectStatus()

    const scene = await createEffectsScene(asSceneViewer(viewer), 'skybox', setStatus)
    const skyBox = skyBoxInstances[0]!
    const sources = skyBox.options.sources as Record<string, string>

    expect(viewer.scene.skyBox).toBe(skyBox)
    expect(skyBoxInstances).toHaveLength(1)
    expect(Object.keys(sources).sort()).toEqual([
      'negativeX',
      'negativeY',
      'negativeZ',
      'positiveX',
      'positiveY',
      'positiveZ',
    ])
    expect(Object.values(sources).every((source) => source.includes('/skyboxes/sky/'))).toBe(true)
    expect(viewer.camera.setView).toHaveBeenCalledWith({
      destination: {
        height: 20_000_000,
        latitude: 39.9060534,
        longitude: -95.166493,
      },
    })
    expect(statuses[statuses.length - 1]).toContain('本地六面天空盒')

    scene.dispose()
    expect(viewer.scene.skyBox).toBe(originalSkyBox)
    expect(skyBox.destroyed).toBe(true)
  })

  it('switches the near-ground skybox at the height threshold and removes its listener', async () => {
    const viewer = createViewer()
    const originalSkyBox = {}
    viewer.scene.skyBox = originalSkyBox
    viewer.scene.skyAtmosphere!.show = false
    const { setStatus, statuses } = collectStatus()

    const scene = createNearGroundSkyboxScene(asSceneViewer(viewer), { setStatus })
    const skyBox = skyBoxInstances[0]!

    expect(scene.nearGroundControls?.mode.value).toBe('near-ground')
    expect(viewer.scene.skyBox).toBe(skyBox)
    expect(viewer.scene.skyAtmosphere?.show).toBe(false)
    expect(viewer.scene.postRender.listeners.size).toBe(1)

    viewer.camera.positionCartographic.height = NEAR_GROUND_SKYBOX_THRESHOLD + 1
    viewer.scene.postRender.raiseEvent()

    expect(scene.nearGroundControls?.mode.value).toBe('atmosphere')
    expect(viewer.scene.skyBox).toBe(originalSkyBox)
    expect(viewer.scene.skyAtmosphere?.show).toBe(true)
    expect(statuses[statuses.length - 1]).toContain('恢复标准天空与大气')

    viewer.camera.setView.mockImplementation((options) => {
      const destination = (options as { destination?: { height?: number } }).destination
      if (typeof destination?.height === 'number') {
        viewer.camera.positionCartographic.height = destination.height
      }
    })
    await scene.actions[0]?.run()
    expect(scene.nearGroundControls?.mode.value).toBe('near-ground')
    expect(viewer.scene.skyBox).toBe(skyBox)

    scene.dispose()
    expect(viewer.scene.postRender.listeners.size).toBe(0)
    expect(viewer.scene.skyBox).toBe(originalSkyBox)
    expect(viewer.scene.skyAtmosphere?.show).toBe(false)
    expect(skyBox.destroyed).toBe(true)
  })

  it('updates volumetric cloud dimensions and brightness within the reference ranges', async () => {
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()

    const scene = await createEffectsScene(asSceneViewer(viewer), 'volumetric-cloud', setStatus)
    const collection = billboardCollectionInstances[0]!
    const cloud = collection.items[0]!
    const initialColor = cloud.color as { alpha: number }

    expect(billboardCollectionInstances).toHaveLength(1)
    expect(collection.items).toHaveLength(1)
    expect(cloud).toMatchObject({ height: 350, sizeInMeters: true, width: 600 })
    expect(cloud.image).toEqual(expect.stringContaining('cumulus-cloud.png'))
    expect(initialColor.alpha).toBeCloseTo(0.88)
    expect(viewer.camera.flyTo).toHaveBeenCalledOnce()
    expect(statuses[statuses.length - 1]).toContain('可实时调整尺寸与亮度')

    scene.cloudControls?.setScale(120, 80)
    scene.cloudControls?.setBrightness(0.42)

    expect(cloud).toMatchObject({ height: 80, width: 120 })
    expect((cloud.color as { alpha: number }).alpha).toBeCloseTo((0.32 + 0.42 * 0.68) * 0.88)

    scene.cloudControls?.setScale(1, 9_999)
    scene.cloudControls?.setBrightness(-1)
    expect(cloud).toMatchObject({ height: 1_500, width: 5 })
    expect((cloud.color as { alpha: number }).alpha).toBeCloseTo(0.32 * 0.88)

    scene.dispose()
    expect(collection.show).toBe(false)
    expect(scenePrimitiveRemoves).toContain(collection)
    expect(collection.destroyed).toBe(true)
  })

  it('starts lightning animation and audio immediately and releases both on dispose', async () => {
    vi.useFakeTimers()
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const state = ref<ThunderAudioState>('idle')
    const audio: ThunderAudioController = {
      dispose: vi.fn<() => void>(),
      play: vi.fn<() => Promise<void>>(async () => {
        state.value = 'playing'
      }),
      state,
    }

    const scene = await createEffectsScene(asSceneViewer(viewer), 'lightning', setStatus, {
      createAudio: () => audio,
    })

    expect(audio.play).toHaveBeenCalledOnce()
    expect(scene.audioState?.value).toBe('playing')
    expect(scene.retryAudio).toBe(audio.play)
    expect(viewer.scene.postProcessStages.stages.map((stage) => stage.options.name)).toEqual([
      'effect_rain',
      'effect_lightning',
    ])
    expect(viewer.scene.postProcessStages.stages[1]?.options.fragmentShader).toContain(
      'segmentDistance',
    )
    expect(viewer.scene.postProcessStages.stages[1]?.options.uniforms).toMatchObject({
      u_flash: expect.any(Function),
      u_seed: expect.any(Function),
    })
    expect(viewer.scene.preUpdate.listeners.size).toBe(1)
    expect(statuses[statuses.length - 1]).toContain('雷声默认开启并循环')

    const requestRender = vi.mocked(viewer.scene.requestRender)
    requestRender.mockClear()
    await vi.advanceTimersByTimeAsync(1_300)
    expect(requestRender).toHaveBeenCalled()

    scene.dispose()
    expect(viewer.scene.preUpdate.listeners.size).toBe(0)
    expect(viewer.scene.postProcessStages.stages).toHaveLength(0)
    expect(postProcessStageInstances.every((stage) => stage.destroyed)).toBe(true)
    expect(audio.dispose).toHaveBeenCalledOnce()
  })

  it('reports blocked thunder playback and succeeds when retried', async () => {
    const play = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('autoplay blocked'))
      .mockResolvedValueOnce(undefined)
    const audioElement = {
      load: vi.fn<() => void>(),
      loop: false,
      pause: vi.fn<() => void>(),
      play,
      preload: '',
      removeAttribute: vi.fn<(name: string) => void>(),
      volume: 1,
    } as unknown as HTMLAudioElement
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const audio = createThunderAudio({ createElement: () => audioElement })

    await audio.play()
    expect(audio.state.value).toBe('blocked')
    expect(consoleWarn).toHaveBeenCalledOnce()

    await audio.play()
    expect(audio.state.value).toBe('playing')
    expect(audioElement.loop).toBe(true)
    expect(audioElement.preload).toBe('auto')
    expect(audioElement.volume).toBe(0.72)

    audio.dispose()
    expect(audioElement.pause).toHaveBeenCalledOnce()
    expect(audioElement.removeAttribute).toHaveBeenCalledWith('src')
    expect(audioElement.load).toHaveBeenCalledOnce()
    expect(audio.state.value).toBe('idle')
  })

  it('loads terrain for height fog and destroys its post-process stage on dispose', async () => {
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()
    const scene = await createEffectsScene(asSceneViewer(viewer), 'height-fog', setStatus)
    const stage = postProcessStageInstances[0]!

    expect(viewer.terrainProvider).toBeInstanceOf(CesiumTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(true)
    expect(viewer.scene.postProcessStages.stages).toContain(stage)
    expect(stage.options.name).toBe('effect_height_fog')
    expect(statuses[statuses.length - 1]).toContain('已加载 Mars3D 地形与高度雾')

    scene.dispose()
    expect(viewer.scene.postProcessStages.stages).toHaveLength(0)
    expect(stage.destroyed).toBe(true)
  })

  it('falls back to ellipsoid terrain while retaining the height fog effect', async () => {
    cesiumMockState.cesiumTerrainProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const viewer = createViewer()
    const { setStatus, statuses } = collectStatus()

    const scene = await createEffectsScene(asSceneViewer(viewer), 'height-fog', setStatus)
    const stage = postProcessStageInstances[0]!

    expect(viewer.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    expect(viewer.scene.postProcessStages.stages).toContain(stage)
    expect(statuses[statuses.length - 1]).toContain('已回退椭球地形')
    expect(consoleError).toHaveBeenCalledOnce()

    scene.dispose()
    expect(stage.destroyed).toBe(true)
  })

  it('removes an added height fog stage when terrain loading is cancelled', async () => {
    let resolveTerrain!: (provider: CesiumTerrainProvider) => void
    cesiumMockState.cesiumTerrainProviderPromise = new Promise((resolve) => {
      resolveTerrain = resolve
    })
    const viewer = createViewer()
    const controller = new AbortController()
    const { setStatus } = collectStatus()
    const pending = createEffectsScene(asSceneViewer(viewer), 'height-fog', setStatus, {
      signal: controller.signal,
    })
    const rejection = captureRejection(pending)

    await vi.waitFor(() => {
      expect(postProcessStageInstances).toHaveLength(1)
    })
    controller.abort()

    await expect(rejection).resolves.toMatchObject({ name: 'AbortError' })
    expect(viewer.scene.postProcessStages.stages).toHaveLength(0)
    expect(postProcessStageInstances[0]?.destroyed).toBe(true)

    resolveTerrain(new CesiumTerrainProvider('https://data.mars3d.cn/terrain'))
  })
})
