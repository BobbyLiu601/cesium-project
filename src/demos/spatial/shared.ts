import * as Cesium from 'cesium'

const SPATIAL_TERRAIN_URL = 'https://data.mars3d.cn/terrain'
const TERRAIN_LOAD_TIMEOUT_MS = 12_000

interface TerrainLoadResult {
  provider: Cesium.TerrainProvider
  loaded: boolean
}

interface WaitForLoadOptions<T> {
  signal?: AbortSignal
  timeoutMs?: number
  timeoutMessage?: string
  onDiscard?: (value: T) => void
}

export function createAbortError() {
  return new DOMException('空间分析场景加载已取消', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createAbortError()
  }
}

function discardLateResult<T>(promise: Promise<T>, onDiscard: ((value: T) => void) | undefined) {
  if (!onDiscard) {
    return
  }

  void promise.then(onDiscard).catch(() => undefined)
}

/**
 * Waits for an async Cesium resource while guaranteeing that a result arriving
 * after cancellation or timeout is handed to the caller's cleanup callback.
 */
export async function waitForLoad<T>(
  promise: Promise<T>,
  options: WaitForLoadOptions<T> = {},
): Promise<T> {
  const { signal, timeoutMs, timeoutMessage = '资源加载超时', onDiscard } = options

  if (signal?.aborted) {
    discardLateResult(promise, onDiscard)
    throw createAbortError()
  }

  if (!signal && timeoutMs === undefined) {
    return promise
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const loads: Array<Promise<T>> = [promise]

  if (signal) {
    loads.push(
      new Promise<never>((_, reject) => {
        abortHandler = () => reject(createAbortError())
        signal.addEventListener('abort', abortHandler, { once: true })
      }),
    )
  }

  if (timeoutMs !== undefined) {
    loads.push(
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs)
      }),
    )
  }

  try {
    return await Promise.race(loads)
  } catch (error) {
    discardLateResult(promise, onDiscard)
    throw error
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    if (abortHandler) {
      signal?.removeEventListener('abort', abortHandler)
    }
  }
}

export function setSceneDefaults(viewer: Cesium.Viewer) {
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07111f')
  viewer.scene.globe.enableLighting = false
  viewer.shadows = false
  viewer.clock.shouldAnimate = false
}

export function clamp01(value: number) {
  return Math.min(1, Math.max(0, value))
}

export function getPublicAssetUrl(path: string) {
  const baseUrl = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`
  return `${baseUrl}${path.replace(/^\//, '')}`
}

export function frameBoundingSphere(
  viewer: Cesium.Viewer,
  sphere: Cesium.BoundingSphere,
  headingDegrees: number,
  pitchDegrees: number,
  rangeFactor: number,
) {
  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(headingDegrees),
      Cesium.Math.toRadians(pitchDegrees),
      Math.max(650, sphere.radius * rangeFactor),
    ),
  )
}

export function framePositions(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  headingDegrees: number,
  pitchDegrees: number,
  rangeFactor: number,
) {
  if (positions.length === 0) {
    return
  }

  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  frameBoundingSphere(viewer, sphere, headingDegrees, pitchDegrees, rangeFactor)
}

export function createContinuousRenderTicker(viewer: Cesium.Viewer) {
  const tick = () => viewer.scene.requestRender()
  viewer.scene.preUpdate.addEventListener(tick)
  return () => viewer.scene.preUpdate.removeEventListener(tick)
}

export async function loadSpatialTerrain(
  viewer: Cesium.Viewer,
  signal?: AbortSignal,
): Promise<TerrainLoadResult> {
  try {
    throwIfAborted(signal)
    const providerPromise = Cesium.CesiumTerrainProvider.fromUrl(SPATIAL_TERRAIN_URL)
    const terrainProvider = await waitForLoad(providerPromise, {
      signal,
      timeoutMs: TERRAIN_LOAD_TIMEOUT_MS,
      timeoutMessage: '空间分析地形加载超时',
    })
    throwIfAborted(signal)
    viewer.terrainProvider = terrainProvider
    viewer.scene.globe.depthTestAgainstTerrain = true
    return { provider: terrainProvider, loaded: true }
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError()
    }

    console.error('空间分析地形加载失败，已回退椭球地形。', error)
    const provider = new Cesium.EllipsoidTerrainProvider()
    viewer.terrainProvider = provider
    viewer.scene.globe.depthTestAgainstTerrain = false
    return { provider, loaded: false }
  }
}
