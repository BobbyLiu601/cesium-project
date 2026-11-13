import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createVideoFusionPlayback,
  VIDEO_FUSION_LIVE_STREAM_URL,
} from '../demos/spatial/videoFusionPlayback'

const hlsInstances = vi.hoisted(() => [] as MockHls[])

interface MockHls {
  destroyed: boolean
  handlers: Map<string, Set<(event: unknown, data: { fatal?: boolean; details?: string }) => void>>
  media?: HTMLMediaElement
  source?: string
  attachMedia: (media: HTMLMediaElement) => void
  destroy: () => void
  emit: (event: string, data?: { fatal?: boolean; details?: string }) => void
  loadSource: (source: string) => void
  off: (
    event: string,
    handler: (event: unknown, data: { fatal?: boolean; details?: string }) => void,
  ) => void
  on: (
    event: string,
    handler: (event: unknown, data: { fatal?: boolean; details?: string }) => void,
  ) => void
}

vi.mock('hls.js', () => {
  class Hls implements MockHls {
    static Events = {
      ERROR: 'error',
      MANIFEST_PARSED: 'manifestParsed',
    }

    static isSupported() {
      return true
    }

    destroyed = false
    handlers = new Map<
      string,
      Set<(event: unknown, data: { fatal?: boolean; details?: string }) => void>
    >()
    media?: HTMLMediaElement
    source?: string

    constructor() {
      hlsInstances.push(this)
    }

    attachMedia(media: HTMLMediaElement) {
      this.media = media
    }

    destroy() {
      this.destroyed = true
    }

    emit(event: string, data = {}) {
      this.handlers.get(event)?.forEach((handler) => handler(undefined, data))
    }

    loadSource(source: string) {
      this.source = source
    }

    off(
      event: string,
      handler: (event: unknown, data: { fatal?: boolean; details?: string }) => void,
    ) {
      this.handlers.get(event)?.delete(handler)
    }

    on(
      event: string,
      handler: (event: unknown, data: { fatal?: boolean; details?: string }) => void,
    ) {
      const handlers = this.handlers.get(event) ?? new Set()
      handlers.add(handler)
      this.handlers.set(event, handlers)
    }
  }

  return { default: Hls }
})

const messages = {
  localPlaying: '本地视频播放中',
  localFailed: '本地视频播放失败',
  liveConnecting: '正在连接直播流',
  livePlaying: '直播流已连接',
  liveFallback: '直播流不可用，已切换本地回退视频',
}

function createHarness(mode: 'local' | 'live-with-fallback') {
  const host = document.createElement('div')
  document.body.append(host)
  const statuses: string[] = []
  const playback = createVideoFusionPlayback({
    host,
    localVideoUrl: '/local-video.mp4',
    messages,
    mode,
    setStatus: (message) => statuses.push(message),
  })

  return { host, playback, statuses }
}

describe('video fusion playback', () => {
  beforeEach(() => {
    hlsInstances.length = 0
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue()
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('')
  })

  afterEach(() => {
    vi.restoreAllMocks()
    document.body.replaceChildren()
  })

  it('creates a muted looping local video and releases it on dispose', async () => {
    const { host, playback, statuses } = createHarness('local')

    expect(playback.element.muted).toBe(true)
    expect(playback.element.loop).toBe(true)
    expect(playback.element.playsInline).toBe(true)
    expect(host.contains(playback.element)).toBe(true)
    expect(statuses).toEqual([messages.localPlaying])

    await playback.start()

    expect(playback.element.dataset.videoSource).toBe('local')
    expect(playback.element.src).toContain('/local-video.mp4')

    playback.dispose()

    expect(playback.element.isConnected).toBe(false)
    expect(playback.element.getAttribute('src')).toBeNull()
  })

  it('connects the live stream through the lazy HLS adapter', async () => {
    const { playback, statuses } = createHarness('live-with-fallback')
    const sources: string[] = []
    const unsubscribe = playback.subscribeSourceChange?.((source) => sources.push(source))

    await playback.start()
    await vi.waitFor(() => {
      expect(hlsInstances).toHaveLength(1)
    })
    const hls = hlsInstances[0]!
    expect(hls.source).toBe(VIDEO_FUSION_LIVE_STREAM_URL)
    expect(hls.media).toBe(playback.element)

    hls.emit('manifestParsed')
    await vi.waitFor(() => {
      expect(playback.element.dataset.videoSource).toBe('live')
      expect(statuses[statuses.length - 1]).toBe(messages.livePlaying)
    })
    expect(sources).toEqual(['live'])

    unsubscribe?.()
    playback.dispose()
    expect(hls.destroyed).toBe(true)
  })

  it('uses native HLS on Safari', async () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 Version/17.5 Safari/605.1.15',
    )
    vi.spyOn(HTMLMediaElement.prototype, 'canPlayType').mockReturnValue('maybe')
    const { playback, statuses } = createHarness('live-with-fallback')

    await playback.start()
    await vi.waitFor(() => {
      expect(playback.element.src).toContain(VIDEO_FUSION_LIVE_STREAM_URL)
    })
    playback.element.dispatchEvent(new Event('loadeddata'))

    await vi.waitFor(() => {
      expect(playback.element.dataset.videoSource).toBe('live')
      expect(statuses[statuses.length - 1]).toBe(messages.livePlaying)
    })
    expect(hlsInstances).toHaveLength(0)

    playback.dispose()
  })

  it('falls back to the local video when a fatal HLS error occurs', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { playback, statuses } = createHarness('live-with-fallback')

    await playback.start()
    await vi.waitFor(() => {
      expect(hlsInstances).toHaveLength(1)
    })
    hlsInstances[0]!.emit('error', { details: 'networkError', fatal: true })

    await vi.waitFor(() => {
      expect(playback.element.dataset.videoSource).toBe('local')
      expect(statuses[statuses.length - 1]).toBe(messages.liveFallback)
    })
    expect(consoleError).toHaveBeenCalled()

    playback.dispose()
  })

  it('falls back when the live stream fails after playback starts', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { playback, statuses } = createHarness('live-with-fallback')
    const sources: string[] = []
    playback.subscribeSourceChange?.((source) => sources.push(source))

    await playback.start()
    await vi.waitFor(() => {
      expect(hlsInstances).toHaveLength(1)
    })
    const hls = hlsInstances[0]!
    hls.emit('manifestParsed')
    await vi.waitFor(() => {
      expect(statuses[statuses.length - 1]).toBe(messages.livePlaying)
    })

    hls.emit('error', { details: 'bufferAppendError', fatal: true })

    await vi.waitFor(() => {
      expect(playback.element.dataset.videoSource).toBe('local')
      expect(statuses[statuses.length - 1]).toBe(messages.liveFallback)
    })
    expect(sources).toEqual(['live', 'local'])
    expect(hls.destroyed).toBe(true)
    expect(consoleError).toHaveBeenCalled()

    playback.dispose()
  })

  it('does not leave a late HLS instance active after disposal', async () => {
    const { playback } = createHarness('live-with-fallback')

    await playback.start()
    await vi.waitFor(() => {
      expect(hlsInstances).toHaveLength(1)
    })
    const hls = hlsInstances[0]!

    playback.dispose()
    hls.emit('manifestParsed')
    await Promise.resolve()

    expect(hls.destroyed).toBe(true)
    expect(playback.element.dataset.videoSource).toBe('local')
  })
})
