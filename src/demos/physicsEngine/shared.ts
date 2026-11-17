import {
  BoxGeometry,
  CallbackProperty,
  Cartesian3,
  Color,
  ColorGeometryInstanceAttribute,
  EllipsoidGeometry,
  GeometryInstance,
  Material,
  Matrix3,
  Matrix4,
  PerInstanceColorAppearance,
  PolygonHierarchy,
  PolylineCollection,
  Primitive,
  Quaternion,
  Transforms,
  VertexFormat,
  type Entity,
  type Polyline,
  type Viewer,
} from 'cesium'
import type { Ref } from 'vue'
import { ref } from 'vue'

import type { DemoSceneAction } from '@/demos/useDemoGlobe'
import { PhysicsQualityGovernor, type PhysicsQualitySettings } from './qualityGovernor'
import { PhysicsStatusPublisher } from './status'
import type { AmmoApi, PhysicsAnimationState, PhysicsControl, PhysicsSceneStats } from './types'

export interface LocalPoint {
  x: number
  y: number
  z: number
}

export interface LocalQuaternion {
  w: number
  x: number
  y: number
  z: number
}

export interface MutableTransform extends LocalPoint, LocalQuaternion {}

export interface RigidBoxOptions {
  color: Color
  halfExtents: LocalPoint
  mass: number
  position: LocalPoint
  rotation?: LocalQuaternion
  sync?: boolean
  visible?: boolean
}

export interface RigidSphereOptions {
  color: Color
  mass: number
  position: LocalPoint
  radius: number
  sync?: boolean
}

export interface PhysicsRigidEntry {
  body: InstanceType<AmmoApi['btRigidBody']>
  motionStateTransform: InstanceType<AmmoApi['btTransform']>
  shape: InstanceType<AmmoApi['btCollisionShape']>
  transform: {
    position: LocalPoint
    rotation: LocalQuaternion
  }
  visual?: PhysicsPrimitiveVisual
}

export interface PhysicsPrimitiveVisual {
  primitive: Primitive
  sync: boolean
  transform: {
    position: LocalPoint
    rotation: LocalQuaternion
  }
}

const DEFAULT_QUATERNION: LocalQuaternion = { w: 1, x: 0, y: 0, z: 0 }
const STATS_REFRESH_INTERVAL_MS = 500
const ZERO_POINT: LocalPoint = { x: 0, y: 0, z: 0 }

function cloneQuaternion(value: LocalQuaternion | undefined) {
  return value ? { ...value } : { ...DEFAULT_QUATERNION }
}

export function toLocalQuaternion(value: LocalQuaternion): LocalQuaternion {
  const length = Math.hypot(value.x, value.y, value.z, value.w) || 1
  return {
    w: value.w / length,
    x: value.x / length,
    y: value.y / length,
    z: value.z / length,
  }
}

export function quaternionFromAxisAngle(axis: LocalPoint, angle: number): LocalQuaternion {
  const halfAngle = angle * 0.5
  const sin = Math.sin(halfAngle)
  return toLocalQuaternion({
    w: Math.cos(halfAngle),
    x: axis.x * sin,
    y: axis.y * sin,
    z: axis.z * sin,
  })
}

export function createInitialStats(): PhysicsSceneStats {
  return {
    bodyCount: 0,
    brokenBodyCount: 0,
    dynamicBodyCount: 0,
    projectileCount: 0,
    softBodyCount: 0,
    vehicleSpeed: 0,
  }
}

export class PhysicsRuntime {
  readonly ammo: AmmoApi
  readonly entities: Entity[] = []
  readonly rigidEntries: PhysicsRigidEntry[] = []
  readonly stats: Ref<PhysicsSceneStats>
  readonly supportsSoftBodies: boolean
  readonly viewer: Viewer
  readonly world: InstanceType<AmmoApi['btDiscreteDynamicsWorld']>
  readonly worldInfo: InstanceType<AmmoApi['btSoftBodyWorldInfo']> | undefined

