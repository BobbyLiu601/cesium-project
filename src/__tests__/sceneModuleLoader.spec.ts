import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSceneModuleRetry,
  createFreshReloadUrl,
  isSceneModuleFetchError,
  reloadSceneModuleAfterFetchFailure,
} from '@/components/sceneModuleLoader'

const feature = { id: 'ocean-current', kind: 'visualization' } as const
const siblingFeature = { id: 'wind-field', kind: 'visualization' } as const
const chunkError = new TypeError(
  'Failed to fetch dynamically imported module: https://example.test/VisualizationDemoGlobe.js',
)

describe('scene module loading', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    window.history.replaceState(null, '', '/')
  })

  it('recognizes stale or unreachable dynamic chunks', () => {
    expect(isSceneModuleFetchError(chunkError)).toBe(true)
    expect(isSceneModuleFetchError(new Error('Importing a module script failed.'))).toBe(true)
    expect(isSceneModuleFetchError(new Error('Unexpected module evaluation error'))).toBe(false)
  })

  it('reloads once to recover a failed chunk request', () => {
    const reload = vi.fn<() => void>()

    expect(
      reloadSceneModuleAfterFetchFailure(feature, chunkError, {
        now: 10_000,
        online: true,
        reload,
      }),
    ).toBe(true)
    expect(reload).toHaveBeenCalledOnce()
  })

  it('builds a cache-busting reload URL without losing the current route', () => {
    expect(
      createFreshReloadUrl(
        'https://example.test/cesium-project/visualization/data-visualization/4-2-1-ocean-current?source=card&__scene_refresh=old#legend',
        123,
      ),
    ).toBe(
      'https://example.test/cesium-project/visualization/data-visualization/4-2-1-ocean-current?source=card&__scene_refresh=123#legend',
    )
  })

  it('does not enter a reload loop when the chunk still cannot be fetched', () => {
    const reload = vi.fn<() => void>()

    reloadSceneModuleAfterFetchFailure(feature, chunkError, {
      now: 10_000,
      online: true,
      reload,
    })
    reload.mockClear()

    expect(
      reloadSceneModuleAfterFetchFailure(feature, chunkError, {
        now: 20_000,
        online: true,
        reload,
      }),
    ).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('shares the retry guard across scenes backed by the same lazy module', () => {
    const reload = vi.fn<() => void>()

    reloadSceneModuleAfterFetchFailure(feature, chunkError, {
      now: 10_000,
      online: true,
      reload,
    })
    reload.mockClear()

    expect(
      reloadSceneModuleAfterFetchFailure(siblingFeature, chunkError, {
        now: 20_000,
        online: true,
        reload,
      }),
    ).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('allows another recovery after the retry window and clears it after success', () => {
    const reload = vi.fn<() => void>()

    reloadSceneModuleAfterFetchFailure(feature, chunkError, {
      now: 10_000,
      online: true,
      reload,
    })
    reload.mockClear()

    expect(
      reloadSceneModuleAfterFetchFailure(feature, chunkError, {
        now: 41_000,
        online: true,
        reload,
      }),
    ).toBe(true)
    expect(reload).toHaveBeenCalledOnce()

    clearSceneModuleRetry(feature)
    expect(
      window.sessionStorage.getItem('cesium-project:scene-module-retry:visualization'),
    ).toBeNull()
  })

  it('removes the internal refresh marker after recovery succeeds', () => {
    window.history.replaceState(
      null,
      '',
      '/visualization/data-visualization/4-2-1-ocean-current?__scene_refresh=123&source=card#legend',
    )

    clearSceneModuleRetry(feature)

    expect(window.location.pathname).toBe('/visualization/data-visualization/4-2-1-ocean-current')
    expect(window.location.search).toBe('?source=card')
    expect(window.location.hash).toBe('#legend')
  })

  it('leaves ordinary module evaluation errors visible to the user', () => {
    const reload = vi.fn<() => void>()

    expect(
      reloadSceneModuleAfterFetchFailure(feature, new Error('broken initialization'), {
        now: 10_000,
        online: true,
        reload,
      }),
    ).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })

  it('shows the error instead of reloading while offline', () => {
    const reload = vi.fn<() => void>()

    expect(
      reloadSceneModuleAfterFetchFailure(feature, chunkError, {
        now: 10_000,
        online: false,
        reload,
      }),
    ).toBe(false)
    expect(reload).not.toHaveBeenCalled()
  })
})
