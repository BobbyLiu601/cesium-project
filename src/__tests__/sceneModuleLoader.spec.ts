import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSceneModuleRetry,
  isSceneModuleFetchError,
  reloadSceneModuleAfterFetchFailure,
} from '@/components/sceneModuleLoader'

const feature = { id: 'ocean-current', kind: 'visualization' } as const
const chunkError = new TypeError(
  'Failed to fetch dynamically imported module: https://example.test/VisualizationDemoGlobe.js',
)

describe('scene module loading', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
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
      window.sessionStorage.getItem(
        'cesium-project:scene-module-retry:visualization:ocean-current',
      ),
    ).toBeNull()
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
