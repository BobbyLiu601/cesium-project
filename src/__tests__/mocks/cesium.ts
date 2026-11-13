import { vi } from 'vitest'

export interface MockViewer {
  container: HTMLElement
  options: Record<string, unknown>
  terrainProvider: unknown
  imageryLayers: {
    addImageryProvider: ReturnType<typeof vi.fn<(provider: unknown) => MockImageryLayer>>
  }
  camera: {
    positionCartographic: {
      longitude: number
      latitude: number
      height: number
    }
    positionWC: unknown
    setView: ReturnType<typeof vi.fn<(options: unknown) => void>>
    viewBoundingSphere: ReturnType<typeof vi.fn<(sphere: unknown, orientation: unknown) => void>>
    lookAt: ReturnType<typeof vi.fn<(center: unknown, headingPitchRange: unknown) => void>>
    lookAtTransform: ReturnType<typeof vi.fn<(transform: unknown, offset?: unknown) => void>>
    flyTo: ReturnType<typeof vi.fn<(options: unknown) => void>>
  }
  scene: {
    requestRender: ReturnType<typeof vi.fn<() => void>>
    backgroundColor: unknown
    canvas: HTMLCanvasElement
    pick: ReturnType<typeof vi.fn<(position: unknown) => unknown>>
    preUpdate: MockEvent<() => void>
    preRender: MockEvent<() => void>
    postRender: MockEvent<() => void>
    primitives: {
      add: ReturnType<typeof vi.fn<(primitive: unknown) => unknown>>
      remove: ReturnType<typeof vi.fn<(primitive: unknown) => boolean>>
    }
    skyBox: unknown
    skyAtmosphere?: {
      show: boolean
    }
    postProcessStages: MockPostProcessStageCollection
    globe: {
      enableLighting: boolean
      depthTestAgainstTerrain: boolean
      tileLoadProgressEvent: {
        addEventListener: ReturnType<typeof vi.fn<(callback: () => void) => () => void>>
      }
    }
    verticalExaggeration: number
  }
  entities: MockEntityCollection
  dataSources: {
    add: ReturnType<typeof vi.fn<(dataSource: MockDataSource) => MockDataSource>>
    remove: ReturnType<typeof vi.fn<(dataSource: MockDataSource) => boolean>>
  }
  clock: {
    currentTime: unknown
    startTime: unknown
    stopTime: unknown
    shouldAnimate: boolean
    clockRange: unknown
    multiplier: number
  }
  flyTo: ReturnType<typeof vi.fn<(target: unknown) => Promise<boolean>>>
  shadows: boolean
  resize: ReturnType<typeof vi.fn<() => void>>
  destroy: ReturnType<typeof vi.fn<() => void>>
  isDestroyed: ReturnType<typeof vi.fn<() => boolean>>
}

export interface MockEntity {
  id: string
  name?: string
  show?: boolean
  position?: {
    getValue: (time?: unknown) => unknown
  }
  properties?: Record<string, { getValue: (time?: unknown) => unknown }>
  polygon?: Record<string, unknown>
  polyline?: Record<string, unknown>
  point?: Record<string, unknown>
  label?: Record<string, unknown>
  billboard?: Record<string, unknown>
  model?: {
    uri?: string
    scale?: number
    runAnimations?: boolean
    silhouetteSize?: number
    silhouetteColor?: unknown
  }
  orientation?: {
    getValue: (time?: unknown) => unknown
  }
  availability?: unknown
  path?: Record<string, unknown>
}

export interface MockDataSource {
  name: string
  entities: MockEntityCollection
}

export class MockEvent<T extends (...args: never[]) => unknown> {
  listeners = new Set<T>()

  addEventListener = vi.fn<(listener: T) => () => void>((listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  })

  removeEventListener = vi.fn<(listener: T) => void>((listener) => {
    this.listeners.delete(listener)
  })

  raiseEvent(...args: Parameters<T>) {
    this.listeners.forEach((listener) => listener(...args))
  }
}

export class MockPostProcessStageCollection {
  stages: PostProcessStage[] = []

  add = vi.fn<(stage: PostProcessStage) => PostProcessStage>((stage) => {
    this.stages.push(stage)
    return stage
  })

  remove = vi.fn<(stage: PostProcessStage) => boolean>((stage) => {
    const index = this.stages.indexOf(stage)
    if (index < 0) {
      return false
    }

    this.stages.splice(index, 1)
    stage.destroy()
    return true
  })
}