  private readonly actions: InstanceType<AmmoApi['btActionInterface']>[] = []
  private readonly constraints: InstanceType<AmmoApi['btTypedConstraint']>[] = []
  private readonly collisionConfiguration: InstanceType<AmmoApi['btDefaultCollisionConfiguration']>
  private readonly dispatcher: InstanceType<AmmoApi['btCollisionDispatcher']>
  private readonly enuQuaternion: Quaternion
  private readonly enuTransform: Matrix4
  private readonly enuTransformInverse: Matrix4
  private readonly localQuaternionScratch = new Quaternion()
  private readonly positionScratch = new Cartesian3()
  private readonly primitiveMatrices = new WeakMap<
    PhysicsPrimitiveVisual,
    { matrixA: Matrix4; matrixB: Matrix4; useMatrixB: boolean }
  >()
  private readonly primitives: Primitive[] = []
  private readonly dynamicPolylines: Array<{
    getPositions: () => Cartesian3[]
    line: Polyline
  }> = []
  private readonly rotationScratch = new Matrix3()
  private readonly worldPositionScratch = new Cartesian3()
  private readonly worldQuaternionScratch = new Quaternion()
  private readonly softBodySolver: InstanceType<AmmoApi['btDefaultSoftBodySolver']> | undefined
  private readonly softBodies: InstanceType<AmmoApi['btSoftBody']>[] = []
  private polylineCollection: PolylineCollection | undefined
  private disposed = false
  private lastStatsRefreshAt = -Infinity

  constructor(
    ammo: AmmoApi,
    viewer: Viewer,
    site: { height: number; latitude: number; longitude: number },
    softBodies = false,
    stats: Ref<PhysicsSceneStats> = ref(createInitialStats()),
  ) {
    this.ammo = ammo
    this.viewer = viewer
    this.supportsSoftBodies = softBodies
    this.stats = stats
    this.stats.value = createInitialStats()

    const center = Cartesian3.fromDegrees(site.longitude, site.latitude, site.height)
    this.enuTransform = Transforms.eastNorthUpToFixedFrame(center)
    this.enuTransformInverse = Matrix4.inverseTransformation(this.enuTransform, new Matrix4())
    this.enuQuaternion = Quaternion.fromRotationMatrix(
      Matrix4.getMatrix3(this.enuTransform, new Matrix3()),
    )

    if (viewer.scene.globe) {
      viewer.scene.globe.depthTestAgainstTerrain = false
    }

    this.collisionConfiguration = softBodies
      ? new ammo.btSoftBodyRigidBodyCollisionConfiguration()
      : new ammo.btDefaultCollisionConfiguration()
    this.dispatcher = new ammo.btCollisionDispatcher(this.collisionConfiguration)
    const broadphase = new ammo.btDbvtBroadphase()
    const solver = new ammo.btSequentialImpulseConstraintSolver()
    if (softBodies) {
      this.softBodySolver = new ammo.btDefaultSoftBodySolver()
      this.world = new ammo.btSoftRigidDynamicsWorld(
        this.dispatcher,
        broadphase,
        solver,
        this.collisionConfiguration,
        this.softBodySolver,
      )
      this.worldInfo = (
        this.world as InstanceType<AmmoApi['btSoftRigidDynamicsWorld']>
      ).getWorldInfo()
      this.worldInfo.set_m_gravity(new ammo.btVector3(0, 0, -9.82))
    } else {
      this.softBodySolver = undefined
      this.worldInfo = undefined
      this.world = new ammo.btDiscreteDynamicsWorld(
        this.dispatcher,
        broadphase,
        solver,
        this.collisionConfiguration,
      )
    }
    this.world.setGravity(new ammo.btVector3(0, 0, -9.82))
  }

  localToWorld(x: number, y: number, z: number, result = new Cartesian3()) {
    this.positionScratch.x = x
    this.positionScratch.y = y
    this.positionScratch.z = z
    return Matrix4.multiplyByPoint(this.enuTransform, this.positionScratch, result)
  }

  worldToLocal(worldPosition: Cartesian3, result: LocalPoint = point()) {
    Matrix4.multiplyByPoint(this.enuTransformInverse, worldPosition, this.positionScratch)
    result.x = this.positionScratch.x
    result.y = this.positionScratch.y
    result.z = this.positionScratch.z
    return result
  }

  localQuaternionToWorld(value: LocalQuaternion, result = new Quaternion()) {
    this.localQuaternionScratch.x = value.x
    this.localQuaternionScratch.y = value.y
    this.localQuaternionScratch.z = value.z
    this.localQuaternionScratch.w = value.w
    return Quaternion.multiply(this.enuQuaternion, this.localQuaternionScratch, result)
  }

  addEntity(entity: Entity) {
    this.entities.push(entity)
    return entity
  }

