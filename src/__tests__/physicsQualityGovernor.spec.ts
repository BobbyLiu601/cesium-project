import { describe, expect, it } from 'vitest'

import {
  PhysicsQualityGovernor,
  type PhysicsQualitySettings,
} from '@/demos/physicsEngine/qualityGovernor'

function feedFrames(governor: PhysicsQualityGovernor, frameMs: number, count: number) {
  for (let index = 0; index < count; index += 1) {
    governor.noteFrame(frameMs)
  }
}

describe('physics quality governor', () => {
  it('keeps full quality when frame pacing meets the target', () => {
    const changes: PhysicsQualitySettings[] = []
    const governor = new PhysicsQualityGovernor((settings) => changes.push(settings))

    feedFrames(governor, 1_000 / 60, 240)

    expect(changes).toHaveLength(0)
    expect(governor.settings).toMatchObject({
      effects: 'full',
      resolutionScale: 1,
    })
  })

  it('disables expensive effects first, then lowers resolution while frame pacing stays poor', () => {
    const changes: PhysicsQualitySettings[] = []
    const governor = new PhysicsQualityGovernor((settings) => changes.push(settings))

    feedFrames(governor, 60, 160)

    expect(changes.length).toBeGreaterThanOrEqual(2)
    expect(changes[0]).toMatchObject({
      effects: 'reduced',
      resolutionScale: 1,
    })
    expect(changes[1]).toMatchObject({
      effects: 'reduced',
      resolutionScale: 0.85,
    })
    expect(governor.settings.resolutionScale).toBeLessThan(1)
  })
})
