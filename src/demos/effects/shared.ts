import * as Cesium from 'cesium'

const TERRAIN_TIMEOUT_MS = 9_000

export function createEffectAbortError() {
  return new DOMException('场景特效加载已取消', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createEffectAbortError()
  }
}

export async function loadEffectTerrain(viewer: Cesium.Viewer, signal?: AbortSignal) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const providerPromise = Cesium.CesiumTerrainProvider.fromUrl('https://data.mars3d.cn/terrain')

  try {
    throwIfAborted(signal)
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('高度雾地形加载超时')), TERRAIN_TIMEOUT_MS)
    })
    const abortPromise = new Promise<never>((_, reject) => {
      abortHandler = () => reject(createEffectAbortError())
      signal?.addEventListener('abort', abortHandler, { once: true })
    })
    const provider = await Promise.race([
      providerPromise,
      timeoutPromise,
      ...(signal ? [abortPromise] : []),
    ])

    throwIfAborted(signal)
    viewer.terrainProvider = provider
    viewer.scene.globe.depthTestAgainstTerrain = true
    return true
  } catch (error) {
    if (signal?.aborted) {
      throw createEffectAbortError()
    }

    console.error('高度雾地形加载失败，已回退椭球地形。', error)
    viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider()
    viewer.scene.globe.depthTestAgainstTerrain = false
    return false
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId)
    }
    if (abortHandler) {
      signal?.removeEventListener('abort', abortHandler)
    }
  }
}