  addDynamicPolyline(
    getPositions: () => Cartesian3[],
    options: {
      color: Color
      id?: string
      width: number
    },
  ) {
    if (!this.polylineCollection) {
      this.polylineCollection = new PolylineCollection({ modelMatrix: this.enuTransform })
      this.viewer.scene.primitives.add(this.polylineCollection)
    }

    const line = this.polylineCollection.add({
      id: options.id,
      positions: getPositions(),
      width: options.width,
      material: Material.fromType('Color', { color: options.color }),
    })
    this.dynamicPolylines.push({ getPositions, line })
    return line
  }

  addDynamicPolygon(
    getPositions: () => Cartesian3[],
    options: {
      color: Color
      id?: string
    },
  ) {
    const entity = this.viewer.entities.add({
      id: options.id,
      polygon: {
        hierarchy: new CallbackProperty(() => new PolygonHierarchy(getPositions()), false),
        material: options.color,
        perPositionHeight: true,
      },
    })
    this.entities.push(entity)
    return entity
  }

  addLabel(
    position: LocalPoint,
    text: string,
    options: { color?: Color; id: string; scale?: number },
  ) {
    return this.addEntity(
      this.viewer.entities.add({
        id: options.id,
        position: this.localToWorld(position.x, position.y, position.z),
        label: {
          text,
          font: '600 13px "Noto Sans SC", sans-serif',
          fillColor: options.color ?? Color.WHITE,
          outlineColor: Color.fromCssColorString('#06121f'),
          outlineWidth: 3,
          style: 2,
          scale: options.scale ?? 1,
          verticalOrigin: 0,
        },
      }),
    )
  }

  addStaticBox(options: Omit<RigidBoxOptions, 'mass' | 'sync'>) {
    return this.addBox({ ...options, mass: 0, sync: false })
  }

  addBox(options: RigidBoxOptions) {
    const shape = new this.ammo.btBoxShape(
      new this.ammo.btVector3(options.halfExtents.x, options.halfExtents.y, options.halfExtents.z),
    )
    shape.setMargin(0.04)
    const primitive =
      options.visible === false
        ? undefined
        : this.createPrimitive(
            BoxGeometry.fromDimensions({
              dimensions: new Cartesian3(
                options.halfExtents.x * 2,
                options.halfExtents.y * 2,
                options.halfExtents.z * 2,
              ),
              vertexFormat: VertexFormat.POSITION_ONLY,
            }),
            options.color,
          )

    return this.createRigidEntry({
      mass: options.mass,
      position: options.position,
      primitive,
      rotation: options.rotation,
      shape,
      sync: options.sync ?? options.mass > 0,
    })
  }

  addSphere(options: RigidSphereOptions) {
    const shape = new this.ammo.btSphereShape(options.radius)
    shape.setMargin(0.03)
    const primitive = this.createPrimitive(
      new EllipsoidGeometry({
        radii: new Cartesian3(options.radius, options.radius, options.radius),
        slicePartitions: 24,
        stackPartitions: 16,
        vertexFormat: VertexFormat.POSITION_ONLY,
      }),
      options.color,
    )

    return this.createRigidEntry({
      mass: options.mass,
      position: options.position,
      primitive,
      shape,
      sync: options.sync ?? options.mass > 0,
    })
  }

  addAction(action: InstanceType<AmmoApi['btActionInterface']>) {
    this.world.addAction(action)
    this.actions.push(action)
  }

  addConstraint(constraint: InstanceType<AmmoApi['btTypedConstraint']>, disableCollisions = true) {
    this.world.addConstraint(constraint, disableCollisions)
    this.constraints.push(constraint)
  }

  addSoftBody(body: InstanceType<AmmoApi['btSoftBody']>) {
    if (!this.supportsSoftBodies) {
      throw new Error('当前物理世界未启用软体支持')
    }
    ;(this.world as InstanceType<AmmoApi['btSoftRigidDynamicsWorld']>).addSoftBody(body, 1, -1)
    this.softBodies.push(body)
    this.stats.value = {
      ...this.stats.value,
      softBodyCount: this.softBodies.length,
    }
  }

  removeSoftBody(body: InstanceType<AmmoApi['btSoftBody']>) {
    if (this.supportsSoftBodies) {
      ;(this.world as InstanceType<AmmoApi['btSoftRigidDynamicsWorld']>).removeSoftBody(body)
    }
    const index = this.softBodies.indexOf(body)
    if (index >= 0) {
      this.softBodies.splice(index, 1)
    }
    this.stats.value = {
      ...this.stats.value,
      softBodyCount: this.softBodies.length,
    }
  }

