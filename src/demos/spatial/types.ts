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
  dispose: () => void
  applySunlightRange?: (range: SunlightRange) => void
}

export type StatusReporter = (message: string) => void

export interface CreateSpatialSceneOptions {
  signal?: AbortSignal
  sunlight?: SunlightRange
}
