import {
  Cartesian3,
  Color,
  HeadingPitchRange,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
} from 'cesium'

import {
  BasePhysicsScene,
  point,
  quaternionFromAxisAngle,
  type LocalPoint,
  type PhysicsSceneControllerOptions,
  type PhysicsRigidEntry,
} from './shared'
import type { AmmoApi } from './types'

interface SoftVolumeState {
  body: InstanceType<AmmoApi['btSoftBody']>
  columnCount: number
  points: LocalPoint[]
  rowCount: number
}

const MAX_PROJECTILES = 8
const DISABLE_DEACTIVATION = 4

function ensureTriMeshHelperSupport(ammo: AmmoApi) {
  const runtime = ammo as AmmoApi & { _free?: (pointer: number) => void }
  if (typeof runtime._free === 'function') {
    return
  }

  // ammojs-typed's wasm build omits _free even though its generated tri-mesh
  // binding calls it. The buffers are short-lived JS-to-wasm marshaling data.
  runtime._free = () => undefined
}

export class SoftBodyPhysicsScene extends BasePhysicsScene {
  private readonly setStatus: (message: string) => void
  private readonly projectiles: PhysicsRigidEntry[] = []
  private readonly volumes: SoftVolumeState[] = []
  private lastStatusAt = 0
  private lineSerial = 0

  constructor(options: PhysicsSceneControllerOptions, setStatus: (message: string) => void) {
    super(options, true)
    this.setStatus = setStatus
    this.controls.push({
      id: 'fire',
      label: '发射小球',
      ariaLabel: '向软体发射物理小球',
      kind: 'tap',
      press: () => this.fireProjectile(),
    })
  }

  protected buildScene() {
    this.projectiles.length = 0
    this.volumes.length = 0
    this.lineSerial = 0

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

    this.createSoftVolume({
      center: point(2, 0, 5),
      color: Color.fromCssColorString('#54d9d2'),
      radii: point(1.45, 1.45, 1.45),
    })
    this.createSoftVolume({
      center: point(-1.2, 2.2, 5.4),
      color: Color.fromCssColorString('#f1b84b'),
      radii: point(1.1, 1.1, 2.4),
    })
    this.installClickHandler()

    this.viewer.camera.lookAt(
      this.runtime.localToWorld(1, 0, 3),
      new HeadingPitchRange(0, -0.22, 18),
    )
    this.setStatus('Ammo.js 软体已就绪：单击画布或“发射小球”进行撞击')
  }

  protected afterStep() {
    for (const volume of this.volumes) {
      const nodes = volume.body.get_m_nodes()
      const count = (volume.rowCount + 1) * volume.columnCount
      volume.points = Array.from({ length: count }, (_, index) => {
        const position = nodes.at(index)?.get_m_x()
        return {
          x: position?.x() ?? 0,
          y: position?.y() ?? 0,
          z: position?.z() ?? 0,
        }
      })
    }

    const now = performance.now()
    if (now - this.lastStatusAt > 450) {
      this.lastStatusAt = now
      this.setStatus(`Ammo.js 软体运行中：已发射 ${this.projectiles.length} 个小球`)
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

    const start = point(8, -4, 4)
    const target = point(1.5, 0, 5)
    const direction = {
      x: target.x - start.x,
      y: target.y - start.y,
      z: target.z - start.z,
    }
    const magnitude = Math.hypot(direction.x, direction.y, direction.z) || 1
    const speed = 30

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

  private createSoftVolume(options: { center: LocalPoint; color: Color; radii: LocalPoint }) {
    const worldInfo = this.runtime.worldInfo
    if (!worldInfo) {
      throw new Error('软体物理世界未初始化')
    }

    ensureTriMeshHelperSupport(this.ammo)

    const rowCount = 7
    const columnCount = 12
    const vertices: number[] = []
    const indices: number[] = []

    for (let row = 0; row <= rowCount; row += 1) {
      const latitude = -Math.PI / 2 + (Math.PI * row) / rowCount
      const ringRadius = Math.cos(latitude)
      const z = Math.sin(latitude)
      for (let column = 0; column < columnCount; column += 1) {
        const longitude = (Math.PI * 2 * column) / columnCount
        vertices.push(
          options.center.x + options.radii.x * ringRadius * Math.cos(longitude),
          options.center.y + options.radii.y * ringRadius * Math.sin(longitude),
          options.center.z + options.radii.z * z,
        )
      }
    }

    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        const nextColumn = (column + 1) % columnCount
        const a = row * columnCount + column
        const b = row * columnCount + nextColumn
        const c = (row + 1) * columnCount + column
        const d = (row + 1) * columnCount + nextColumn
        indices.push(a, c, b, b, c, d)
      }
    }

    const helpers = new this.ammo.btSoftBodyHelpers()
    const body = helpers.CreateFromTriMesh(worldInfo, vertices, indices, indices.length / 3, true)
    this.ammo.destroy(helpers)
    const config = body.get_m_cfg()
    config.set_viterations(20)
    config.set_piterations(20)
    config.set_collisions(0x11)
    config.set_kDF(0.1)
    config.set_kDP(0.01)
    config.set_kPR(120)
    body.get_m_materials().at(0)?.set_m_kLST(0.9)
    body.get_m_materials().at(0)?.set_m_kAST(0.9)
    body.setTotalMass(15, false)
    body.getCollisionShape().setMargin(0.05)
    body.setActivationState(DISABLE_DEACTIVATION)
    this.runtime.addSoftBody(body)

    const volume: SoftVolumeState = {
      body,
      columnCount,
      points: [],
      rowCount,
    }
    this.volumes.push(volume)
    const nodes = body.get_m_nodes()
    volume.points = Array.from({ length: (rowCount + 1) * columnCount }, (_, index) => {
      const position = nodes.at(index)?.get_m_x()
      return {
        x: position?.x() ?? options.center.x,
        y: position?.y() ?? options.center.y,
        z: position?.z() ?? options.center.z,
      }
    })

    for (let row = 0; row <= rowCount; row += 1) {
      const ids = Array.from(
        { length: columnCount + 1 },
        (_, column) => row * columnCount + (column % columnCount),
      )
      this.addVolumeLine(volume, ids, options.color, row === 0 ? 3 : 2)
    }
    for (let column = 0; column < columnCount; column += 1) {
      const ids = Array.from({ length: rowCount + 1 }, (_, row) => row * columnCount + column)
      this.addVolumeLine(volume, ids, options.color.withAlpha(0.72), 1.5)
    }
  }

  private addVolumeLine(volume: SoftVolumeState, indices: number[], color: Color, width: number) {
    this.runtime.addDynamicPolyline(
      () =>
        indices.map((index) => {
          const position = volume.points[index] ?? { x: 0, y: 0, z: 0 }
          return this.runtime.localToWorld(position.x, position.y, position.z, new Cartesian3())
        }),
      {
        color,
        id: `physics-soft-line-${this.lineSerial++}`,
        width,
      },
    )
  }
}