  removeRigidEntry(entry: PhysicsRigidEntry) {
    this.world.removeRigidBody(entry.body)
    if (entry.visual) {
      this.removePrimitiveVisual(entry.visual)
    }
    const index = this.rigidEntries.indexOf(entry)
    if (index >= 0) {
      this.rigidEntries.splice(index, 1)
    }
    this.disposeAmmo(entry.body.getMotionState())
    this.disposeAmmo(entry.shape)
    this.disposeAmmo(entry.motionStateTransform)
    this.disposeAmmo(entry.body)
    this.refreshBodyStats(true)
  }

  step(deltaSeconds: number) {
    if (this.disposed) {
      return
    }
    const delta = Math.min(Math.max(deltaSeconds, 1 / 120), 1 / 30)
    this.world.stepSimulation(delta, 1, 1 / 30)
    this.syncRigidBodies()
    this.updateDynamicPolylines()
    this.refreshBodyStats()
  }

  syncRigidBodies() {
    for (const entry of this.rigidEntries) {
      if (!entry.visual?.sync) {
        continue
      }
      const motionState = entry.body.getMotionState()
      if (!motionState) {
        continue
      }
      motionState.getWorldTransform(entry.motionStateTransform)
      const origin = entry.motionStateTransform.getOrigin()
      const rotation = entry.motionStateTransform.getRotation()
      entry.transform.position.x = origin.x()
      entry.transform.position.y = origin.y()
      entry.transform.position.z = origin.z()
      entry.transform.rotation.w = rotation.w()
      entry.transform.rotation.x = rotation.x()
      entry.transform.rotation.y = rotation.y()
      entry.transform.rotation.z = rotation.z()
      if (entry.visual) {
        this.refreshPrimitiveVisual(entry.visual)
      }
    }
  }

  refreshPrimitiveVisual(visual: PhysicsPrimitiveVisual) {
    const matrices = this.primitiveMatrices.get(visual)
    if (!matrices) {
      return
    }
    matrices.useMatrixB = !matrices.useMatrixB
    const matrix = matrices.useMatrixB ? matrices.matrixB : matrices.matrixA
    const position = this.localToWorld(
      visual.transform.position.x,
      visual.transform.position.y,
      visual.transform.position.z,
      this.worldPositionScratch,
    )
    const worldRotation = this.localQuaternionToWorld(
      visual.transform.rotation,
      this.worldQuaternionScratch,
    )
    Matrix3.fromQuaternion(worldRotation, this.rotationScratch)
    Matrix4.fromRotationTranslation(this.rotationScratch, position, matrix)
    visual.primitive.modelMatrix = matrix
  }

  private createPrimitive(geometry: BoxGeometry | EllipsoidGeometry, color: Color) {
    return this.createPrimitiveFromInstances(
      [
        new GeometryInstance({
          attributes: {
            color: ColorGeometryInstanceAttribute.fromColor(color),
          },
          geometry,
        }),
      ],
      color.alpha < 0.9,
    )
  }

  private createPrimitiveFromInstances(
    geometryInstances: GeometryInstance[],
    translucent: boolean,
  ) {
    const primitive = new Primitive({
      allowPicking: false,
      appearance: new PerInstanceColorAppearance({
        flat: true,
        translucent,
      }),
      asynchronous: false,
      cull: false,
      compressVertices: false,
      geometryInstances,
      interleave: false,
      releaseGeometryInstances: false,
      vertexCacheOptimize: false,
    })
    this.viewer.scene.primitives.add(primitive)
    this.primitives.push(primitive)
    return primitive
  }

  private createPrimitiveVisual(options: {
    position: LocalPoint
    primitive: Primitive
    rotation?: LocalQuaternion
    sync: boolean
  }) {
    const visual: PhysicsPrimitiveVisual = {
      primitive: options.primitive,
      sync: options.sync,
      transform: {
        position: { ...options.position },
        rotation: cloneQuaternion(options.rotation),
      },
    }
    this.primitiveMatrices.set(visual, {
      matrixA: new Matrix4(),
      matrixB: new Matrix4(),
      useMatrixB: false,
    })
    this.refreshPrimitiveVisual(visual)
    return visual
  }

  private removePrimitiveVisual(visual: PhysicsPrimitiveVisual) {
    this.viewer.scene.primitives.remove(visual.primitive)
    const primitiveIndex = this.primitives.indexOf(visual.primitive)
    if (primitiveIndex >= 0) {
      this.primitives.splice(primitiveIndex, 1)
    }
    this.primitiveMatrices.delete(visual)
  }

