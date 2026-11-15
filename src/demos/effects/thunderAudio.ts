import { ref } from 'vue'

import type { ThunderAudioController, ThunderAudioState } from '@/demos/effects/types'

interface ThunderAudioEngine {
  play: () => Promise<void>
  dispose: () => void
}

interface ThunderAudioOptions {
  createEngine?: () => ThunderAudioEngine | undefined
}

const THUNDER_LOOP_SECONDS = 12
const THUNDER_SAMPLE_RATE = 22_050

class ThunderAudioBlockedError extends Error {
  constructor() {
    super('浏览器阻止了雷声音频播放')
    this.name = 'ThunderAudioBlockedError'
  }
}

function isBlockedAudioError(error: unknown) {
  if (error instanceof ThunderAudioBlockedError) {
    return true
  }

  return typeof error === 'object' && error !== null && 'name' in error
    ? error.name === 'NotAllowedError'
    : false
}

function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function thunderBurst(seconds: number, start: number) {
  if (seconds < start) {
    return 0
  }

  const elapsed = seconds - start
  if (elapsed > 5.2) {
    return 0
  }

  const crack = Math.exp(-elapsed * 13) * smoothstep(0, 0.025, elapsed)
  const rumble = Math.exp(-elapsed * 0.72) * smoothstep(0, 0.18, elapsed)
  const roll = 0.68 + 0.32 * Math.sin(elapsed * 8.7) * Math.sin(elapsed * 2.3)
  return crack * 0.8 + rumble * roll
}

function createThunderBuffer(context: AudioContext) {
  const sampleRate = Math.min(context.sampleRate, THUNDER_SAMPLE_RATE)
  const sampleCount = sampleRate * THUNDER_LOOP_SECONDS
  const buffer = context.createBuffer(1, sampleCount, sampleRate)
  const channel = buffer.getChannelData(0)
  let seed = 0x5eed1234
  let lowNoise = 0
  let rumbleNoise = 0

  function random() {
    seed = (1664525 * seed + 1013904223) >>> 0
    return seed / 0x1_0000_0000
  }

  for (let index = 0; index < sampleCount; index += 1) {
    const seconds = index / sampleRate
    const white = random() * 2 - 1
    lowNoise += (white - lowNoise) * 0.018
    rumbleNoise += (white - rumbleNoise) * 0.0025

    const envelope =
      thunderBurst(seconds, 0.12) +
      thunderBurst(seconds, 3.65) * 0.78 +
      thunderBurst(seconds, 7.85) * 0.9
    const lowTone =
      Math.sin(2 * Math.PI * 46 * seconds) * 0.22 +
      Math.sin(2 * Math.PI * 73 * seconds + 0.7) * 0.12
    const tail = 0.004 * Math.sin(2 * Math.PI * 0.18 * seconds)
    const signal =
      (lowNoise * 1.8 + rumbleNoise * 8.5 + lowTone) * envelope * 0.62 + tail * (1 - envelope)

    channel[index] = Math.tanh(signal * 1.6) * 0.72
  }

  return buffer
}

function createWebAudioThunderEngine(): ThunderAudioEngine | undefined {
  const audioContextConstructor = globalThis.AudioContext
  if (!audioContextConstructor) {
    return undefined
  }

  let context: AudioContext
  try {
    context = new audioContextConstructor()
  } catch {
    return undefined
  }

  let source: AudioBufferSourceNode | undefined
  let gain: GainNode | undefined

  return {
    dispose: () => {
      if (source) {
        try {
          source.stop()
        } catch {
          // 已停止的音源再次 stop 会抛错，销毁时可以安全忽略。
        }
        source.disconnect()
        source = undefined
      }
      gain?.disconnect()
      gain = undefined
      if (context.state !== 'closed') {
        void context.close().catch(() => undefined)
      }
    },
    play: async () => {
      if (context.state === 'suspended') {
        try {
          await context.resume()
        } catch {
          throw new ThunderAudioBlockedError()
        }
      }

      if (context.state !== 'running') {
        throw new ThunderAudioBlockedError()
      }

      if (!source) {
        source = context.createBufferSource()
        gain = context.createGain()
        gain.gain.value = 0.72
        source.buffer = createThunderBuffer(context)
        source.loop = true
        source.connect(gain)
        gain.connect(context.destination)
        source.start()
      }
    },
  }
}

export function createThunderAudio(options: ThunderAudioOptions = {}): ThunderAudioController {
  const state = ref<ThunderAudioState>('idle')
  let engine: ThunderAudioEngine | undefined
  let disposed = false

  function ensureEngine() {
    if (engine) {
      return engine
    }

    try {
      engine = options.createEngine?.() ?? createWebAudioThunderEngine()
    } catch (error) {
      console.error('雷声音频引擎初始化失败。', error)
      engine = undefined
    }
    return engine
  }

  async function play() {
    if (disposed) {
      return
    }

    const activeEngine = ensureEngine()
    if (!activeEngine) {
      state.value = 'error'
      console.warn('当前浏览器不支持 Web Audio，无法播放雷声。')
      return
    }

    try {
      await activeEngine.play()
      if (!disposed) {
        state.value = 'playing'
      }
    } catch (error) {
      if (disposed) {
        return
      }

      if (isBlockedAudioError(error)) {
        state.value = 'blocked'
        console.warn('雷声音频自动播放被浏览器阻止，可点击按钮重试。', error)
        return
      }

      state.value = 'error'
      console.error('雷声音频播放失败。', error)
    }
  }

  return {
    dispose: () => {
      disposed = true
      engine?.dispose()
      engine = undefined
      state.value = 'idle'
    },
    play,
    state,
  }
}
