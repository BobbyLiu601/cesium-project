import { vi } from 'vitest'

export interface MockViewer {
  container: HTMLElement
  options: Record<string, unknown>
  imageryLayers: {
    addImageryProvider: ReturnType<typeof vi.fn<(provider: unknown) => void>>
  }
  camera: {
    setView: ReturnType<typeof vi.fn<(options: unknown) => void>>
  }
  scene: {
    requestRender: ReturnType<typeof vi.fn<() => void>>
  }
  resize: ReturnType<typeof vi.fn<() => void>>
  destroy: ReturnType<typeof vi.fn<() => void>>
}

export interface MockTileProvider {
  options: Record<string, unknown>
}

export const viewerInstances: MockViewer[] = []
export const tileProviderInstances: MockTileProvider[] = []
export const cesiumMockState = {
  failNextImageryLayer: false,
}

export class Viewer implements MockViewer {
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
  }

  resize = vi.fn<() => void>()
  destroy = vi.fn<() => void>()

  constructor(
    public container: HTMLElement,
    public options: Record<string, unknown>,
  ) {
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

export function resetCesiumMock() {
  viewerInstances.length = 0
  tileProviderInstances.length = 0
  cesiumMockState.failNextImageryLayer = false
}