  private updateDynamicPolylines() {
    for (const entry of this.dynamicPolylines) {
      entry.line.positions = entry.getPositions()
    }
  }

  refreshBodyStats(force = false) {
    const now = performance.now()
    if (!force && now - this.lastStatsRefreshAt < STATS_REFRESH_INTERVAL_MS) {
      return
    }
    this.lastStatsRefreshAt = now

    const bodyCount = this.rigidEntries.length
    const dynamicBodyCount = this.rigidEntries.filter((entry) => entry.body.isActive()).length
    if (
      this.stats.value.bodyCount === bodyCount &&
      this.stats.value.dynamicBodyCount === dynamicBodyCount
    ) {
      return
    }
    this.stats.value = {
      ...this.stats.value,
      bodyCount,
      dynamicBodyCount,
    }
  }

  dispose() {
    if (this.disposed) {
      return
    }
    this.disposed = true

    for (const constraint of this.constraints) {
      this.world.removeConstraint(constraint)
      this.disposeAmmo(constraint)
    }
    this.constraints.length = 0

    for (const action of this.actions) {
      this.world.removeAction(action)
      this.disposeAmmo(action)
    }
    this.actions.length = 0

    for (const entry of this.rigidEntries) {
      this.world.removeRigidBody(entry.body)
      this.disposeAmmo(entry.body.getMotionState())
      this.disposeAmmo(entry.shape)
      this.disposeAmmo(entry.motionStateTransform)
      this.disposeAmmo(entry.body)
    }
    this.rigidEntries.length = 0

    if (this.supportsSoftBodies) {
      const softWorld = this.world as InstanceType<AmmoApi['btSoftRigidDynamicsWorld']>
      for (const softBody of this.softBodies) {
        softWorld.removeSoftBody(softBody)
        this.disposeAmmo(softBody)
      }
    }
    this.softBodies.length = 0

    for (const entity of this.entities) {
      this.viewer.entities.remove(entity)
    }
    this.entities.length = 0

    for (const primitive of this.primitives) {
      this.viewer.scene.primitives.remove(primitive)
    }
    this.primitives.length = 0
    if (this.polylineCollection) {
      this.viewer.scene.primitives.remove(this.polylineCollection)
      this.polylineCollection = undefined
    }
    this.dynamicPolylines.length = 0

    this.disposeAmmo(this.world)
    this.disposeAmmo(this.softBodySolver)
    this.disposeAmmo(this.dispatcher)
    this.disposeAmmo(this.collisionConfiguration)
  }

  protected createRigidEntry(options: {
    mass: number
    position: LocalPoint
    primitive?: Primitive
    rotation?: LocalQuaternion
    shape: InstanceType<AmmoApi['btCollisionShape']>
    sync: boolean
  }) {
    const transform = new this.ammo.btTransform()
    const rotation = cloneQuaternion(options.rotation)
    transform.setIdentity()
    transform.setOrigin(
      new this.ammo.btVector3(options.position.x, options.position.y, options.position.z),
    )
    transform.setRotation(
      new this.ammo.btQuaternion(rotation.x, rotation.y, rotation.z, rotation.w),
    )

    const motionState = new this.ammo.btDefaultMotionState(transform)
    const inertia = new this.ammo.btVector3(0, 0, 0)
    if (options.mass > 0) {
      options.shape.calculateLocalInertia(options.mass, inertia)
    }
    const constructionInfo = new this.ammo.btRigidBodyConstructionInfo(
      options.mass,
      motionState,
      options.shape,
      inertia,
    )
    const body = new this.ammo.btRigidBody(constructionInfo)
    body.setFriction(0.7)
    this.world.addRigidBody(body)

    const visual = options.primitive
      ? this.createPrimitiveVisual({
          position: options.position,
          primitive: options.primitive,
          rotation,
          sync: options.sync,
        })
      : undefined
    const entry = {
      body,
      motionStateTransform: transform,
      shape: options.shape,
      transform: visual?.transform ?? {
        position: { ...options.position },
        rotation: { ...rotation },
      },
      visual,
    }

    this.rigidEntries.push(entry)
    this.disposeAmmo(constructionInfo)
    this.disposeAmmo(inertia)
    this.refreshBodyStats(true)
    return entry
  }

  protected disposeAmmo(value: unknown) {
    if (!value) {
      return
    }
    try {
      this.ammo.destroy(value)
    } catch {
      // Some action wrappers own nested objects internally.
    }
  }
}

