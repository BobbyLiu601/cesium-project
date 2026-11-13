import type { Viewer } from 'cesium'

import type { SpatialSceneId } from '@/data/layers'
import { createAspectScene } from '@/demos/spatial/aspectScene'
import { createInundationScene } from '@/demos/spatial/inundationScene'
import { setSceneDefaults, throwIfAborted } from '@/demos/spatial/shared'
import { createSunlightScene } from '@/demos/spatial/sunlightScene'
import type { CreateSpatialSceneOptions, SpatialScene, StatusReporter } from '@/demos/spatial/types'
import { createWaterSurfaceScene } from '@/demos/spatial/waterSurfaceScene'

const DEFAULT_SUNLIGHT_RANGE = {
  date: '2020-10-20',
  startTime: '08:00',
  endTime: '18:00',
} as const

export type {
  CreateSpatialSceneOptions,
  SpatialAction,
  SpatialScene,
  SunlightRange,
} from '@/demos/spatial/types'
export { aspectLegend, aspectLegendGradient } from '@/demos/spatial/aspectScene'

export async function createSpatialScene(
  viewer: Viewer,
  sceneId: SpatialSceneId,
  setStatus: StatusReporter,
  options: CreateSpatialSceneOptions = {},
): Promise<SpatialScene> {
  throwIfAborted(options.signal)
  setSceneDefaults(viewer)

  switch (sceneId) {
    case 'inundation-analysis-simple':
      return createInundationScene(viewer, setStatus, options.signal)
    case 'sunlight-analysis':
      return createSunlightScene(
        viewer,
        setStatus,
        options.sunlight ?? DEFAULT_SUNLIGHT_RANGE,
        options.signal,
      )
    case 'water-surface':
      return createWaterSurfaceScene(viewer, setStatus)
    case 'aspect-analysis':
      return createAspectScene(viewer, setStatus, options.signal)
  }
}
