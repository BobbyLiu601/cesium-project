import { Color, HeadingPitchRange } from 'cesium'

import {
  BasePhysicsScene,
  point,
  quaternionFromAxisAngle,
  type LocalPoint,
  type LocalQuaternion,
  type PhysicsPrimitiveVisual,
  type PhysicsSceneControllerOptions,
} from './shared'
import type { AmmoApi, PhysicsControl } from './types'

type VehicleAction = 'acceleration' | 'braking' | 'left' | 'right'

const WHEEL_COUNT = 4
const DISABLE_DEACTIVATION = 4
const MAX_ENGINE_FORCE = 2_000
const MAX_BRAKING_FORCE = 100
const STEERING_CLAMP = 0.5
const STEERING_INCREMENT = 0.04
const ALIGN_CYLINDER_TO_AXLE = quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 2)

export class VehiclePhysicsScene extends BasePhysicsScene {
  private readonly setStatus: (message: string) => void
  private readonly vehicleActions: Record<VehicleAction, boolean> = {
    acceleration: false,
    braking: false,
    left: false,
    right: false,
  }
  private readonly wheelTransforms: Array<{
    position: LocalPoint
    rotation: LocalQuaternion
  }> = []
  private readonly wheelVisuals: PhysicsPrimitiveVisual[] = []
  private vehicle: InstanceType<AmmoApi['btRaycastVehicle']> | undefined
  private steering = 0
  private lastStatusAt = 0

  constructor(options: PhysicsSceneControllerOptions, setStatus: (message: string) => void) {
    super(options)
    this.setStatus = setStatus
    this.controls.push(
      this.createHoldControl('forward', 'W 前进', '按住 W 前进', ['KeyW'], 'acceleration'),
      this.createHoldControl('brake', 'S 倒车', '按住 S 倒车或刹车', ['KeyS'], 'braking'),
      this.createHoldControl('left', 'A 左转', '按住 A 向左转向', ['KeyA'], 'left'),
      this.createHoldControl('right', 'D 右转', '按住 D 向右转向', ['KeyD'], 'right'),
    )
  }

