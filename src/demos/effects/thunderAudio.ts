import { ref } from 'vue'

import thunderAudioUrl from '@/assets/audio/thunder.wav'
import type { ThunderAudioController, ThunderAudioState } from '@/demos/effects/types'

interface ThunderAudioOptions {
  createElement?: () => HTMLAudioElement
  source?: string
}

export function createThunderAudio(options: ThunderAudioOptions = {}): ThunderAudioController {
  const state = ref<ThunderAudioState>('idle')
  const source = options.source ?? thunderAudioUrl
  let audio = options.createElement?.()

  if (!audio && typeof Audio !== 'undefined') {
    try {
      audio = new Audio(source)
    } catch {
      audio = undefined
    }
  }

  if (!audio) {
    state.value = 'error'
    return {
      dispose: () => undefined,
      play: async () => undefined,
      state,
    }
  }

  const audioElement = audio
  audioElement.loop = true
  audioElement.preload = 'auto'
  audioElement.volume = 0.72
  if (!options.createElement) {
    audioElement.src = source
  }

  async function play() {
    try {
      await audioElement.play()
      state.value = 'playing'
    } catch (error) {
      state.value = 'blocked'
      console.warn('雷声音频自动播放被浏览器阻止，可点击按钮重试。', error)
    }
  }

  return {
    dispose: () => {
      audioElement.pause()
      audioElement.removeAttribute('src')
      if (typeof audioElement.load === 'function') {
        audioElement.load()
      }
      state.value = 'idle'
    },
    play,
    state,
  }
}
