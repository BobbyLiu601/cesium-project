import {
  Cartesian2,
  Cartesian3,
  Color,
  HeadingPitchRange,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium'

import { BasePhysicsScene, point, quaternionFromAxisAngle, type PhysicsRigidEntry } from './shared'
import { PHYSICS_STATUS_MESSAGES } from './status'

const MAX_PROJECTILES = 8
const DISABLE_DEACTIVATION = 4

export class SoftBodyPhysicsScene extends BasePhysicsScene {
  private readonly projectiles: PhysicsRigidEntry[] = []

  protected buildScene() {
    this.projectiles.length = 0

    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#37464f').withAlpha(0.95),
      halfExtents: point(18, 18, 0.5),
      position: point(0, 0, -0.5),
    })
    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#1c252b').withAlpha(0.98),
      halfExtents: point(5, 2, 0.5),
      position: point(2, 0, 1),
      rotation: quaternionFromAxisAngle({ x: 0, y: 1, z: 0 }, Math.PI / 9),
    })
    this.installClickHandler()

    this.viewer.camera.lookAt(
      this.runtime.localToWorld(1, 0, 3),
      new HeadingPitchRange(0, -0.22, 18),
    )
    this.status.publishReady(PHYSICS_STATUS_MESSAGES['soft-body-collision'].ready)
  }

  protected afterStep() {
    this.status.publishRunning(() =>
      PHYSICS_STATUS_MESSAGES['soft-body-collision'].running(this.projectiles.length),
    )
  }

  private installClickHandler() {
    const handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
    handler.setInputAction((movement: { position: Cartesian2 }) => {
      this.fireProjectile(movement.position)
    }, ScreenSpaceEventType.LEFT_DOWN)
    this.addSceneCleanup(() => handler.destroy())
  }

  private fireProjectile(screenPosition?: Cartesian2) {
    if (this.animationState.value === 'paused') {
      return
    }

    const ray =
      screenPosition && typeof this.viewer.camera.getPickRay === 'function'
        ? this.viewer.camera.getPickRay(screenPosition)
        : undefined
    const origin = ray?.origin ?? this.viewer.camera.positionWC
    const worldDirection = ray?.direction ?? this.viewer.camera.directionWC
    if (!origin || !worldDirection) {
      return
    }

    const start = this.runtime.worldToLocal(origin)
    const ahead = this.runtime.worldToLocal(
      Cartesian3.add(origin, worldDirection, new Cartesian3()),
    )
    const direction = {
      x: ahead.x - start.x,
      y: ahead.y - start.y,
      z: ahead.z - start.z,
    }
    const magnitude = Math.hypot(direction.x, direction.y, direction.z) || 1
    const speed = 30

    start.x += (direction.x / magnitude) * 0.8
    start.y += (direction.y / magnitude) * 0.8
    start.z += (direction.z / magnitude) * 0.8

    const projectile = this.runtime.addSphere({
      color: Color.fromCssColorString('#ff6b4a'),
      mass: 3,
      position: start,
      radius: 0.34,
    })
    projectile.body.setFriction(0.5)
    projectile.body.setActivationState(DISABLE_DEACTIVATION)
    projectile.body.setLinearVelocity(
      new this.ammo.btVector3(
        (direction.x / magnitude) * speed,
        (direction.y / magnitude) * speed,
        (direction.z / magnitude) * speed,
      ),
    )
    this.projectiles.push(projectile)
    if (this.projectiles.length > MAX_PROJECTILES) {
      const oldest = this.projectiles.shift()
      if (oldest) {
        this.runtime.removeRigidEntry(oldest)
      }
    }
    this.runtime.stats.value = {
      ...this.runtime.stats.value,
      projectileCount: this.projectiles.length,
    }
  }
}