  protected buildScene() {
    this.wheelTransforms.length = 0
    this.wheelVisuals.length = 0
    this.vehicleActions.acceleration = false
    this.vehicleActions.braking = false
    this.vehicleActions.left = false
    this.vehicleActions.right = false
    this.steering = 0

    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#41515b').withAlpha(0.95),
      halfExtents: point(37.5, 37.5, 0.5),
      position: point(0, 0, -0.5),
    })
    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#6d7f88'),
      halfExtents: point(4, 5, 2),
      position: point(0, 4, 0),
      rotation: quaternionFromAxisAngle({ x: 1, y: 0, z: 0 }, Math.PI / 28),
    })

    this.createMosaicWall()
    this.createVehicle()

    this.viewer.camera.lookAt(
      this.runtime.localToWorld(0, 0, 2),
      new HeadingPitchRange(0, -0.32, 52),
    )
    this.setStatus('Ammo.js 车辆已就绪：W/S 加减速，A/D 转向')
  }

  protected beforeStep() {
    if (!this.vehicle) {
      return
    }

    const speed = this.vehicle.getCurrentSpeedKmHour()
    let engineForce = 0
    let brakingForce = 0

    if (this.vehicleActions.acceleration) {
      if (speed < -1) {
        brakingForce = MAX_BRAKING_FORCE
      } else {
        engineForce = MAX_ENGINE_FORCE
      }
    }
    if (this.vehicleActions.braking) {
      if (speed > 1) {
        brakingForce = MAX_BRAKING_FORCE
      } else {
        engineForce = -MAX_ENGINE_FORCE / 2
      }
    }

    if (this.vehicleActions.left) {
      this.steering = Math.min(this.steering + STEERING_INCREMENT, STEERING_CLAMP)
    } else if (this.vehicleActions.right) {
      this.steering = Math.max(this.steering - STEERING_INCREMENT, -STEERING_CLAMP)
    } else if (Math.abs(this.steering) <= STEERING_INCREMENT) {
      this.steering = 0
    } else {
      this.steering -= Math.sign(this.steering) * STEERING_INCREMENT
    }

    this.vehicle.applyEngineForce(engineForce, 2)
    this.vehicle.applyEngineForce(engineForce, 3)
    this.vehicle.setBrake(brakingForce / 2, 0)
    this.vehicle.setBrake(brakingForce / 2, 1)
    this.vehicle.setBrake(brakingForce, 2)
    this.vehicle.setBrake(brakingForce, 3)
    this.vehicle.setSteeringValue(this.steering, 0)
    this.vehicle.setSteeringValue(this.steering, 1)
  }

  protected afterStep() {
    if (!this.vehicle) {
      return
    }

    for (let index = 0; index < WHEEL_COUNT; index += 1) {
      this.vehicle.updateWheelTransform(index, true)
      const transform = this.vehicle.getWheelTransformWS(index)
      const origin = transform.getOrigin()
      const rotation = transform.getRotation()
      const target = this.wheelTransforms[index]
      if (!target) {
        continue
      }
      target.position.x = origin.x()
      target.position.y = origin.y()
      target.position.z = origin.z()
      target.rotation.w = rotation.w()
      target.rotation.x = rotation.x()
      target.rotation.y = rotation.y()
      target.rotation.z = rotation.z()
      const visual = this.wheelVisuals[index]
      if (visual) {
        this.runtime.refreshPrimitiveVisual(visual)
      }
    }

    const now = performance.now()
    if (now - this.lastStatusAt > 450) {
      this.lastStatusAt = now
      const speed = Math.abs(this.vehicle.getCurrentSpeedKmHour())
      this.runtime.stats.value = {
        ...this.runtime.stats.value,
        vehicleSpeed: speed,
      }
      this.setStatus(`Ammo.js 车辆运行中：${speed.toFixed(1)} km/h`)
    }
  }

  private createHoldControl(
    id: string,
    label: string,
    ariaLabel: string,
    keys: string[],
    action: VehicleAction,
  ): PhysicsControl {
    return {
      id,
      label,
      ariaLabel,
      keys,
      kind: 'hold',
      press: () => {
        this.vehicleActions[action] = true
      },
      release: () => {
        this.vehicleActions[action] = false
      },
    }
  }

  private createMosaicWall() {
    const size = 0.75
    const columns = 8
    const rows = 6
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        this.runtime.addBox({
          color:
            (row + column) % 2 === 0
              ? Color.fromCssColorString('#f1b84b').withAlpha(0.95)
              : Color.fromCssColorString('#e36f4d').withAlpha(0.95),
          halfExtents: point(size / 2, size / 2, size / 2),
          mass: 10,
          position: point(size * column - (size * (columns - 1)) / 2, 18, size * row + size / 2),
        })
      }
    }
  }

  private createVehicle() {
    const chassisWidth = 1.8
    const chassisLength = 4
    const chassisHeight = 0.6
    const chassis = this.runtime.addBox({
      color: Color.fromCssColorString('#19c6c9'),
      halfExtents: point(chassisWidth / 2, chassisLength / 2, chassisHeight / 2),
      mass: 800,
      position: point(0, -12, 2),
    })

    const tuning = new this.ammo.btVehicleTuning()
    tuning.set_m_suspensionStiffness(20)
    tuning.set_m_suspensionCompression(4.4)
    tuning.set_m_suspensionDamping(2.3)
    tuning.set_m_frictionSlip(1_000)
    tuning.set_m_maxSuspensionTravelCm(50)
    tuning.set_m_maxSuspensionForce(6_000)

    const raycaster = new this.ammo.btDefaultVehicleRaycaster(this.runtime.world)
    this.vehicle = new this.ammo.btRaycastVehicle(tuning, chassis.body, raycaster)
    this.vehicle.setCoordinateSystem(0, 2, 1)
    this.runtime.addAction(this.vehicle)
    chassis.body.setActivationState(DISABLE_DEACTIVATION)

    const wheelDirection = new this.ammo.btVector3(0, 0, -1)
    const wheelAxle = new this.ammo.btVector3(-1, 0, 0)
    const wheels = [
      { front: true, position: point(1, 1.7, 0.3), radius: 0.35, width: 0.2 },
      { front: true, position: point(-1, 1.7, 0.3), radius: 0.35, width: 0.2 },
      { front: false, position: point(-1, -1, 0.3), radius: 0.4, width: 0.3 },
      { front: false, position: point(1, -1, 0.3), radius: 0.4, width: 0.3 },
    ]

    wheels.forEach((wheel, index) => {
      const wheelInfo = this.vehicle?.addWheel(
        new this.ammo.btVector3(wheel.position.x, wheel.position.y, wheel.position.z),
        wheelDirection,
        wheelAxle,
        0.6,
        wheel.radius,
        tuning,
        wheel.front,
      )
      wheelInfo?.set_m_suspensionStiffness(20)
      wheelInfo?.set_m_wheelsDampingRelaxation(2.3)
      wheelInfo?.set_m_wheelsDampingCompression(4.4)
      wheelInfo?.set_m_frictionSlip(1_000)
      wheelInfo?.set_m_rollInfluence(0.2)

      const transform = {
        position: { ...wheel.position },
        rotation: { w: 1, x: 0, y: 0, z: 0 },
      }
      this.wheelTransforms[index] = transform

      this.wheelVisuals[index] = this.runtime.addTrackedCylinder({
        color: Color.fromCssColorString('#16232b'),
        length: wheel.width,
        position: transform.position,
        radius: wheel.radius,
        rotation: transform.rotation,
        rotationOffset: ALIGN_CYLINDER_TO_AXLE,
      })
    })

    this.addSceneCleanup(() => {
      try {
        this.ammo.destroy(wheelAxle)
        this.ammo.destroy(wheelDirection)
        this.ammo.destroy(raycaster)
        this.ammo.destroy(tuning)
      } catch {
        // Ammo owns nested vehicle internals; only dispose the standalone helpers here.
      }
    })
  }
}
