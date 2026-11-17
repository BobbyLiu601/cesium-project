export interface VisualizationScene {
  actions: []
  dispose: () => void
}

export type StatusReporter = (message: string) => void

export interface CreateVisualizationSceneOptions {
  signal?: AbortSignal
}
