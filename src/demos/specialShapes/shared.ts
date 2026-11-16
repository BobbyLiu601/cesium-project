import * as Cesium from 'cesium'
import { ref, type Ref } from 'vue'

import type { SpecialShapeAnimationState, StatusReporter } from '@/demos/specialShapes/types'

const TERRAIN_URL = 'https://data.mars3d.cn/terrain'
const TERRAIN_TIMEOUT_MS = 9_000

interface TrailMaterialValue {
  color?: Cesium.Color
  image?: string
  time?: number
}

interface TrailMaterialDefinition {
  color: Cesium.Color
  durationMs: number
  image: string
  source: string
  type: string
}

interface MaterialCache {
  addMaterial: (
    type: string,
    definition: {
      fabric: {
        source: string
        type: string
        uniforms: TrailMaterialValue
      }
      translucent: () => boolean
    },
  ) => void
}

export interface SpecialShapeAnimationController {
  state: Ref<SpecialShapeAnimationState>
  dispose: () => void
  elapsedMs: () => number
  toggle: () => SpecialShapeAnimationState
}

const registeredTrailMaterials = new Set<string>()

class TextureTrailMaterialProperty implements Cesium.MaterialProperty {
  readonly definitionChanged = new Cesium.Event()
  readonly isConstant = false

  constructor(
    private readonly options: TrailMaterialDefinition,
    private readonly animationElapsedMs: () => number,
  ) {}

  getType() {
    return this.options.type
  }

  getValue(_time: Cesium.JulianDate, result?: TrailMaterialValue) {
    const value = result ?? {}
    value.color = this.options.color
    value.image = this.options.image
    value.time = (this.animationElapsedMs() % this.options.durationMs) / this.options.durationMs
    return value
  }

  equals(other?: Cesium.MaterialProperty): boolean {
    if (this === other) {
      return true
    }

    return (
      other instanceof TextureTrailMaterialProperty &&
      other.options.type === this.options.type &&
      other.options.image === this.options.image &&
      other.options.durationMs === this.options.durationMs
    )
  }
}

export function createSpecialShapeAbortError() {
  return new DOMException('特殊形状场景加载已取消', 'AbortError')
}

export function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw createSpecialShapeAbortError()
  }
}

export function applySpecialShapeSceneDefaults(viewer: Cesium.Viewer) {
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07111f')
  viewer.scene.globe.enableLighting = false
  viewer.shadows = false
  viewer.clock.shouldAnimate = false
}

export function createSpecialShapeAnimation(
  viewer: Cesium.Viewer,
  update: (elapsedMs: number) => void,
): SpecialShapeAnimationController {
  const state = ref<SpecialShapeAnimationState>('playing')
  let elapsed = 0
  let lastUpdatedAt = Date.now()
  let listening = false

  const tick = () => {
    if (state.value !== 'playing') {
      return
    }

    const now = Date.now()
    elapsed += Math.max(0, now - lastUpdatedAt)
    lastUpdatedAt = now
    update(elapsed)
    viewer.scene.requestRender()
  }

  const startListening = () => {
    if (listening) {
      return
    }

    listening = true
    lastUpdatedAt = Date.now()
    viewer.scene.preUpdate.addEventListener(tick)
    viewer.scene.requestRender()
  }

  const stopListening = () => {
    if (!listening) {
      return
    }

    listening = false
    viewer.scene.preUpdate.removeEventListener(tick)
  }

  update(0)
  startListening()

  return {
    dispose: stopListening,
    elapsedMs: () => elapsed,
    state,
    toggle: () => {
      if (state.value === 'playing') {
        state.value = 'paused'
        stopListening()
      } else {
        state.value = 'playing'
        startListening()
      }

      viewer.scene.requestRender()
      return state.value
    },
  }
}

export function createTextureTrailMaterial(
  options: TrailMaterialDefinition,
  animationElapsedMs: () => number,
) {
  ensureTrailMaterial(options)
  return new TextureTrailMaterialProperty(options, animationElapsedMs)
}

function ensureTrailMaterial(options: TrailMaterialDefinition) {
  if (registeredTrailMaterials.has(options.type)) {
    return
  }

  registeredTrailMaterials.add(options.type)
  const materialCache = (
    Cesium.Material as unknown as {
      _materialCache?: MaterialCache
    }
  )._materialCache

  materialCache?.addMaterial(options.type, {
    fabric: {
      source: options.source,
      type: options.type,
      uniforms: {
        color: options.color,
        image: options.image,
        time: 0,
      },
    },
    translucent: () => true,
  })
}

export function createOrbitOrientation(origin: Cesium.Cartesian3, target: Cesium.Cartesian3) {
  const direction = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.subtract(target, origin, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  const up = Cesium.Cartesian3.normalize(origin, new Cesium.Cartesian3())
  const right = Cesium.Cartesian3.normalize(
    Cesium.Cartesian3.cross(direction, up, new Cesium.Cartesian3()),
    new Cesium.Cartesian3(),
  )
  const cameraRight = Cesium.Cartesian3.negate(right, new Cesium.Cartesian3())
  const rotation = new Cesium.Matrix3()

  Cesium.Matrix3.setColumn(rotation, 0, cameraRight, rotation)
  Cesium.Matrix3.setColumn(rotation, 1, up, rotation)
  Cesium.Matrix3.setColumn(rotation, 2, direction, rotation)

  return Cesium.Quaternion.fromRotationMatrix(rotation)
}

export function removeEntities(viewer: Cesium.Viewer, entities: Cesium.Entity[]) {
  for (const entity of entities) {
    viewer.entities.remove(entity)
  }
  entities.length = 0
}

export function removePrimitives(viewer: Cesium.Viewer, primitives: Cesium.Primitive[]) {
  for (const primitive of primitives) {
    viewer.scene.primitives.remove(primitive)
    if (!primitive.isDestroyed()) {
      primitive.destroy()
    }
  }
  primitives.length = 0
}

export async function loadSpecialShapeTerrain(
  viewer: Cesium.Viewer,
  signal?: AbortSignal,
): Promise<boolean> {
  throwIfAborted(signal)

  let timeoutId: ReturnType<typeof setTimeout> | undefined
  let abortHandler: (() => void) | undefined
  const providerPromise = Cesium.CesiumTerrainProvider.fromUrl(TERRAIN_URL)

  try {
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('特殊形状地形加载超时')), TERRAIN_TIMEOUT_MS)
    })
    const abortPromise = new Promise<never>((_, reject) => {
      abortHandler = () => reject(createSpecialShapeAbortError())
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
      throw createSpecialShapeAbortError()
    }

    console.error('特殊形状地形加载失败，已回退椭球地形。', error)
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

export function loadTerrainWithoutBlocking(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) {
  void loadSpecialShapeTerrain(viewer, signal)
    .then((loaded) => {
      if (!signal?.aborted) {
        setStatus(
          loaded
            ? '视锥体自动移动播放中，已加载 Mars3D 地形'
            : '视锥体自动移动播放中，地形加载失败，已回退椭球地形',
        )
      }
    })
    .catch((error: unknown) => {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        console.error('特殊形状地形初始化失败。', error)
      }
    })
}
