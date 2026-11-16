import { Color, HeadingPitchRange, ScreenSpaceEventHandler, ScreenSpaceEventType } from 'cesium'

import {
  BasePhysicsScene,
  point,
  type LocalPoint,
  type PhysicsSceneControllerOptions,
  type PhysicsRigidEntry,
} from './shared'

interface BreakableBody {
  broken: boolean
  entry: PhysicsRigidEntry
  halfExtents: LocalPoint
  mass: number
}

const MAX_PROJECTILES = 10
const FRACTURE_IMPULSE = 180
const DISABLE_DEACTIVATION = 4

export class FracturePhysicsScene extends BasePhysicsScene {
  private readonly breakables: BreakableBody[] = []
  private readonly breakableByPointer = new Map<number, BreakableBody>()
  private readonly projectiles: PhysicsRigidEntry[] = []
  private readonly setStatus: (message: string) => void
  private brokenCount = 0
  private lastStatusAt = 0

  constructor(options: PhysicsSceneControllerOptions, setStatus: (message: string) => void) {
    super(options)
    this.setStatus = setStatus
    this.controls.push({
      id: 'fire',
      label: '发射撞击球',
      ariaLabel: '向可断裂结构发射物理小球',
      kind: 'tap',
      press: () => this.fireProjectile(),
    })
  }