export class MockEntityCollection {
  values: MockEntity[] = []

  add = vi.fn<(entity: Record<string, unknown> | MockEntity) => MockEntity>((entity) => {
    const created =
      entity instanceof Object && 'id' in entity && typeof entity.id === 'string'
        ? (entity as MockEntity)
        : ({ id: `entity-${this.values.length + 1}`, ...entity } as MockEntity)
    const rawPosition = (created as unknown as { position?: unknown }).position
    if (rawPosition && typeof (rawPosition as { getValue?: unknown }).getValue !== 'function') {
      created.position = { getValue: () => rawPosition }
    }
    if (created.properties) {
      created.properties = Object.fromEntries(
        Object.entries(created.properties).map(([key, value]) => {
          const rawValue = value as unknown
          if (rawValue && typeof (rawValue as { getValue?: unknown }).getValue === 'function') {
            return [key, value]
          }
          return [key, { getValue: () => rawValue }]
        }),
      )
    }
    this.values.push(created)
    return created
  })

  remove = vi.fn<(entity: MockEntity) => boolean>((entity) => {
    const index = this.values.indexOf(entity)
    if (index < 0) {
      return false
    }
    this.values.splice(index, 1)
    return true
  })

  removeById = vi.fn<(id: string) => boolean>((id) => {
    const index = this.values.findIndex((entity) => entity.id === id)
    if (index < 0) {
      return false
    }
    this.values.splice(index, 1)
    return true
  })

  removeAll = vi.fn<() => void>(() => {
    this.values.length = 0
  })

  getById = vi.fn<(id: string) => MockEntity | undefined>((id) =>
    this.values.find((entity) => entity.id === id),
  )

  contains = vi.fn<(entity: MockEntity) => boolean>((entity) => this.values.includes(entity))

  reset() {
    this.values.length = 0
    this.add.mockClear()
    this.remove.mockClear()
    this.removeById.mockClear()
    this.removeAll.mockClear()
    this.getById.mockClear()
    this.contains.mockClear()
  }
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

export interface MockCesiumTerrainProvider {
  url: string
  options?: Record<string, unknown>
}

export const viewerInstances: MockViewer[] = []
export const tileProviderInstances: MockTileProvider[] = []
export const imageryLayerInstances: MockImageryLayer[] = []
export const groundPrimitiveInstances: MockPrimitive[] = []
export const primitiveInstances: MockPrimitive[] = []
export const materialInstances: MockMaterial[] = []
export const polylineDashMaterialInstances: unknown[] = []
export const scenePrimitiveAdds: unknown[] = []
export const scenePrimitiveRemoves: unknown[] = []
export const cesium3DTilesetInstances: MockCesium3DTileset[] = []
export const cesium3DTilesetRequests: Array<{
  url: string
  options?: Record<string, unknown>
}> = []
export const elevationProviderRequests: Array<{
  url: string
  options?: Record<string, unknown>
}> = []
export const elevationTerrainProviderInstances: MockElevationTerrainProvider[] = []
export const cesiumTerrainProviderRequests: Array<{
  url: string
  options?: Record<string, unknown>
}> = []
export const cesiumTerrainProviderInstances: MockCesiumTerrainProvider[] = []
export const tileLoadProgressListeners: Array<() => void> = []
export const entityCollectionInstances: MockEntityCollection[] = []
export const dataSourceInstances: MockDataSource[] = []
export const billboardCollectionInstances: BillboardCollection[] = []
export const cloudCollectionInstances: CloudCollection[] = []
export const screenSpaceEventHandlerInstances: ScreenSpaceEventHandler[] = []
export const terrainSampleRequests: unknown[][] = []
export const modelInstances: MockModel[] = []
export const postProcessStageInstances: PostProcessStage[] = []
export const skyBoxInstances: SkyBox[] = []
export const cesiumMockState = {
  failNextViewer: false,
  failNextImageryLayer: false,
  groundMaterialsSupported: true,
  groundTerrainHeightsOutcome: 'success' as 'success' | 'failure',
  elevationProviderOutcome: 'success' as 'success' | 'failure',
  elevationProviderPromise: undefined as Promise<MockElevationTerrainProvider> | undefined,
  cesiumTerrainProviderOutcome: 'success' as 'success' | 'failure',
  cesiumTerrainProviderPromise: undefined as Promise<MockCesiumTerrainProvider> | undefined,
  cesium3DTilesetPromise: undefined as Promise<MockCesium3DTileset> | undefined,
  geoJsonOutcome: 'success' as 'success' | 'failure',
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
    positionCartographic: {
      height: 3_336.6,
      latitude: 0,
      longitude: 0,
    },
    positionWC: new Cartesian3(0, 0, 6_378_137 + 3_336.6),
    setView: vi.fn<(options: unknown) => void>(),
    viewBoundingSphere: vi.fn<(sphere: unknown, orientation: unknown) => void>(),
    lookAt: vi.fn<(center: unknown, headingPitchRange: unknown) => void>(),
    lookAtTransform: vi.fn<(transform: unknown, offset?: unknown) => void>(),
    flyTo: vi.fn<(options: unknown) => void>(),
  }

