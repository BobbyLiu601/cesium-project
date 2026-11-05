import { vi } from 'vitest'

export interface MockViewer {
  container: HTMLElement
  options: Record<string, unknown>
  terrainProvider: unknown
  imageryLayers: {
    addImageryProvider: ReturnType<typeof vi.fn<(provider: unknown) => void>>
  }
  camera: {
    setView: ReturnType<typeof vi.fn<(options: unknown) => void>>
  }
  scene: {
    requestRender: ReturnType<typeof vi.fn<() => void>>
    globe: {
      enableLighting: boolean
      tileLoadProgressEvent: {
        addEventListener: ReturnType<typeof vi.fn<(callback: () => void) => () => void>>
      }
    }
    verticalExaggeration: number
  }
  resize: ReturnType<typeof vi.fn<() => void>>
  destroy: ReturnType<typeof vi.fn<() => void>>
}

export interface MockTileProvider {
  options: Record<string, unknown>
}

export interface MockElevationTerrainProvider {
  url: string
  options?: Record<string, unknown>
}

export const viewerInstances: MockViewer[] = []
export const tileProviderInstances: MockTileProvider[] = []
export const elevationProviderRequests: Array<{
  url: string
  options?: Record<string, unknown>
}> = []
export const elevationTerrainProviderInstances: MockElevationTerrainProvider[] = []
export const tileLoadProgressListeners: Array<() => void> = []
export const cesiumMockState = {
  failNextViewer: false,
  failNextImageryLayer: false,
  elevationProviderOutcome: 'success' as 'success' | 'failure',
  elevationProviderPromise: undefined as Promise<MockElevationTerrainProvider> | undefined,
}

export class Viewer implements MockViewer {
  terrainProvider: unknown

  imageryLayers = {
    addImageryProvider: vi.fn<(provider: unknown) => void>(() => {
      if (cesiumMockState.failNextImageryLayer) {
        cesiumMockState.failNextImageryLayer = false
        throw new Error('mock imagery layer failure')
      }
    }),
  }

  camera = {
    setView: vi.fn<(options: unknown) => void>(),
  }

  scene = {
    requestRender: vi.fn<() => void>(),
    globe: {
      enableLighting: false,
      tileLoadProgressEvent: {
        addEventListener: vi.fn<(callback: () => void) => () => void>((callback) => {
          tileLoadProgressListeners.push(callback)

          return () => {
            const index = tileLoadProgressListeners.indexOf(callback)
            if (index >= 0) {
              tileLoadProgressListeners.splice(index, 1)
            }
          }
        }),
      },
    },
    verticalExaggeration: 1,
  }

  resize = vi.fn<() => void>()
  destroy = vi.fn<() => void>()

  constructor(
    public container: HTMLElement,
    public options: Record<string, unknown>,
  ) {
    if (cesiumMockState.failNextViewer) {
      cesiumMockState.failNextViewer = false
      throw new Error('mock viewer failure')
    }

    this.terrainProvider = options.terrainProvider
    viewerInstances.push(this)
  }
}

export class WebMapTileServiceImageryProvider implements MockTileProvider {
  constructor(public options: Record<string, unknown>) {
    tileProviderInstances.push(this)
  }
}

export class WebMercatorTilingScheme {}

export class EllipsoidTerrainProvider {}

export class ArcGISTiledElevationTerrainProvider implements MockElevationTerrainProvider {
  constructor(
    public url: string,
    public options?: Record<string, unknown>,
  ) {
    elevationTerrainProviderInstances.push(this)
  }

  static fromUrl(url: string, options?: Record<string, unknown>) {
    elevationProviderRequests.push({ url, options })

    if (cesiumMockState.elevationProviderPromise) {
      return cesiumMockState.elevationProviderPromise
    }

    if (cesiumMockState.elevationProviderOutcome === 'failure') {
      return Promise.reject(new Error('mock elevation provider failure'))
    }

    return Promise.resolve(new ArcGISTiledElevationTerrainProvider(url, options))
  }
}

export class Cartesian3 {
  static fromDegrees(longitude: number, latitude: number, height: number) {
    return { longitude, latitude, height }
  }
}

export class Rectangle {
  static fromDegrees(west: number, south: number, east: number, north: number) {
    return { west, south, east, north }
  }
}

export const Math = {
  toRadians(degrees: number) {
    return (degrees * globalThis.Math.PI) / 180
  },
}

export function resetCesiumMock() {
  viewerInstances.length = 0
  tileProviderInstances.length = 0
  elevationProviderRequests.length = 0
  elevationTerrainProviderInstances.length = 0
  tileLoadProgressListeners.length = 0
  cesiumMockState.failNextViewer = false
  cesiumMockState.failNextImageryLayer = false
  cesiumMockState.elevationProviderOutcome = 'success'
  cesiumMockState.elevationProviderPromise = undefined
}