  protected buildScene() {
    this.breakables.length = 0
    this.breakableByPointer.clear()
    this.projectiles.length = 0
    this.brokenCount = 0

    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#37464f').withAlpha(0.95),
      halfExtents: point(20, 20, 0.5),
      position: point(0, 0, -0.5),
    })

    this.createBreakable({
      color: Color.fromCssColorString('#f1b84b'),
      halfExtents: point(2, 2, 5),
      mass: 1_000,
      position: point(-8, 0, 5),
    })
    this.createBreakable({
      color: Color.fromCssColorString('#f1b84b'),
      halfExtents: point(2, 2, 5),
      mass: 1_000,
      position: point(8, 0, 5),
    })
    this.createBreakable({
      color: Color.fromCssColorString('#e36f4d'),
      halfExtents: point(7, 1.5, 0.3),
      mass: 100,
      position: point(0, 0, 10.2),
    })

    for (let index = 0; index < 8; index += 1) {
      this.createBreakable({
        color: Color.fromCssColorString(index % 2 === 0 ? '#d7e2e6' : '#8fa6ae'),
        halfExtents: point(0.55, 2, 0.16),
        mass: 120,
        position: point(0, (index - 3.5) * 1.8, 2.4),
      })
    }

    this.installClickHandler()
    this.viewer.camera.lookAt(
      this.runtime.localToWorld(0, 0, 5),
      new HeadingPitchRange(0.1, -0.28, 35),
    )
    this.setStatus('Ammo.js 断裂体已就绪：单击画布发射撞击球')
  }

  protected afterStep() {
    const toBreak = new Set<BreakableBody>()
    const dispatcher = this.runtime.world.getDispatcher()
    for (let index = 0; index < dispatcher.getNumManifolds(); index += 1) {
      const manifold = dispatcher.getManifoldByIndexInternal(index)
      const bodyA = manifold.getBody0()
      const bodyB = manifold.getBody1()
      const breakableA = this.breakableByPointer.get(this.ammo.getPointer(bodyA))
      const breakableB = this.breakableByPointer.get(this.ammo.getPointer(bodyB))
      if (!breakableA && !breakableB) {
        continue
      }

      let maxImpulse = 0
      for (let contactIndex = 0; contactIndex < manifold.getNumContacts(); contactIndex += 1) {
        const contact = manifold.getContactPoint(contactIndex)
        if (contact.getDistance() < 0) {
          maxImpulse = Math.max(maxImpulse, contact.getAppliedImpulse())
        }
      }
      if (maxImpulse < FRACTURE_IMPULSE) {
        continue
      }
      if (breakableA && !breakableA.broken) {
        toBreak.add(breakableA)
      }
      if (breakableB && !breakableB.broken) {
        toBreak.add(breakableB)
      }
    }

    toBreak.forEach((breakable) => this.breakBody(breakable))
    const now = performance.now()
    if (now - this.lastStatusAt > 450) {
      this.lastStatusAt = now
      this.setStatus(
        `Ammo.js 断裂体运行中：已击碎 ${this.brokenCount} 个结构，${this.projectiles.length} 个撞击球`,
      )
    }
  }

  private installClickHandler() {
    const handler = new ScreenSpaceEventHandler(this.viewer.scene.canvas)
    handler.setInputAction(() => {
      this.fireProjectile()
    }, ScreenSpaceEventType.LEFT_DOWN)
    this.addSceneCleanup(() => handler.destroy())
  }

  private fireProjectile() {
    if (this.animationState.value === 'paused') {
      return
    }
    const start = point(11, -8, 6)
    const target = point(0, 0, 10.2)
    const direction = {
      x: target.x - start.x,
      y: target.y - start.y,
      z: target.z - start.z,
    }
    const magnitude = Math.hypot(direction.x, direction.y, direction.z) || 1
    const speed = 44
    const projectile = this.runtime.addSphere({
      color: Color.fromCssColorString('#ff6b4a'),
      mass: 35,
      position: start,
      radius: 0.4,
    })
    projectile.body.setFriction(0.5)
    projectile.body.setActivationState(DISABLE_DEACTIVATION)
    projectile.body.setCcdMotionThreshold(0.2)
    projectile.body.setCcdSweptSphereRadius(0.35)
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

  private createBreakable(options: {
    color: Color
    halfExtents: LocalPoint
    mass: number
    position: LocalPoint
  }) {
    const entry = this.runtime.addBox({
      color: options.color,
      halfExtents: options.halfExtents,
      mass: options.mass,
      position: options.position,
    })
    entry.body.setActivationState(DISABLE_DEACTIVATION)
    const breakable = {
      broken: false,
      entry,
      halfExtents: options.halfExtents,
      mass: options.mass,
    }
    this.breakables.push(breakable)
    this.breakableByPointer.set(this.ammo.getPointer(entry.body), breakable)
  }

  private breakBody(breakable: BreakableBody) {
    if (breakable.broken) {
      return
    }
    breakable.broken = true
    this.brokenCount += 1
    this.breakableByPointer.delete(this.ammo.getPointer(breakable.entry.body))

    const position = { ...breakable.entry.transform.position }
    const rotation = { ...breakable.entry.transform.rotation }
    const velocity = breakable.entry.body.getLinearVelocity()
    const fragmentHalf = {
      x: Math.max(breakable.halfExtents.x / 2, 0.2),
      y: Math.max(breakable.halfExtents.y / 2, 0.2),
      z: Math.max(breakable.halfExtents.z / 2, 0.2),
    }
    this.runtime.removeRigidEntry(breakable.entry)

    let fragmentIndex = 0
    for (const xDirection of [-1, 1]) {
      for (const yDirection of [-1, 1]) {
        for (const zDirection of [-1, 1]) {
          const fragment = this.runtime.addBox({
            color: Color.fromCssColorString(fragmentIndex % 2 === 0 ? '#f3c15b' : '#db7754'),
            halfExtents: fragmentHalf,
            mass: Math.max(breakable.mass / 8, 1),
            position: point(
              position.x + xDirection * breakable.halfExtents.x * 0.45,
              position.y + yDirection * breakable.halfExtents.y * 0.45,
              position.z + zDirection * breakable.halfExtents.z * 0.45,
            ),
            rotation,
          })
          fragment.body.setActivationState(DISABLE_DEACTIVATION)
          fragment.body.setLinearVelocity(
            new this.ammo.btVector3(
              velocity.x() + xDirection * 3.5,
              velocity.y() + yDirection * 3.5,
              velocity.z() + zDirection * 2.2 + 2,
            ),
          )
          fragment.body.setAngularVelocity(
            new this.ammo.btVector3(1.1 * xDirection, 1.4 * yDirection, 0.9 * zDirection),
          )
          fragmentIndex += 1
        }
      }
    }

    this.runtime.stats.value = {
      ...this.runtime.stats.value,
      brokenBodyCount: this.brokenCount,
    }
    this.viewer.scene.requestRender()
  }
}