  entities = new MockEntityCollection()
  dataSources = {
    add: vi.fn<(dataSource: MockDataSource) => MockDataSource>((dataSource) => {
      dataSourceInstances.push(dataSource)
      return dataSource
    }),
    remove: vi.fn<(dataSource: MockDataSource) => boolean>((dataSource) => {
      const index = dataSourceInstances.indexOf(dataSource)
      if (index >= 0) {
        dataSourceInstances.splice(index, 1)
        return true
      }
      return false
    }),
  }
  clock = {
    currentTime: {},
    startTime: {},
    stopTime: {},
    shouldAnimate: false,
    clockRange: undefined as unknown,
    multiplier: 1,
  }

  scene = {
    requestRender: vi.fn<() => void>(),
    backgroundColor: undefined as unknown,
    canvas: document.createElement('canvas'),
    pick: vi.fn<(position: unknown) => unknown>(() => undefined),
    preUpdate: new MockEvent<() => void>(),
    preRender: new MockEvent<() => void>(),
    postRender: new MockEvent<() => void>(),
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
      depthTestAgainstTerrain: false,
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
    skyAtmosphere: {
      show: true,
    },
    skyBox: undefined as unknown,
    postProcessStages: new MockPostProcessStageCollection(),
    verticalExaggeration: 1,
  }

  resize = vi.fn<() => void>()
  flyTo = vi.fn<(target: unknown) => Promise<boolean>>(() => Promise.resolve(true))
  shadows = false
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

export class PolygonGeometry {
  static fromPositions(options: Record<string, unknown>) {
    return { type: 'PolygonGeometry', options }
  }
}

export class PolygonHierarchy {
  constructor(
    public positions: unknown[],
    public holes: unknown[] = [],
  ) {}
}

export class PolylineGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class RectangleGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class CircleGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class BoxGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class CylinderGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class WallGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class CorridorGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class PolylineVolumeGeometry {
  constructor(public options: Record<string, unknown>) {}
}

export class PerInstanceColorAppearance {
  static VERTEX_FORMAT = {}

  constructor(public options?: Record<string, unknown>) {}
}

export class PolylineColorAppearance {
  constructor(public options?: Record<string, unknown>) {}
}

export class PolylineMaterialAppearance {
  constructor(public options?: Record<string, unknown>) {}
}

export class ColorGeometryInstanceAttribute {
  static fromColor(color: unknown) {
    return { color }
  }
}

export class ConstantProperty {
  constructor(public value: unknown) {}
}

export class CallbackProperty {
  constructor(
    public callback: () => unknown,
    public isConstant: boolean,
  ) {}

  getValue() {
    return this.callback()
  }
}

export class ColorMaterialProperty {
  constructor(public color: unknown) {}
}

export class PolylineDashMaterialProperty {
  constructor(public options?: Record<string, unknown>) {
    polylineDashMaterialInstances.push(this)
  }
}

export class NearFarScalar {
  constructor(
    public near: number,
    public nearValue: number,
    public far: number,
    public farValue: number,
  ) {}
}

export class BillboardCollection {
  items: Record<string, unknown>[] = []

  constructor(public options?: Record<string, unknown>) {
    billboardCollectionInstances.push(this)
  }

  add(options: Record<string, unknown>) {
    this.items.push(options)
    return options
  }
}

export class PostProcessStage {
  destroyed = false

  constructor(public options: Record<string, unknown>) {
    postProcessStageInstances.push(this)
  }

  destroy = vi.fn<() => void>(() => {
    this.destroyed = true
  })

  isDestroyed = vi.fn<() => boolean>(() => this.destroyed)
}

export class SkyBox {
  destroyed = false

