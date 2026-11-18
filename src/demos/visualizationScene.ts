import type { Viewer } from 'cesium'

import type { VisualizationSceneId } from '@/data/layers'
import { createOceanCurrentScene, createWindFieldScene } from '@/demos/visualization/flowFieldScene'
import {
  createHeatmap3dScene,
  createHoneycombHeatmapScene,
} from '@/demos/visualization/heatmapScenes'
import { createIsosurfaceScene } from '@/demos/visualization/isosurfaceScene'
import { createOverlayAnalysisScene } from '@/demos/visualization/overlayAnalysisScene'
import { throwIfAborted } from '@/demos/visualization/shared'
import { createThiessenPolygonScene } from '@/demos/visualization/thiessenPolygonScene'
import type {
  CreateVisualizationSceneOptions,
  StatusReporter,
  VisualizationScene,
} from '@/demos/visualization/types'

export type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'
export { isosurfaceBreaks, isosurfaceColors } from '@/data/gisClient'

export async function createVisualizationScene(
  viewer: Viewer,
  sceneId: VisualizationSceneId,
  setStatus: StatusReporter,
  options: CreateVisualizationSceneOptions = {},
): Promise<VisualizationScene> {
  throwIfAborted(options.signal)

  switch (sceneId) {
    case 'overlay-analysis':
      return createOverlayAnalysisScene(viewer, setStatus, options.signal)
    case 'thiessen-polygon':
      return createThiessenPolygonScene(viewer, setStatus, options.signal)
    case 'isosurface':
      return createIsosurfaceScene(viewer, setStatus, options.signal)
    case 'ocean-current':
      return createOceanCurrentScene(viewer, setStatus, options.signal)
    case '3d-heatmap':
      return createHeatmap3dScene(viewer, setStatus, options.signal)
    case 'wind-field':
      return createWindFieldScene(viewer, setStatus, options.signal)
    case 'honeycomb-heatmap':
      return createHoneycombHeatmapScene(viewer, setStatus, options.signal)
  }
}
