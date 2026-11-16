import type { Viewer } from 'cesium'

import type { SpecialShapeSceneId } from '@/data/layers'
import {
  createFrustumScene,
  createManualFrustumScene,
  createMovingFrustumScene,
} from '@/demos/specialShapes/frustumScenes'
import { createOutlineConeScene, createRadarConeScene } from '@/demos/specialShapes/coneScenes'
import { createRadarMaskScanScene, createRadarScanScene } from '@/demos/specialShapes/radarScenes'
import { applySpecialShapeSceneDefaults, throwIfAborted } from '@/demos/specialShapes/shared'
import { createCurveInterpolationScene } from '@/demos/specialShapes/splineScene'
import type {
  CreateSpecialShapeSceneOptions,
  SpecialShapeScene,
  StatusReporter,
} from '@/demos/specialShapes/types'
import {
  createElectronicFence2Scene,
  createElectronicFenceScene,
  createSolidWallScene,
} from '@/demos/specialShapes/wallScenes'

export type {
  CreateSpecialShapeSceneOptions,
  SpecialShapeAnimationState,
  SpecialShapeScene,
} from '@/demos/specialShapes/types'

interface SpecialShapeSceneDefinition {
  initialStatus: string
  create: (
    viewer: Viewer,
    setStatus: StatusReporter,
    options: CreateSpecialShapeSceneOptions,
  ) => SpecialShapeScene
}

const definitions: Record<SpecialShapeSceneId, SpecialShapeSceneDefinition> = {
  frustum: {
    create: (viewer, setStatus) => createFrustumScene(viewer, setStatus),
    initialStatus: '正在准备视锥体…',
  },
  'manual-frustum': {
    create: (viewer, setStatus, options) => createManualFrustumScene(viewer, setStatus, options),
    initialStatus: '正在准备手动视锥体…',
  },
  'moving-frustum': {
    create: (viewer, setStatus) => createMovingFrustumScene(viewer, setStatus),
    initialStatus: '正在准备移动的视锥体…',
  },
  cone: {
    create: (viewer, setStatus) => createRadarConeScene(viewer, setStatus),
    initialStatus: '正在准备圆锥体…',
  },
  'solid-wall': {
    create: (viewer, setStatus) => createSolidWallScene(viewer, setStatus),
    initialStatus: '正在准备立体墙…',
  },
  'curve-interpolation': {
    create: (viewer, setStatus) => createCurveInterpolationScene(viewer, setStatus),
    initialStatus: '正在准备曲线插值…',
  },
  'outline-cone': {
    create: (viewer, setStatus) => createOutlineConeScene(viewer, setStatus),
    initialStatus: '正在准备圆锥体轮廓…',
  },
  'radar-scan': {
    create: (viewer, setStatus) => createRadarScanScene(viewer, setStatus),
    initialStatus: '正在准备雷达扫描…',
  },
  'electronic-fence': {
    create: (viewer, setStatus) => createElectronicFenceScene(viewer, setStatus),
    initialStatus: '正在准备电子围栏…',
  },
  'electronic-fence-2': {
    create: (viewer, setStatus) => createElectronicFence2Scene(viewer, setStatus),
    initialStatus: '正在准备电子围栏2…',
  },
  'radar-mask-scan': {
    create: (viewer, setStatus) => createRadarMaskScanScene(viewer, setStatus),
    initialStatus: '正在准备雷达遮罩扫描…',
  },
}

export async function createSpecialShapeScene(
  viewer: Viewer,
  sceneId: SpecialShapeSceneId,
  setStatus: StatusReporter,
  options: CreateSpecialShapeSceneOptions = {},
): Promise<SpecialShapeScene> {
  const definition = definitions[sceneId]
  setStatus(definition.initialStatus)
  throwIfAborted(options.signal)
  applySpecialShapeSceneDefaults(viewer)

  const scene = definition.create(viewer, setStatus, options)
  if (options.signal?.aborted) {
    scene.dispose()
    throw new DOMException('特殊形状场景加载已取消', 'AbortError')
  }
  return scene
}
