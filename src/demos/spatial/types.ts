import type { Ref } from 'vue'

import type { VideoFusionPlayback } from '@/demos/spatial/videoFusionPlayback'

export interface SpatialAction {
  id: string
  label: string
  run: () => void | Promise<void>
}

export interface SunlightRange {
  date: string
  startTime: string
  endTime: string
}

export interface SpatialScene {
  actions: SpatialAction[]
  attribution?: string | Readonly<Ref<string | undefined>>
  dispose: () => void
  applySunlightRange?: (range: SunlightRange) => void
}

export type StatusReporter = (message: string) => void

export interface CreateSpatialSceneOptions {
  host?: HTMLElement
  signal?: AbortSignal
  sunlight?: SunlightRange
  videoPlayback?: VideoFusionPlayback
}