  constructor(public options: Record<string, unknown>) {
    skyBoxInstances.push(this)
  }

  destroy = vi.fn<() => void>(() => {
    this.destroyed = true
  })

  isDestroyed = vi.fn<() => boolean>(() => this.destroyed)
}

export class CloudCollection {
  destroyed = false
  show = true
  clouds: Array<Record<string, unknown>> = []

  constructor(public options: Record<string, unknown>) {
    cloudCollectionInstances.push(this)
  }

  add = vi.fn<(options: Record<string, unknown>) => Record<string, unknown>>((options) => {
    const cloud = { ...options }
    this.clouds.push(cloud)
    return cloud
  })

  destroy = vi.fn<() => void>(() => {
    this.destroyed = true
  })

  isDestroyed = vi.fn<() => boolean>(() => this.destroyed)
}

export class ModelAnimationCollection {
  length = 0

  addAll = vi.fn<(options?: Record<string, unknown>) => void>(() => {
    this.length += 1
  })

  removeAll = vi.fn<() => void>(() => {
    this.length = 0
  })
}

export interface MockModel {
  options: Record<string, unknown>
  activeAnimations: ModelAnimationCollection
  silhouetteSize: number
  silhouetteColor?: unknown
}

export class Model implements MockModel {
  activeAnimations = new ModelAnimationCollection()
  silhouetteSize: number
  silhouetteColor?: unknown

  constructor(public options: Record<string, unknown>) {
    this.silhouetteSize = Number(options.silhouetteSize ?? 0)
    this.silhouetteColor = options.silhouetteColor
    modelInstances.push(this)
  }

  static fromGltfAsync(options: Record<string, unknown>) {
    return Promise.resolve(new Model(options))
  }
}

export const ModelAnimationLoop = {
  REPEAT: 2,
}

export class CustomDataSource implements MockDataSource {
  entities = new MockEntityCollection()

  constructor(public name: string) {
    entityCollectionInstances.push(this.entities)
  }
}

export class GeoJsonDataSource extends CustomDataSource {
  static load(data: unknown, options?: Record<string, unknown>) {
    if (cesiumMockState.geoJsonOutcome === 'failure') {
      return Promise.reject(new Error('mock geojson failure'))
    }

    const source = new GeoJsonDataSource('geojson-demo')
    const features =
      (data as { features?: Array<{ geometry?: { type?: string }; properties?: object }> })
        .features ?? []
    for (const [index, feature] of features.entries()) {
      const properties = feature.properties ?? {}
      const entity: MockEntity = {
        id: `geojson-${index + 1}`,
        properties: Object.fromEntries(
          Object.entries(properties).map(([key, value]) => [key, { getValue: () => value }]),
        ),
      }
      if (feature.geometry?.type === 'Polygon') {
        entity.polygon = {}
      } else if (feature.geometry?.type === 'LineString') {
        entity.polyline = {}
      }
      source.entities.add(entity)
    }
    source.options = options
    return Promise.resolve(source)
  }

  options?: Record<string, unknown>
}

export class ScreenSpaceEventHandler {
  actions = new Map<unknown, (event: unknown) => void>()

  constructor(public element: HTMLElement) {
    screenSpaceEventHandlerInstances.push(this)
  }

  setInputAction(action: (event: unknown) => void, type: unknown) {
    this.actions.set(type, action)
  }

  destroy = vi.fn<() => void>(() => {
    this.actions.clear()
  })
}

export class JulianDate {
  constructor(
    public dayNumber = 0,
    public secondsOfDay = 0,
  ) {}

  clone() {
    return new JulianDate(this.dayNumber, this.secondsOfDay)
  }

  static now() {
    return new JulianDate(2_460_000, 0)
  }

  static fromDate(date: Date) {
    const millisecondsPerDay = 86_400_000
    const julianDayNumber = date.getTime() / millisecondsPerDay + 2_440_587.5
    const dayNumber = globalThis.Math.floor(julianDayNumber)
    return new JulianDate(dayNumber, (julianDayNumber - dayNumber) * 86_400)
  }

  static addSeconds(date: JulianDate, seconds: number, result = new JulianDate()) {
    result.dayNumber = date.dayNumber
    result.secondsOfDay = date.secondsOfDay + seconds
    return result
  }
}

export class SampledPositionProperty {
  samples: Array<{ time: unknown; position: unknown }> = []

