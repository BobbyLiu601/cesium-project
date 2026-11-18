import type { Component } from 'vue'

import type { FeatureKind } from '@/data/layers'

type SceneModule = { default: Component }

const RETRY_WINDOW_MS = 30_000
const RETRY_STORAGE_PREFIX = 'cesium-project:scene-module-retry:'
const FRESH_RELOAD_PARAM = '__scene_refresh'
const RESTORE_ROUTE_PARAM = '__scene_route'

export const sceneModuleLoaders: Record<FeatureKind, () => Promise<SceneModule>> = {
  amap: () => import('@/components/CesiumGlobe.vue'),
  effects: () => import('@/demos/EffectsDemoGlobe.vue'),
  elevation: () => import('@/components/ElevationGlobe.vue'),
  model: () => import('@/demos/ModelDemoGlobe.vue'),
  particles: () => import('@/demos/ParticleDemoGlobe.vue'),
  spatial: () => import('@/demos/SpatialDemoGlobe.vue'),
  'special-shapes': () => import('@/demos/SpecialShapesDemoGlobe.vue'),
  'physics-engine': () => import('@/demos/PhysicsDemoGlobe.vue'),
  tianditu: () => import('@/components/CesiumGlobe.vue'),
  vector: () => import('@/demos/VectorDemoGlobe.vue'),
  visualization: () => import('@/demos/VisualizationDemoGlobe.vue'),
}

function getRetryStorageKey(kind: FeatureKind) {
  return `${RETRY_STORAGE_PREFIX}${kind}`
}

export function createFreshReloadUrl(href: string, now = Date.now()) {
  const currentUrl = new URL(href)
  const targetUrl = new URL(currentUrl)
  targetUrl.searchParams.delete(FRESH_RELOAD_PARAM)
  targetUrl.searchParams.delete(RESTORE_ROUTE_PARAM)

  const refreshUrl = new URL(`${import.meta.env.BASE_URL}index.html`, currentUrl.origin)
  refreshUrl.searchParams.set(FRESH_RELOAD_PARAM, String(now))
  refreshUrl.searchParams.set(
    RESTORE_ROUTE_PARAM,
    `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`,
  )
  return refreshUrl.toString()
}

export function restoreFreshReloadTarget() {
  try {
    const currentUrl = new URL(window.location.href)
    const target = currentUrl.searchParams.get(RESTORE_ROUTE_PARAM)
    if (!target) {
      return false
    }

    const targetUrl = new URL(target, currentUrl.origin)
    const baseUrl = new URL(import.meta.env.BASE_URL, currentUrl.origin)
    if (
      targetUrl.origin !== currentUrl.origin ||
      !targetUrl.pathname.startsWith(baseUrl.pathname)
    ) {
      return false
    }

    targetUrl.searchParams.delete(FRESH_RELOAD_PARAM)
    targetUrl.searchParams.delete(RESTORE_ROUTE_PARAM)
    window.history.replaceState(window.history.state, '', targetUrl)
    return true
  } catch {
    return false
  }
}

export function reloadPageFresh() {
  window.location.replace(createFreshReloadUrl(window.location.href))
}

export function isSceneModuleFetchError(error: unknown) {
  if (!(error instanceof Error)) {
    return false
  }

  return /(?:failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|chunkloaderror)/i.test(
    `${error.name}: ${error.message}`,
  )
}

export function clearSceneModuleRetry(feature: { kind: FeatureKind }) {
  try {
    window.sessionStorage.removeItem(getRetryStorageKey(feature.kind))
  } catch {
    // Storage can be unavailable in privacy modes; the scene itself can still load.
  }

  try {
    const url = new URL(window.location.href)
    if (url.searchParams.has(FRESH_RELOAD_PARAM)) {
      url.searchParams.delete(FRESH_RELOAD_PARAM)
      window.history.replaceState(window.history.state, '', url)
    }
  } catch {
    // A clean shareable URL is optional; scene loading must not depend on it.
  }
}

export function reloadSceneModuleAfterFetchFailure(
  feature: { kind: FeatureKind },
  error: unknown,
  {
    now = Date.now(),
    online = navigator.onLine,
    reload = reloadPageFresh,
  }: { now?: number; online?: boolean; reload?: () => void } = {},
) {
  if (!isSceneModuleFetchError(error) || !online) {
    return false
  }

  const key = getRetryStorageKey(feature.kind)

  try {
    const storedAttempt = window.sessionStorage.getItem(key)
    if (storedAttempt !== null) {
      const previousAttempt = Number(storedAttempt)
      if (Number.isFinite(previousAttempt) && now - previousAttempt < RETRY_WINDOW_MS) {
        return false
      }
    }
    window.sessionStorage.setItem(key, String(now))
  } catch {
    return false
  }

  reload()
  return true
}