export interface PhysicsSceneControllerOptions {
  ammo: AmmoApi
  site: { height: number; latitude: number; longitude: number }
  setStatus: (message: string) => void
  viewer: Viewer
}

export abstract class BasePhysicsScene {
  readonly animationState: Ref<PhysicsAnimationState> = ref('playing')
  readonly controls: PhysicsControl[] = []
  readonly actions: DemoSceneAction[] = []
  readonly stats: Ref<PhysicsSceneStats> = ref(createInitialStats())

  protected readonly ammo: AmmoApi
  protected readonly site: { height: number; latitude: number; longitude: number }
  protected readonly status: PhysicsStatusPublisher
  protected readonly viewer: Viewer
  protected runtime: PhysicsRuntime
  private lastFrameTime: number | undefined
  private readonly sceneCleanups: Array<() => void> = []
  private readonly removePreUpdateListener: () => void
  private readonly qualityGovernor: PhysicsQualityGovernor
  private readonly softBodies: boolean

  constructor(
    { ammo, setStatus, site, viewer }: PhysicsSceneControllerOptions,
    softBodies = false,
  ) {
    this.ammo = ammo
    this.site = site
    this.status = new PhysicsStatusPublisher(setStatus)
    this.viewer = viewer
    this.softBodies = softBodies
    this.runtime = new PhysicsRuntime(ammo, viewer, site, softBodies, this.stats)
    this.qualityGovernor = new PhysicsQualityGovernor((settings) =>
      this.applyQualitySettings(settings),
    )

    this.removePreUpdateListener = viewer.scene.preUpdate.addEventListener(() => this.onFrame())
  }

  initialize() {
    this.buildScene()
  }

  reset() {
    this.animationState.value = 'playing'
    this.lastFrameTime = undefined
    this.runSceneCleanups()
    this.runtime.dispose()
    this.runtime = this.createRuntime()
    this.buildScene()
  }

  toggleAnimation() {
    this.animationState.value = this.animationState.value === 'playing' ? 'paused' : 'playing'
    this.lastFrameTime = undefined
  }

  dispose() {
    this.removePreUpdateListener()
    this.runSceneCleanups()
    this.runtime.dispose()
  }

  protected abstract buildScene(): void
  protected createRuntime() {
    return new PhysicsRuntime(this.ammo, this.viewer, this.site, this.softBodies, this.stats)
  }
  protected addSceneCleanup(cleanup: () => void) {
    this.sceneCleanups.push(cleanup)
  }
  protected beforeStep(_deltaSeconds: number) {}
  protected afterStep(_deltaSeconds: number) {}

  private runSceneCleanups() {
    for (const cleanup of this.sceneCleanups.splice(0)) {
      cleanup()
    }
  }

  private onFrame() {
    if (this.animationState.value === 'paused') {
      return
    }

    const now = performance.now()
    const previousFrameTime = this.lastFrameTime
    const deltaSeconds = previousFrameTime ? (now - previousFrameTime) / 1_000 : 1 / 60
    this.lastFrameTime = now
    if (previousFrameTime) {
      this.qualityGovernor.noteFrame(now - previousFrameTime)
    }
    this.beforeStep(deltaSeconds)
    this.runtime.step(deltaSeconds)
    this.afterStep(deltaSeconds)
    this.viewer.scene.requestRender()
  }

  private applyQualitySettings(settings: PhysicsQualitySettings) {
    if (settings.effects === 'reduced') {
      this.viewer.scene.msaaSamples = 1
      const fxaa = this.viewer.scene.postProcessStages?.fxaa
      if (fxaa) {
        fxaa.enabled = false
      }
      if (this.viewer.scene.fog) {
        this.viewer.scene.fog.enabled = false
      }
      if (this.viewer.scene.skyAtmosphere) {
        this.viewer.scene.skyAtmosphere.show = false
      }
      if (this.viewer.scene.skyBox) {
        this.viewer.scene.skyBox.show = false
      }
      if (this.viewer.scene.globe) {
        this.viewer.scene.globe.showGroundAtmosphere = false
      }
    }

    if (this.viewer.scene.globe) {
      this.viewer.scene.globe.maximumScreenSpaceError = settings.maximumScreenSpaceError
    }
    this.viewer.resolutionScale = settings.resolutionScale
    this.viewer.scene.requestRender()
  }
}

export function point(x = ZERO_POINT.x, y = ZERO_POINT.y, z = ZERO_POINT.z): LocalPoint {
  return { x, y, z }
}