  addSample(time: unknown, position: unknown) {
    this.samples.push({ time, position })
  }

  setInterpolationOptions = vi.fn<(options?: Record<string, unknown>) => void>()

  getValue() {
    return this.samples[0]?.position
  }
}

export class VelocityOrientationProperty {
  constructor(public position: unknown) {}

  getValue() {
    return {}
  }
}

export class TimeInterval {
  constructor(public options: Record<string, unknown>) {}
}

export class TimeIntervalCollection {
  constructor(public intervals: TimeInterval[]) {}
}

export class PolylineGlowMaterialProperty {
  constructor(public options: Record<string, unknown>) {}
}

export class PolylineArrowMaterialProperty {
  constructor(public color: unknown) {}
}

export class Cartographic {
  longitude: number
  latitude: number
  height: number

  constructor(longitude = 0, latitude = 0, height = 0) {
    this.longitude = longitude
    this.latitude = latitude
    this.height = height
  }

  static fromDegrees(longitude: number, latitude: number, height = 0) {
    return new Cartographic(
      (longitude * globalThis.Math.PI) / 180,
      (latitude * globalThis.Math.PI) / 180,
      height,
    )
  }

  static fromRadians(longitude: number, latitude: number, height = 0) {
    return new Cartographic(longitude, latitude, height)
  }
}

export class Cartesian2 {
  constructor(
    public x: number,
    public y: number,
  ) {}
}

export class BoundingSphere {
  constructor(
    public center: unknown,
    public radius: number,
  ) {}

  static fromPoints(points: unknown[]) {
    return new BoundingSphere(points[0], 0)
  }
}

export class WebMapTileServiceImageryProvider implements MockTileProvider {
  constructor(public options: Record<string, unknown>) {
    tileProviderInstances.push(this)
  }
}

export class UrlTemplateImageryProvider implements MockTileProvider {
  constructor(public options: Record<string, unknown>) {
    tileProviderInstances.push(this)
  }
}

export class WebMercatorProjection {
  constructor(public ellipsoid?: unknown) {}

  project(position: { longitude: number; latitude: number; height?: number }) {
    return new Cartesian3(position.longitude, position.latitude, position.height ?? 0)
  }

  unproject(position: { x: number; y: number; z?: number }) {
    return new Cartographic(position.x, position.y, position.z ?? 0)
  }
}

export class WebMercatorTilingScheme {
  ellipsoid = {}
  rectangle = {
    west: -globalThis.Math.PI,
    south: -globalThis.Math.PI / 2,
    east: globalThis.Math.PI,
    north: globalThis.Math.PI / 2,
  }

  getNumberOfXTilesAtLevel(level: number) {
    return 2 ** (level + 1)
  }

  getNumberOfYTilesAtLevel(level: number) {
    return 2 ** (level + 1)
  }

  rectangleToNativeRectangle(rectangle: Rectangle, result = new Rectangle()) {
    result.west = rectangle.west
    result.south = rectangle.south
    result.east = rectangle.east
    result.north = rectangle.north
    return result
  }

  tileXYToNativeRectangle(x: number, y: number, level: number, result = new Rectangle()) {
    const size = 2 / 2 ** (level + 1)
    result.west = -1 + x * size
    result.east = -1 + (x + 1) * size
    result.north = 1 - y * size
    result.south = 1 - (y + 1) * size
    return result
  }
}

export class EllipsoidTerrainProvider {}

export const buildModuleUrl = vi.fn<(relativeUrl: string) => string>(
  (relativeUrl) => `/cesium/${relativeUrl}`,
)

export class CesiumTerrainProvider implements MockCesiumTerrainProvider {
  constructor(
    public url: string,
    public options?: Record<string, unknown>,
  ) {
    cesiumTerrainProviderInstances.push(this)
  }

  static fromUrl(url: string, options?: Record<string, unknown>) {
    cesiumTerrainProviderRequests.push({ url, options })

    if (cesiumMockState.cesiumTerrainProviderOutcome === 'failure') {
      return Promise.reject(new Error('mock Cesium terrain provider failure'))
    }

    if (cesiumMockState.cesiumTerrainProviderPromise) {
      return cesiumMockState.cesiumTerrainProviderPromise
    }

    return Promise.resolve(new CesiumTerrainProvider(url, options))
  }
}

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

