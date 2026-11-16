import { Cartesian3, Color, HeadingPitchRange } from 'cesium'

import {
  BasePhysicsScene,
  point,
  type LocalPoint,
  type PhysicsSceneControllerOptions,
} from './shared'
import type { AmmoApi, PhysicsControl } from './types'

const ROPE_SEGMENTS = 12
const ROPE_LENGTH = 4
const DISABLE_DEACTIVATION = 4

export class BallPhysicsScene extends BasePhysicsScene {
  private readonly setStatus: (message: string) => void
  private armMovement = 0
  private hinge: InstanceType<AmmoApi['btHingeConstraint']> | undefined
  private ropeNodes: LocalPoint[] = []
  private ropeLinePositions: Cartesian3[] = []
  private ropeBody: InstanceType<AmmoApi['btSoftBody']> | undefined
  private lastStatusAt = 0

  constructor(options: PhysicsSceneControllerOptions, setStatus: (message: string) => void) {
    super(options, true)
    this.setStatus = setStatus
    this.controls.push(
      this.createSwingControl('left', 'Q 左摆', '按住 Q 向左摆动球体', ['KeyQ'], 1),
      this.createSwingControl('right', 'A 右摆', '按住 A 向右摆动球体', ['KeyA'], -1),
    )
  }

  protected buildScene() {
    this.armMovement = 0
    this.hinge = undefined
    this.ropeBody = undefined
    this.ropeNodes = []
    this.ropeLinePositions = []

    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#45545d').withAlpha(0.95),
      halfExtents: point(20, 20, 0.5),
      position: point(0, 0, -0.5),
    })
    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#f1b84b'),
      halfExtents: point(0.25, 0.25, 3),
      position: point(-6, 0, 3),
    })
    const arm = this.runtime.addBox({
      color: Color.fromCssColorString('#e36f4d'),
      halfExtents: point(3.2, 0.2, 0.2),
      mass: 2,
      position: point(-3, 0, 6),
    })

    const ball = this.runtime.addSphere({
      color: Color.fromCssColorString('#121d25'),
      mass: 1.2,
      position: point(-3, 0, 2),
      radius: 0.6,
    })
    ball.body.setFriction(0.5)

    const rope = this.createRope(ball.body)
    this.createBrickWall()

    const pylonBody = this.runtime.rigidEntries[1]?.body
    if (pylonBody) {
      const pivotA = new this.ammo.btVector3(0, 0, 3)
      const pivotB = new this.ammo.btVector3(0, 0, 0)
      const axis = new this.ammo.btVector3(0, 1, 0)
      this.hinge = new this.ammo.btHingeConstraint(
        pylonBody,
        arm.body,
        pivotA,
        pivotB,
        axis,
        axis,
        true,
      )
      this.runtime.addConstraint(this.hinge)
    }

    const lastAnchor = rope.get_m_nodes().at(ROPE_SEGMENTS)
    void lastAnchor
    this.viewer.camera.lookAt(
      this.runtime.localToWorld(-1.5, 0, 3),
      new HeadingPitchRange(0, -0.2, 18),
    )
    this.setStatus('Ammo.js 软绳与刚体球已就绪：按住 Q/A 左右摆动')
  }

  protected beforeStep() {
    this.hinge?.enableAngularMotor(true, this.armMovement * 1.4, 60)
  }

  protected afterStep() {
    this.updateRopeNodes()
    const now = performance.now()
    if (now - this.lastStatusAt > 450) {
      this.lastStatusAt = now
      const motion = this.armMovement > 0 ? '向左' : this.armMovement < 0 ? '向右' : '自然垂摆'
      this.setStatus(`Ammo.js 软绳连接刚体球运行中：${motion}`)
    }
  }

  private createSwingControl(
    id: string,
    label: string,
    ariaLabel: string,
    keys: string[],
    direction: number,
  ): PhysicsControl {
    return {
      id,
      label,
      ariaLabel,
      keys,
      kind: 'hold',
      press: () => {
        this.armMovement = direction
      },
      release: () => {
        this.armMovement = 0
      },
    }
  }

  private createRope(ballBody: InstanceType<AmmoApi['btRigidBody']>) {
    const worldInfo = this.runtime.worldInfo
    if (!worldInfo) {
      throw new Error('软绳物理世界未初始化')
    }
    const helpers = new this.ammo.btSoftBodyHelpers()
    const rope = helpers.CreateRope(
      worldInfo,
      new this.ammo.btVector3(-3, 0, 2.55),
      new this.ammo.btVector3(-3, 0, 2.55 + ROPE_LENGTH),
      ROPE_SEGMENTS - 1,
      0,
    )
    this.ammo.destroy(helpers)

    const config = rope.get_m_cfg()
    config.set_viterations(10)
    config.set_piterations(10)
    rope.setTotalMass(3, false)
    rope.getCollisionShape().setMargin(0.12)
    rope.appendAnchor(0, ballBody, true, 1)
    const armBody = this.runtime.rigidEntries[2]?.body
    if (armBody) {
      rope.appendAnchor(ROPE_SEGMENTS, armBody, true, 1)
    }
    rope.setActivationState(DISABLE_DEACTIVATION)
    this.runtime.addSoftBody(rope)
    this.ropeBody = rope
    this.updateRopeNodes()

    this.runtime.addDynamicPolyline(() => this.ropeLinePositions, {
      color: Color.fromCssColorString('#f5f0df'),
      id: 'physics-ball-rope',
      width: 4,
    })
    return rope
  }

  private createBrickWall() {
    const brickLength = 1.2
    const brickDepth = 0.6
    const brickHeight = brickLength * 0.5
    for (let row = 0; row < 8; row += 1) {
      const oddRow = row % 2 === 1
      const count = oddRow ? 7 : 6
      for (let index = 0; index < count; index += 1) {
        this.runtime.addBox({
          color: Color.fromCssColorString((row + index) % 2 === 0 ? '#d6a44b' : '#b76245'),
          halfExtents: point(brickDepth / 2, brickLength / 2, brickHeight / 2),
          mass: 0.5,
          position: point(
            3,
            (index - count / 2) * brickLength + (oddRow ? brickLength / 2 : 0),
            brickHeight / 2 + row * brickHeight,
          ),
        })
      }
    }
  }

  private updateRopeNodes() {
    const rope = this.ropeBody
    if (!rope) {
      return
    }
    const nodes = rope.get_m_nodes()
    if (this.ropeNodes.length !== ROPE_SEGMENTS + 1) {
      this.ropeNodes = Array.from({ length: ROPE_SEGMENTS + 1 }, () => ({
        x: -3,
        y: 0,
        z: 0,
      }))
      this.ropeLinePositions = Array.from({ length: ROPE_SEGMENTS + 1 }, () => new Cartesian3())
    }
    for (let index = 0; index <= ROPE_SEGMENTS; index += 1) {
      const position = nodes.at(index)?.get_m_x()
      const node = this.ropeNodes[index]!
      node.x = position?.x() ?? -3
      node.y = position?.y() ?? 0
      node.z = position?.z() ?? 0
      const target = this.ropeLinePositions[index]!
      target.x = node.x
      target.y = node.y
      target.z = node.z
    }
  }
}
