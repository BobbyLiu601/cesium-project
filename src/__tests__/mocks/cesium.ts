import { vi } from 'vitest'

export interface MockViewer {
  container: HTMLElement
  options: Record<string, unknown>
  terrainProvider: unknown
  imageryLayers: {
    addImageryProvider: ReturnType<typeof vi.fn<(provider: unknown) => MockImageryLayer>>
  }
  camera: {
    setView: ReturnType<typeof vi.fn<(options: unknown) => void>>
    lookAt: ReturnType<typeof vi.fn<(center: unknown, headingPitchRange: unknown) => void>>
    lookAtTransform: ReturnType<typeof vi.fn<(transform: unknown) => void>>
  }
  scene: {
    requestRender: ReturnType<typeof vi.fn<() => void>>
    backgroundColor: unknown
    primitives: {
      add: ReturnType<typeof vi.fn<(primitive: unknown) => unknown>>
      remove: ReturnType<typeof vi.fn<(primitive: unknown) => boolean>>
    }
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
  isDestroyed: ReturnType<typeof vi.fn<() => boolean>>
}

export interface MockTileProvider {
  options: Record<string, unknown>
}

export interface MockImageryLayer {
  alpha: number
  brightness: number
  contrast: number
}

export interface MockElevationTerrainProvider {
  url: string
  options?: Record<string, unknown>
}

export const viewerInstances: MockViewer[] = []
export const tileProviderInstances: MockTileProvider[] = []
export const imageryLayerInstances: MockImageryLayer[] = []
export const groundPrimitiveInstances: MockPrimitive[] = []
export const primitiveInstances: MockPrimitive[] = []
export const materialInstances: MockMaterial[] = []
export const scenePrimitiveAdds: unknown[] = []
export const scenePrimitiveRemoves: unknown[] = []
export const elevationProviderRequests: Array<{
  url: string
  options?: Record<string, unknown>
}> = []
export const elevationTerrainProviderInstances: MockElevationTerrainProvider[] = []
export const tileLoadProgressListeners: Array<() => void> = []
export const cesiumMockState = {
  failNextViewer: false,
  failNextImageryLayer: false,
  groundMaterialsSupported: true,
  elevationProviderOutcome: 'success' as 'success' | 'failure',
  elevationProviderPromise: undefined as Promise<MockElevationTerrainProvider> | undefined,
}

export class Viewer implements MockViewer {
  terrainProvider: unknown
  private destroyed = false

  imageryLayers = {
    addImageryProvider: vi.fn<(provider: unknown) => MockImageryLayer>(() => {
      if (cesiumMockState.failNextImageryLayer) {
        cesiumMockState.failNextImageryLayer = false
        throw new Error('mock imagery layer failure')
      }

      const layer = { alpha: 1, brightness: 1, contrast: 1 }
      imageryLayerInstances.push(layer)
      return layer
    }),
  }

  camera = {
    setView: vi.fn<(options: unknown) => void>(),
    lookAt: vi.fn<(center: unknown, headingPitchRange: unknown) => void>(),
    lookAtTransform: vi.fn<(transform: unknown) => void>(),
  }

  scene = {
    requestRender: vi.fn<() => void>(),
    backgroundColor: undefined as unknown,
    primitives: {
      add: vi.fn<(primitive: unknown) => unknown>((primitive) => {
        scenePrimitiveAdds.push(primitive)
        return primitive
      }),
      remove: vi.fn<(primitive: unknown) => boolean>((primitive) => {
        scenePrimitiveRemoves.push(primitive)
        return true
      }),
    },
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
  destroy = vi.fn<() => void>(() => {
    this.destroyed = true
  })
  isDestroyed = vi.fn<() => boolean>(() => this.destroyed)

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

export interface MockPrimitive {
  options: Record<string, unknown>
}

export interface MockMaterial {
  options: {
    fabric: {
      type: string
      uniforms: Record<string, unknown>
      source: string
    }
    translucent?: boolean
  }
  uniforms: Record<string, unknown>
}

export class Material implements MockMaterial {
  uniforms: Record<string, unknown>

  constructor(
    public options: {
      fabric: {
        type: string
        uniforms: Record<string, unknown>
        source: string
      }
      translucent?: boolean
    },
  ) {
    this.uniforms = options.fabric.uniforms
    materialInstances.push(this)
  }
}

export class MaterialAppearance {
  static MaterialSupport = {
    TEXTURED: {
      vertexFormat: {},
    },
  }

  constructor(public options: Record<string, unknown>) {}
}

export class GeometryInstance {
  constructor(public options: Record<string, unknown>) {}
}

export class EllipseGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class EllipsoidGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class GroundPrimitive implements MockPrimitive {
  static supportsMaterials = vi.fn<(scene: unknown) => boolean>(() => {
    return cesiumMockState.groundMaterialsSupported
  })

  static initializeTerrainHeights = vi.fn<() => Promise<void>>(() => Promise.resolve())

  constructor(public options: Record<string, unknown>) {
    groundPrimitiveInstances.push(this)
  }
}

export class Primitive implements MockPrimitive {
  constructor(public options: Record<string, unknown>) {
    primitiveInstances.push(this)
  }
}

export class Color {
  constructor(
    public red: number,
    public green: number,
    public blue: number,
    public alpha: number,
  ) {}
}

export class HeadingPitchRange {
  constructor(
    public heading: number,
    public pitch: number,
    public range: number,
  ) {}
}

export const ClassificationType = {
  TERRAIN: 1,
}

export const Transforms = {
  eastNorthUpToFixedFrame: vi.fn<(origin: unknown) => unknown>(() => ({ type: 'enu' })),
}

export const Matrix4 = {
  IDENTITY: {},
}

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
  static fromDegrees(longitude: number, latitude: number, height?: number) {
    return { longitude, latitude, height }
  }
}

export class Rectangle {
  static fromDegrees(west: number, south: number, east: number, north: number) {
    return { west, south, east, north }
  }
}

export const Math = {
  PI_OVER_TWO: globalThis.Math.PI / 2,
  TWO_PI: globalThis.Math.PI * 2,
  toRadians(degrees: number) {
    return (degrees * globalThis.Math.PI) / 180
  },
}

export function resetCesiumMock() {
  viewerInstances.length = 0
  tileProviderInstances.length = 0
  imageryLayerInstances.length = 0
  groundPrimitiveInstances.length = 0
  primitiveInstances.length = 0
  materialInstances.length = 0
  scenePrimitiveAdds.length = 0
  scenePrimitiveRemoves.length = 0
  elevationProviderRequests.length = 0
  elevationTerrainProviderInstances.length = 0
  tileLoadProgressListeners.length = 0
  cesiumMockState.failNextViewer = false
  cesiumMockState.failNextImageryLayer = false
  cesiumMockState.groundMaterialsSupported = true
  cesiumMockState.elevationProviderOutcome = 'success'
  cesiumMockState.elevationProviderPromise = undefined
  GroundPrimitive.supportsMaterials.mockClear()
  GroundPrimitive.initializeTerrainHeights.mockClear()
  Transforms.eastNorthUpToFixedFrame.mockClear()
}
