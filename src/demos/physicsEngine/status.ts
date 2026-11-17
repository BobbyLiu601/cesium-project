import type { PhysicsEngineSceneId } from '@/data/layers'

const STATUS_REFRESH_INTERVAL_MS = 450

interface PhysicsStatusCopy {
  initial: string
  ready: string
  running: (...args: never[]) => string
}

export const PHYSICS_STATUS_MESSAGES = {
  'vehicle-motion': {
    initial: '正在启动车辆物理…',
    ready: '车辆已就绪：W/S 加减速，A/D 转向',
    running: (speed: number) => `车辆运行中：${speed.toFixed(1)} km/h`,
  },
  'flag-rotation': {
    initial: '正在创建旗面软体…',
    ready: '旗面软体已就绪：按住 Q/A 左右摆动',
    running: (motion: string) => `旗面软体运行中：${motion}`,
  },
  'ball-rotation': {
    initial: '正在创建软绳与刚体球…',
    ready: '软绳与刚体球已就绪：按住 Q/A 左右摆动',
    running: (motion: string) => `软绳连接刚体球运行中：${motion}`,
  },
  'soft-body-collision': {
    initial: '正在创建碰撞场景…',
    ready: '碰撞场景已就绪：单击画布发射小球',
    running: (projectileCount: number) => `碰撞运行中：已发射 ${projectileCount} 个小球`,
  },
  'fracture-collision': {
    initial: '正在创建断裂体场景…',
    ready: '断裂体已就绪：单击画布发射撞击球',
    running: (brokenCount: number, projectileCount: number) =>
      `断裂体运行中：已击碎 ${brokenCount} 个结构，${projectileCount} 个撞击球`,
  },
} as const satisfies Record<PhysicsEngineSceneId, PhysicsStatusCopy>

export class PhysicsStatusPublisher {
  private lastPublishedAt = 0

  constructor(private readonly publish: (message: string) => void) {}

  publishReady(message: string) {
    this.lastPublishedAt = performance.now()
    this.publish(message)
  }

  publishRunning(createMessage: () => string, now = performance.now()) {
    if (now - this.lastPublishedAt <= STATUS_REFRESH_INTERVAL_MS) {
      return
    }
    this.lastPublishedAt = now
    this.publish(createMessage())
  }
}