  static fromType(type: string, uniforms: Record<string, unknown>) {
    return new Material({
      fabric: {
        type,
        uniforms,
        source: '',
      },
    })
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

export class EllipsoidSurfaceAppearance {
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

  static initializeTerrainHeights = vi.fn<() => Promise<void>>(() => {
    if (cesiumMockState.groundTerrainHeightsOutcome === 'failure') {
      return Promise.reject(new Error('mock terrain heights failure'))
    }

    return Promise.resolve()
  })

  constructor(public options: Record<string, unknown>) {
    groundPrimitiveInstances.push(this)
  }
}

export class Primitive implements MockPrimitive {
  constructor(public options: Record<string, unknown>) {
    primitiveInstances.push(this)
  }
}

export interface MockCesium3DTileset {
  boundingSphere: BoundingSphere
  destroyed: boolean
  options: Record<string, unknown>
  shadows: number
  url: string
  destroy: () => void
  isDestroyed: () => boolean
}

export class Cesium3DTileset implements MockCesium3DTileset {
  boundingSphere = new BoundingSphere(new Cartesian3(0, 0, 0), 900)
  destroyed = false
  shadows: number

  constructor(
    public url: string,
    public options: Record<string, unknown> = {},
  ) {
    this.shadows = Number(options.shadows ?? 0)
    cesium3DTilesetInstances.push(this)
  }

  static fromUrl(url: string, options: Record<string, unknown> = {}) {
    cesium3DTilesetRequests.push({ url, options })
    if (cesiumMockState.cesium3DTilesetPromise) {
      return cesiumMockState.cesium3DTilesetPromise
    }
    return Promise.resolve(new Cesium3DTileset(url, options))
  }

  destroy = () => {
    this.destroyed = true
  }

  isDestroyed = () => this.destroyed
}

export class Color {
  constructor(
    public red: number,
    public green: number,
    public blue: number,
    public alpha: number,
  ) {}

  static YELLOW = new Color(1, 1, 0, 1)
  static CYAN = new Color(0, 1, 1, 1)
  static ORANGE = new Color(1, 0.65, 0, 1)
  static LIME = new Color(0, 1, 0, 1)
  static RED = new Color(1, 0, 0, 1)
  static DODGERBLUE = new Color(0.12, 0.56, 1, 1)
  static WHITE = new Color(1, 1, 1, 1)
  static MAGENTA = new Color(1, 0, 1, 1)

  static fromCssColorString(value: string) {
    return new Color(0.5, 0.5, 0.5, value.length > 8 ? 0.7 : 1)
  }

  withAlpha(alpha: number) {
    return new Color(this.red, this.green, this.blue, alpha)
  }
}

export class HeadingPitchRange {
  constructor(
    public heading: number,
    public pitch: number,
    public range: number,
  ) {}
}

export class HeadingPitchRoll {
  constructor(
    public heading: number,
    public pitch: number,
    public roll: number,
  ) {}
}

export const ClassificationType = {
  TERRAIN: 1,
}

export const Transforms = {
  eastNorthUpToFixedFrame: vi.fn<(origin: unknown) => unknown>(() => ({ type: 'enu' })),
  headingPitchRollQuaternion: vi.fn<(origin: unknown, orientation: unknown) => unknown>(() => ({
    type: 'quaternion',
  })),
  headingPitchRollToFixedFrame: vi.fn<(origin: unknown, orientation: unknown) => unknown>(() => ({
    type: 'model-matrix',
  })),
}

export const Matrix4 = {
  IDENTITY: {},
  fromRotationTranslation: vi.fn<(rotation: unknown, translation: unknown) => unknown>(() => ({
    type: 'rotation-translation',
  })),
}

export const Matrix3 = {
  fromQuaternion: vi.fn<(quaternion: unknown) => unknown>(() => ({ type: 'rotation' })),
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

  static fromDegreesArray(values: number[]) {
    const positions = []
    for (let index = 0; index < values.length; index += 2) {
      positions.push(Cartesian3.fromDegrees(values[index]!, values[index + 1]!))
    }
    return positions
  }

  static fromDegreesArrayHeights(values: number[]) {
    const positions = []
    for (let index = 0; index < values.length; index += 3) {
      positions.push(Cartesian3.fromDegrees(values[index]!, values[index + 1]!, values[index + 2]!))
    }
    return positions
  }

  static magnitude(vector: Cartesian3) {
    return globalThis.Math.hypot(vector.x, vector.y, vector.z)
  }

  constructor(
    public x: number,
    public y: number,
    public z: number,
  ) {}
}

export class Rectangle {
  static fromDegrees(west: number, south: number, east: number, north: number) {
    const toRadians = (value: number) => (value * globalThis.Math.PI) / 180
    return new Rectangle(toRadians(west), toRadians(south), toRadians(east), toRadians(north))
  }

  static contains(
    rectangle: { west: number; south: number; east: number; north: number },
    position: { longitude: number; latitude: number },
  ) {
    return (
      position.longitude >= rectangle.west &&
      position.longitude <= rectangle.east &&
      position.latitude >= rectangle.south &&
      position.latitude <= rectangle.north
    )
  }

  constructor(
    public west = 0,
    public south = 0,
    public east = 0,
    public north = 0,
  ) {}
}

export const Math = {
  PI_OVER_TWO: globalThis.Math.PI / 2,
  TWO_PI: globalThis.Math.PI * 2,
  toRadians(degrees: number) {
    return (degrees * globalThis.Math.PI) / 180
  },
  toDegrees(radians: number) {
    return (radians * 180) / globalThis.Math.PI
  },
}

export const HeightReference = {
  CLAMP_TO_GROUND: 1,
}

export const VerticalOrigin = {
  BOTTOM: 1,
}

export const ColorBlendMode = {
  MIX: 1,
}

export const ShadowMode = {
  CAST_ONLY: 1,
  ENABLED: 2,
}

export const ClockRange = {
  LOOP_STOP: 1,
}

export const LagrangePolynomialApproximation = {
  type: 'LagrangePolynomialApproximation',
}

export const ScreenSpaceEventType = {
  LEFT_CLICK: 1,
}

export const SceneTransforms = {
  worldToWindowCoordinates: vi.fn<() => { x: number; y: number }>(() => ({ x: 160, y: 120 })),
}

export const sampleTerrainMostDetailed = vi.fn<
  (_provider: unknown, positions: unknown[]) => Promise<{ height: number }[]>
>((_provider, positions) => {
  terrainSampleRequests.push(positions)
  return Promise.resolve(positions.map(() => ({ height: 130 })))
})

export function resetCesiumMock() {
  viewerInstances.length = 0
  tileProviderInstances.length = 0
  imageryLayerInstances.length = 0
  groundPrimitiveInstances.length = 0
  primitiveInstances.length = 0
  materialInstances.length = 0
  polylineDashMaterialInstances.length = 0
  scenePrimitiveAdds.length = 0
  scenePrimitiveRemoves.length = 0
  elevationProviderRequests.length = 0
  elevationTerrainProviderInstances.length = 0
  cesiumTerrainProviderRequests.length = 0
  cesiumTerrainProviderInstances.length = 0
  tileLoadProgressListeners.length = 0
  entityCollectionInstances.length = 0
  dataSourceInstances.length = 0
  billboardCollectionInstances.length = 0
  cloudCollectionInstances.length = 0
  screenSpaceEventHandlerInstances.length = 0
  terrainSampleRequests.length = 0
  modelInstances.length = 0
  postProcessStageInstances.length = 0
  skyBoxInstances.length = 0
  cesium3DTilesetInstances.length = 0
  cesium3DTilesetRequests.length = 0
  cesiumMockState.failNextViewer = false
  cesiumMockState.failNextImageryLayer = false
  cesiumMockState.groundMaterialsSupported = true
  cesiumMockState.groundTerrainHeightsOutcome = 'success'
  cesiumMockState.elevationProviderOutcome = 'success'
  cesiumMockState.elevationProviderPromise = undefined
  cesiumMockState.cesiumTerrainProviderOutcome = 'success'
  cesiumMockState.cesiumTerrainProviderPromise = undefined
  cesiumMockState.cesium3DTilesetPromise = undefined
  cesiumMockState.geoJsonOutcome = 'success'
  GroundPrimitive.supportsMaterials.mockClear()
  GroundPrimitive.initializeTerrainHeights.mockClear()
  Transforms.eastNorthUpToFixedFrame.mockClear()
  Transforms.headingPitchRollQuaternion.mockClear()
  Transforms.headingPitchRollToFixedFrame.mockClear()
  Matrix4.fromRotationTranslation.mockClear()
  Matrix3.fromQuaternion.mockClear()
  SceneTransforms.worldToWindowCoordinates.mockClear()
  sampleTerrainMostDetailed.mockClear()
  buildModuleUrl.mockClear()
}
