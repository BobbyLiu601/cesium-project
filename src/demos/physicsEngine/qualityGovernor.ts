export interface PhysicsQualitySettings {
  effects: 'full' | 'reduced'
  maximumScreenSpaceError: number
  resolutionScale: number
}

export interface PhysicsQualityMetrics {
  averageFps: number
  p95FrameMs: number
}

const WARMUP_MS = 2_000
const COOLDOWN_MS = 1_000
const SAMPLE_COUNT = 24
const MIN_AVERAGE_FPS = 32
const MAX_P95_FRAME_MS = 48

const QUALITY_STEPS: PhysicsQualitySettings[] = [
  {
    effects: 'full',
    maximumScreenSpaceError: 2,
    resolutionScale: 1,
  },
  {
    effects: 'reduced',
    maximumScreenSpaceError: 2,
    resolutionScale: 1,
  },
  {
    effects: 'reduced',
    maximumScreenSpaceError: 2,
    resolutionScale: 0.85,
  },
  {
    effects: 'reduced',
    maximumScreenSpaceError: 2,
    resolutionScale: 0.72,
  },
  {
    effects: 'reduced',
    maximumScreenSpaceError: 4,
    resolutionScale: 0.62,
  },
]

function percentile(sortedValues: number[], ratio: number) {
  const index = Math.min(sortedValues.length - 1, Math.floor(sortedValues.length * ratio))
  return sortedValues[index] ?? 0
}

export class PhysicsQualityGovernor {
  private readonly onQualityChange: (settings: PhysicsQualitySettings) => void
  private readonly samples: number[] = []
  private qualityIndex = 0
  private warmupElapsedMs = 0
  private cooldownElapsedMs = 0

  constructor(onQualityChange: (settings: PhysicsQualitySettings) => void) {
    this.onQualityChange = onQualityChange
  }

  get settings() {
    return QUALITY_STEPS[this.qualityIndex]!
  }

  get metrics(): PhysicsQualityMetrics | undefined {
    if (this.samples.length < SAMPLE_COUNT) {
      return undefined
    }
    const meanFrameMs =
      this.samples.reduce((total, frameMs) => total + frameMs, 0) / this.samples.length
    const sortedSamples = [...this.samples].sort((left, right) => left - right)
    return {
      averageFps: 1_000 / meanFrameMs,
      p95FrameMs: percentile(sortedSamples, 0.95),
    }
  }

  noteFrame(frameMs: number) {
    if (!Number.isFinite(frameMs) || frameMs <= 0) {
      return false
    }

    if (this.warmupElapsedMs < WARMUP_MS) {
      this.warmupElapsedMs += frameMs
      return false
    }
    if (this.cooldownElapsedMs < COOLDOWN_MS) {
      this.cooldownElapsedMs += frameMs
      return false
    }

    this.samples.push(frameMs)
    if (this.samples.length > SAMPLE_COUNT) {
      this.samples.shift()
    }
    if (this.samples.length < SAMPLE_COUNT) {
      return false
    }

    const metrics = this.metrics
    if (
      metrics &&
      metrics.averageFps >= MIN_AVERAGE_FPS &&
      metrics.p95FrameMs <= MAX_P95_FRAME_MS
    ) {
      this.samples.length = 0
      return false
    }

    const nextQuality = QUALITY_STEPS[this.qualityIndex + 1]
    if (!nextQuality) {
      this.samples.length = 0
      return false
    }

    this.qualityIndex += 1
    this.samples.length = 0
    this.cooldownElapsedMs = 0
    this.onQualityChange(nextQuality)
    return true
  }
}
