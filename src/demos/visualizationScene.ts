import type { Viewer } from 'cesium'

import type { VisualizationSceneId } from '@/data/layers'
import { throwIfAborted } from '@/demos/visualization/shared'
import type {
  CreateVisualizationSceneOptions,
  StatusReporter,
  VisualizationScene,
} from '@/demos/visualization/types'

export type { StatusReporter, VisualizationScene } from '@/demos/visualization/types'
export { isosurfaceBreaks, isosurfaceColors } from '@/data/gisClient'

type SceneCreator = (
  viewer: Viewer,
  setStatus: StatusReporter,
  signal?: AbortSignal,
) => VisualizationScene

async function importSceneModule<T>(load: () => Promise<T>, fileName: string): Promise<T> {
  // Worktree snapshots can replace a file after Vite has already cached an empty
  // transform. An old timestamp forces the dev server to read the file again;
  // production keeps the normal statically analyzable import.
  if (import.meta.env.DEV) {
    return import(
      /* @vite-ignore */ `${import.meta.env.BASE_URL}src/demos/visualization/${fileName}?t=0`
    ) as Promise<T>
  }

  return load()
}

async function loadOverlayAnalysisScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/overlayAnalysisScene'),
    'overlayAnalysisScene.ts',
  )
  return module.createOverlayAnalysisScene
}

async function loadThiessenPolygonScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/thiessenPolygonScene'),
    'thiessenPolygonScene.ts',
  )
  return module.createThiessenPolygonScene
}

async function loadIsosurfaceScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/isosurfaceScene'),
    'isosurfaceScene.ts',
  )
  return module.createIsosurfaceScene
}

async function loadOceanCurrentScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/flowFieldScene'),
    'flowFieldScene.ts',
  )
  return module.createOceanCurrentScene
}

async function loadWindFieldScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/flowFieldScene'),
    'flowFieldScene.ts',
  )
  return module.createWindFieldScene
}

async function loadHeatmap3dScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/heatmapScenes'),
    'heatmapScenes.ts',
  )
  return module.createHeatmap3dScene
}

async function loadHoneycombHeatmapScene(): Promise<SceneCreator> {
  const module = await importSceneModule(
    () => import('@/demos/visualization/heatmapScenes'),
    'heatmapScenes.ts',
  )
  return module.createHoneycombHeatmapScene
}

const sceneCreators: Record<VisualizationSceneId, () => Promise<SceneCreator>> = {
  'overlay-analysis': loadOverlayAnalysisScene,
  'thiessen-polygon': loadThiessenPolygonScene,
  isosurface: loadIsosurfaceScene,
  'ocean-current': loadOceanCurrentScene,
  '3d-heatmap': loadHeatmap3dScene,
  'wind-field': loadWindFieldScene,
  'honeycomb-heatmap': loadHoneycombHeatmapScene,
}

export async function createVisualizationScene(
  viewer: Viewer,
  sceneId: VisualizationSceneId,
  setStatus: StatusReporter,
  options: CreateVisualizationSceneOptions = {},
): Promise<VisualizationScene> {
  throwIfAborted(options.signal)

  const createScene = await sceneCreators[sceneId]()
  throwIfAborted(options.signal)
  return createScene(viewer, setStatus, options.signal)
}
