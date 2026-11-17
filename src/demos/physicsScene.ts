import type { Viewer } from 'cesium'

import type { PhysicsEngineSceneId } from '@/data/layers'
import { BallPhysicsScene } from '@/demos/physicsEngine/ballScene'
import { FlagPhysicsScene } from '@/demos/physicsEngine/flagScene'
import { FracturePhysicsScene } from '@/demos/physicsEngine/fractureScene'
import { SoftBodyPhysicsScene } from '@/demos/physicsEngine/softBodyScene'
import { PHYSICS_STATUS_MESSAGES } from '@/demos/physicsEngine/status'
import { VehiclePhysicsScene } from '@/demos/physicsEngine/vehicleScene'
import type {
  AmmoApi,
  CreatePhysicsEngineSceneOptions,
  PhysicsEngineScene,
  PhysicsSceneDefinition,
} from '@/demos/physicsEngine/types'

export type {
  CreatePhysicsEngineSceneOptions,
  PhysicsAnimationState,
  PhysicsControl,
  PhysicsEngineScene,
  PhysicsSceneStats,
} from '@/demos/physicsEngine/types'

export const PHYSICS_SCENE_DEFINITIONS: Record<
  PhysicsEngineSceneId,
  PhysicsSceneDefinition & {
    create: (
      ammo: AmmoApi,
      viewer: Viewer,
      site: PhysicsSceneDefinition['site'],
      setStatus: (message: string) => void,
    ) => PhysicsEngineScene
  }
> = {
  'vehicle-motion': {
    create: (ammo, viewer, site, setStatus) => {
      const scene = new VehiclePhysicsScene({ ammo, setStatus, site, viewer })
      scene.initialize()
      return scene
    },
    hint: 'W/S 加减速，A/D 转向',
    id: 'vehicle-motion',
    initialStatus: PHYSICS_STATUS_MESSAGES['vehicle-motion'].initial,
    site: { height: 100, latitude: 30.46331, longitude: 114.40184 },
  },
  'flag-rotation': {
    create: (ammo, viewer, site, setStatus) => {
      const scene = new FlagPhysicsScene({ ammo, setStatus, site, viewer })
      scene.initialize()
      return scene
    },
    hint: '按住 Q/A 左右摆动旗面',
    id: 'flag-rotation',
    initialStatus: PHYSICS_STATUS_MESSAGES['flag-rotation'].initial,
    site: { height: 50, latitude: 30.46331, longitude: 114.40184 },
  },
  'ball-rotation': {
    create: (ammo, viewer, site, setStatus) => {
      const scene = new BallPhysicsScene({ ammo, setStatus, site, viewer })
      scene.initialize()
      return scene
    },
    hint: '按住 Q/A 摆动软绳与刚体球',
    id: 'ball-rotation',
    initialStatus: PHYSICS_STATUS_MESSAGES['ball-rotation'].initial,
    site: { height: 50, latitude: 30.46331, longitude: 114.40184 },
  },
  'soft-body-collision': {
    create: (ammo, viewer, site, setStatus) => {
      const scene = new SoftBodyPhysicsScene({ ammo, setStatus, site, viewer })
      scene.initialize()
      return scene
    },
    hint: '单击画布发射小球进行碰撞',
    id: 'soft-body-collision',
    initialStatus: PHYSICS_STATUS_MESSAGES['soft-body-collision'].initial,
    site: { height: 50, latitude: 30.46331, longitude: 114.40184 },
  },
  'fracture-collision': {
    create: (ammo, viewer, site, setStatus) => {
      const scene = new FracturePhysicsScene({ ammo, setStatus, site, viewer })
      scene.initialize()
      return scene
    },
    hint: '单击画布发射撞击球击碎结构',
    id: 'fracture-collision',
    initialStatus: PHYSICS_STATUS_MESSAGES['fracture-collision'].initial,
    site: { height: 100, latitude: 31.834866, longitude: 117.220206 },
  },
}

async function loadAmmo(): Promise<AmmoApi> {
  const { default: AmmoFactory } = await import('ammojs-typed')
  return AmmoFactory.call({})
}

function throwIfAborted(signal: AbortSignal | undefined) {
  if (signal?.aborted) {
    throw new DOMException('物理引擎场景加载已取消', 'AbortError')
  }
}

export async function createPhysicsEngineScene(
  viewer: Viewer,
  sceneId: PhysicsEngineSceneId,
  setStatus: (message: string) => void,
  options: CreatePhysicsEngineSceneOptions = {},
): Promise<PhysicsEngineScene> {
  const definition = PHYSICS_SCENE_DEFINITIONS[sceneId]
  setStatus(definition.initialStatus)
  throwIfAborted(options.signal)

  const ammo = await (options.loadAmmo ?? loadAmmo)()
  throwIfAborted(options.signal)

  const scene = definition.create(ammo, viewer, definition.site, setStatus)
  if (options.signal?.aborted) {
    scene.dispose()
    throw new DOMException('物理引擎场景加载已取消', 'AbortError')
  }
  return scene
}
