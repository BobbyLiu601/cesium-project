import {
  CallbackProperty,
  Cartesian3,
  Color,
  Matrix3,
  Matrix4,
  Quaternion,
  Transforms,
  type Entity,
  type Viewer,
} from 'cesium'
import type { Ref } from 'vue'
import { ref } from 'vue'

import type { DemoSceneAction } from '@/demos/useDemoGlobe'
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
  entity: Entity
  motionStateTransform: InstanceType<AmmoApi['btTransform']>
  shape: InstanceType<AmmoApi['btCollisionShape']>
  transform: {
    position: LocalPoint
    rotation: LocalQuaternion
  }
}

const DEFAULT_QUATERNION: LocalQuaternion = { w: 1, x: 0, y: 0, z: 0 }
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
  private readonly softBodySolver: InstanceType<AmmoApi['btDefaultSoftBodySolver']> | undefined
  private readonly softBodies: InstanceType<AmmoApi['btSoftBody']>[] = []
  private disposed = false

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
    return Matrix4.multiplyByPoint(this.enuTransform, new Cartesian3(x, y, z), result)
  }

  localQuaternionToWorld(value: LocalQuaternion, result = new Quaternion()) {
    return Quaternion.multiply(
      this.enuQuaternion,
      new Quaternion(value.x, value.y, value.z, value.w),
      result,
    )
  }

  addEntity(entity: Entity) {
    this.entities.push(entity)
    return entity
  }

  addDynamicPolyline(
    getPositions: () => Cartesian3[],
    options: {
      color: Color
      id: string
      width: number
      clampToGround?: boolean
    },
  ) {
    return this.addEntity(
      this.viewer.entities.add({
        id: options.id,
        polyline: {
          positions: new CallbackProperty(getPositions, false),
          width: options.width,
          material: options.color,
          clampToGround: options.clampToGround ?? false,
        },
      }),
    )
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

    return this.createRigidEntry({
      color: options.color,
      entityFactory: (position, orientation) =>
        this.viewer.entities.add({
          position,
          orientation,
          box: {
            dimensions: new Cartesian3(
              options.halfExtents.x * 2,
              options.halfExtents.y * 2,
              options.halfExtents.z * 2,
            ),
            material: options.color,
            outline: true,
            outlineColor: Color.fromCssColorString('#071521').withAlpha(0.8),
          },
        }),
      mass: options.mass,
      position: options.position,
      rotation: options.rotation,
      shape,
      sync: options.sync ?? options.mass > 0,
    })
  }

  addSphere(options: RigidSphereOptions) {
    const shape = new this.ammo.btSphereShape(options.radius)
    shape.setMargin(0.03)

    return this.createRigidEntry({
      color: options.color,
      entityFactory: (position) =>
        this.viewer.entities.add({
          position,
          ellipsoid: {
            radii: new Cartesian3(options.radius, options.radius, options.radius),
            material: options.color,
          },
        }),
      mass: options.mass,
      position: options.position,
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
    this.viewer.entities.remove(entry.entity)
    const index = this.rigidEntries.indexOf(entry)
    if (index >= 0) {
      this.rigidEntries.splice(index, 1)
    }
    this.disposeAmmo(entry.body.getMotionState())
    this.disposeAmmo(entry.shape)
    this.disposeAmmo(entry.motionStateTransform)
    this.disposeAmmo(entry.body)
    this.refreshBodyStats()
  }

  step(deltaSeconds: number) {
    if (this.disposed) {
      return
    }
    const delta = Math.min(Math.max(deltaSeconds, 1 / 120), 1 / 20)
    this.world.stepSimulation(delta, 10, 1 / 60)
    this.syncRigidBodies()
    this.refreshBodyStats()
  }

  syncRigidBodies() {
    for (const entry of this.rigidEntries) {
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
    }
  }

  refreshBodyStats() {
    this.stats.value = {
      ...this.stats.value,
      bodyCount: this.rigidEntries.length,
      dynamicBodyCount: this.rigidEntries.filter((entry) => entry.body.isActive()).length,
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

    this.disposeAmmo(this.world)
    this.disposeAmmo(this.softBodySolver)
    this.disposeAmmo(this.dispatcher)
    this.disposeAmmo(this.collisionConfiguration)
  }

  protected createRigidEntry(options: {
    color: Color
    entityFactory: (position: Cartesian3, orientation: Quaternion) => Entity
    mass: number
    position: LocalPoint
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
    if (options.mass > 0) {
      body.setActivationState(4)
    }
    this.world.addRigidBody(body)

    const mutableTransform = {
      position: { ...options.position },
      rotation: { ...rotation },
    }
    const position = new CallbackProperty(
      () =>
        this.localToWorld(
          mutableTransform.position.x,
          mutableTransform.position.y,
          mutableTransform.position.z,
        ),
      false,
    )
    const orientation = new CallbackProperty(
      () => this.localQuaternionToWorld(mutableTransform.rotation),
      false,
    )
    const entity = this.addEntity(options.entityFactory(position as never, orientation as never))
    const entry = {
      body,
      entity,
      motionStateTransform: transform,
      shape: options.shape,
      transform: mutableTransform,
    }

    this.rigidEntries.push(entry)
    this.disposeAmmo(constructionInfo)
    this.disposeAmmo(inertia)
    this.refreshBodyStats()
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
  viewer: Viewer
}

export abstract class BasePhysicsScene {
  readonly animationState: Ref<PhysicsAnimationState> = ref('playing')
  readonly controls: PhysicsControl[] = []
  readonly actions: DemoSceneAction[] = []
  readonly stats: Ref<PhysicsSceneStats> = ref(createInitialStats())

  protected readonly ammo: AmmoApi
  protected readonly site: { height: number; latitude: number; longitude: number }
  protected readonly viewer: Viewer
  protected runtime: PhysicsRuntime
  private lastFrameTime: number | undefined
  private readonly sceneCleanups: Array<() => void> = []
  private readonly removePreUpdateListener: () => void
  private readonly softBodies: boolean

  constructor({ ammo, site, viewer }: PhysicsSceneControllerOptions, softBodies = false) {
    this.ammo = ammo
    this.site = site
    this.viewer = viewer
    this.softBodies = softBodies
    this.runtime = new PhysicsRuntime(ammo, viewer, site, softBodies, this.stats)

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
    const deltaSeconds = this.lastFrameTime ? (now - this.lastFrameTime) / 1_000 : 1 / 60
    this.lastFrameTime = now
    this.beforeStep(deltaSeconds)
    this.runtime.step(deltaSeconds)
    this.afterStep(deltaSeconds)
    this.viewer.scene.requestRender()
  }
}

export function point(x = ZERO_POINT.x, y = ZERO_POINT.y, z = ZERO_POINT.z): LocalPoint {
  return { x, y, z }
}
