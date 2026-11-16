import { Cartesian3, Color, HeadingPitchRange } from 'cesium'

import {
  BasePhysicsScene,
  point,
  type LocalPoint,
  type PhysicsSceneControllerOptions,
} from './shared'
import type { AmmoApi, PhysicsControl } from './types'

const CLOTH_WIDTH = 4
const CLOTH_HEIGHT = 3
const CLOTH_COLUMNS = 12
const CLOTH_ROWS = 9
const CLOTH_TOP = 6
const DISABLE_DEACTIVATION = 4

export class FlagPhysicsScene extends BasePhysicsScene {
  private readonly setStatus: (message: string) => void
  private armMovement = 0
  private clothPoints: LocalPoint[] = []
  private hinge: InstanceType<AmmoApi['btHingeConstraint']> | undefined
  private softBody: InstanceType<AmmoApi['btSoftBody']> | undefined
  private lastStatusAt = 0

  constructor(options: PhysicsSceneControllerOptions, setStatus: (message: string) => void) {
    super(options, true)
    this.setStatus = setStatus
    this.controls.push(
      this.createSwingControl('left', 'Q 左摆', '按住 Q 向左摆动旗子', ['KeyQ'], 1),
      this.createSwingControl('right', 'A 右摆', '按住 A 向右摆动旗子', ['KeyA'], -1),
    )
  }

  protected buildScene() {
    this.armMovement = 0
    this.hinge = undefined
    this.softBody = undefined
    this.clothPoints = []

    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#45545d').withAlpha(0.95),
      halfExtents: point(20, 20, 0.5),
      position: point(0, 0, -0.5),
    })
    this.runtime.addStaticBox({
      color: Color.fromCssColorString('#f1b84b'),
      halfExtents: point(0.25, 0.25, 3),
      position: point(0, 0, 3),
    })

    const arm = this.runtime.addBox({
      color: Color.fromCssColorString('#e36f4d'),
      halfExtents: point(3, 0.2, 0.2),
      mass: 2,
      position: point(0, 0, CLOTH_TOP),
    })

    this.createCloth(arm.body)
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

    this.viewer.camera.lookAt(
      this.runtime.localToWorld(0, 0, 3.5),
      new HeadingPitchRange(0, -0.2, 20),
    )
    this.setStatus('Ammo.js 旗面软体已就绪：按住 Q/A 左右摆动')
  }

  protected beforeStep() {
    this.hinge?.enableAngularMotor(true, this.armMovement * 0.9, 55)
  }

  protected afterStep() {
    this.updateClothPoints()
    const now = performance.now()
    if (now - this.lastStatusAt > 450) {
      this.lastStatusAt = now
      const motion = this.armMovement > 0 ? '向左' : this.armMovement < 0 ? '向右' : '自然复位'
      this.setStatus(`Ammo.js 旗面软体运行中：${motion}`)
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

  private createCloth(armBody: InstanceType<AmmoApi['btRigidBody']>) {
    const worldInfo = this.runtime.worldInfo
    if (!worldInfo) {
      throw new Error('旗面软体物理世界未初始化')
    }

    const helpers = new this.ammo.btSoftBodyHelpers()
    const halfWidth = CLOTH_WIDTH / 2
    const top = CLOTH_TOP - 0.2
    const bottom = top - CLOTH_HEIGHT
    const softBody = helpers.CreatePatch(
      worldInfo,
      new this.ammo.btVector3(-halfWidth, 0, top),
      new this.ammo.btVector3(halfWidth, 0, top),
      new this.ammo.btVector3(-halfWidth, 0, bottom),
      new this.ammo.btVector3(halfWidth, 0, bottom),
      CLOTH_COLUMNS + 1,
      CLOTH_ROWS + 1,
      0,
      true,
    )
    this.ammo.destroy(helpers)

    const config = softBody.get_m_cfg()
    config.set_viterations(10)
    config.set_piterations(10)
    softBody.setTotalMass(0.9, false)
    softBody.get_m_materials().at(0)?.set_m_kLST(0.8)
    softBody.get_m_materials().at(0)?.set_m_kAST(0.8)
    softBody.appendAnchor(0, armBody, false, 0.85)
    softBody.appendAnchor(CLOTH_COLUMNS, armBody, false, 0.85)
    softBody.setActivationState(DISABLE_DEACTIVATION)
    this.runtime.addSoftBody(softBody)
    this.softBody = softBody
    this.updateClothPoints()

    for (let row = 0; row <= CLOTH_ROWS; row += 1) {
      this.runtime.addDynamicPolyline(() => this.positionsForIndices(this.rowIndices(row)), {
        color:
          row === 0
            ? Color.fromCssColorString('#ffd166')
            : Color.fromCssColorString('#62d9d3').withAlpha(0.95),
        id: `physics-flag-row-${row}`,
        width: row === 0 ? 4 : 2,
      })
    }
    for (let column = 0; column <= CLOTH_COLUMNS; column += 1) {
      this.runtime.addDynamicPolyline(() => this.positionsForIndices(this.columnIndices(column)), {
        color: Color.fromCssColorString('#ff8a5b').withAlpha(0.75),
        id: `physics-flag-column-${column}`,
        width: column === 0 || column === CLOTH_COLUMNS ? 3 : 1,
      })
    }
  }

  private createBrickWall() {
    const brickWidth = 0.9
    const brickHeight = 0.45
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 7; column += 1) {
        this.runtime.addBox({
          color:
            (row + column) % 2 === 0
              ? Color.fromCssColorString('#d6a44b')
              : Color.fromCssColorString('#b76245'),
          halfExtents: point(brickWidth / 2, 0.3, brickHeight / 2),
          mass: 0.5,
          position: point(
            column * 1.05 - 3.15 + (row % 2 === 0 ? 0 : 0.35),
            3,
            brickHeight / 2 + row * brickHeight,
          ),
        })
      }
    }
  }

  private updateClothPoints() {
    const softBody = this.softBody
    if (!softBody) {
      return
    }
    const nodes = softBody.get_m_nodes()
    const expectedCount = (CLOTH_COLUMNS + 1) * (CLOTH_ROWS + 1)
    const points: LocalPoint[] = []
    for (let index = 0; index < expectedCount; index += 1) {
      const node = nodes.at(index)
      const position = node?.get_m_x()
      points.push({
        x: position?.x() ?? 0,
        y: position?.y() ?? 0,
        z: position?.z() ?? 0,
      })
    }
    this.clothPoints = points
  }

  private rowIndices(row: number) {
    return Array.from(
      { length: CLOTH_COLUMNS + 1 },
      (_, column) => row * (CLOTH_COLUMNS + 1) + column,
    )
  }

  private columnIndices(column: number) {
    return Array.from({ length: CLOTH_ROWS + 1 }, (_, row) => row * (CLOTH_COLUMNS + 1) + column)
  }

  private positionsForIndices(indices: number[]) {
    return indices.map((index) => {
      const position = this.clothPoints[index] ?? { x: 0, y: 0, z: 0 }
      return this.runtime.localToWorld(position.x, position.y, position.z, new Cartesian3())
    })
  }
}
