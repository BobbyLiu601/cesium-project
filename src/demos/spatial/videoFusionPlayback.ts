import type { StatusReporter } from '@/demos/spatial/types'

export const VIDEO_FUSION_LIVE_STREAM_URL =
  'https://kbs-dokdo.gscdn.com/dokdo_300/definst/dokdo_300.stream/playlist.m3u8'

const LIVE_STREAM_START_TIMEOUT_MS = 12_000

export type VideoFusionSource = 'local' | 'live'

export interface VideoFusionPlayback {
  element: HTMLVideoElement
  start: () => Promise<void>
  dispose: () => void
  subscribeSourceChange?: (listener: (source: VideoFusionSource) => void) => () => void
}

export interface VideoFusionPlaybackMessages {
  localPlaying: string
  localFailed: string
  liveConnecting: string
  livePlaying: string
  liveFallback: string
}

interface CreateVideoFusionPlaybackOptions {
  host: HTMLElement
  localVideoUrl: string
  messages: VideoFusionPlaybackMessages
  mode: 'local' | 'live-with-fallback'
  setStatus: StatusReporter
  signal?: AbortSignal
}

function describeMediaError(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function shouldUseNativeHls(video: HTMLVideoElement) {
  const userAgent = navigator.userAgent
  const isSafari =
    /Safari\//.test(userAgent) && !/(Chrome|Chromium|CriOS|Edg|OPR|Firefox)\//.test(userAgent)
  return isSafari && video.canPlayType('application/vnd.apple.mpegurl') !== ''
}

export function createVideoFusionPlayback({
  host,
  localVideoUrl,
  messages,
  mode,
  setStatus,
  signal,
}: CreateVideoFusionPlaybackOptions): VideoFusionPlayback {
  const video = document.createElement('video')
  video.autoplay = true
  video.loop = true
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.tabIndex = -1
  video.dataset.videoFusion = 'true'
  video.setAttribute('aria-hidden', 'true')
  Object.assign(video.style, {
    position: 'absolute',
    top: '0',
    left: '0',
    width: '2px',
    height: '2px',
    opacity: '0.001',
    pointerEvents: 'none',
  })
  host.append(video)

  const abortController = new AbortController()
  let disposed = false
  let liveAttempt = 0
  let hls: import('hls.js').default | undefined
  const sourceListeners = new Set<(source: VideoFusionSource) => void>()

  const abortFromOutside = () => abortController.abort()
  signal?.addEventListener('abort', abortFromOutside, { once: true })
  if (signal?.aborted) {
    abortController.abort()
  }

  function destroyHls() {
    hls?.destroy()
    hls = undefined
  }

  function markVideoSource(sourceType: VideoFusionSource) {
    if (video.dataset.videoSource === sourceType) {
      return
    }

    video.dataset.videoSource = sourceType
    sourceListeners.forEach((listener) => listener(sourceType))
  }

  function setVideoSource(source: string, sourceType: VideoFusionSource) {
    markVideoSource(sourceType)
    video.src = source
  }

  async function playVideo(reportFailure = true) {
    try {
      await video.play()
      return true
    } catch (error) {
      if (reportFailure && !disposed && !abortController.signal.aborted) {
        console.error('视频融合播放器启动失败', error)
        setStatus(messages.localFailed)
      }
      return false
    }
  }

  function waitForNativeHls() {
    return new Promise<void>((resolve, reject) => {
      let settled = false
      const finish = (error?: Error) => {
        if (settled) {
          return
        }
        settled = true
        window.clearTimeout(timeoutId)
        abortController.signal.removeEventListener('abort', handleAbort)
        video.removeEventListener('loadeddata', handleReady)
        video.removeEventListener('error', handleError)
        if (error) {
          reject(error)
        } else {
          resolve()
        }
      }
      const handleReady = () => finish()
      const handleError = () => finish(new Error('原生 HLS 直播流加载失败'))
      const handleAbort = () => finish(new DOMException('直播流连接已取消', 'AbortError'))
      const timeoutId = window.setTimeout(
        () => finish(new Error('原生 HLS 直播流连接超时')),
        LIVE_STREAM_START_TIMEOUT_MS,
      )

      video.addEventListener('loadeddata', handleReady, { once: true })
      video.addEventListener('error', handleError, { once: true })
      abortController.signal.addEventListener('abort', handleAbort, { once: true })
    })
  }

  async function attachHls(attempt: number) {
    const { default: Hls } = await import('hls.js')
    if (!Hls.isSupported()) {
      throw new Error('当前浏览器不支持 MediaSource HLS 播放')
    }

    const instance = new Hls({
      backBufferLength: 30,
      enableWorker: true,
      lowLatencyMode: true,
    })
    hls = instance

    try {
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const finish = (error?: Error) => {
          if (settled) {
            return
          }
          settled = true
          window.clearTimeout(timeoutId)
          abortController.signal.removeEventListener('abort', handleAbort)
          instance.off(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
          instance.off(Hls.Events.ERROR, handleError)
          if (error) {
            reject(error)
          } else {
            resolve()
          }
        }
        const handleManifestParsed = () => finish()
        const handleError = (_event: unknown, data: { fatal?: boolean; details?: string }) => {
          if (data.fatal) {
            finish(new Error(`HLS 直播流加载失败：${data.details ?? '未知错误'}`))
          }
        }
        const handleAbort = () => finish(new DOMException('直播流连接已取消', 'AbortError'))
        const timeoutId = window.setTimeout(
          () => finish(new Error('HLS 直播流连接超时')),
          LIVE_STREAM_START_TIMEOUT_MS,
        )

        instance.on(Hls.Events.MANIFEST_PARSED, handleManifestParsed)
        instance.on(Hls.Events.ERROR, handleError)
        abortController.signal.addEventListener('abort', handleAbort, { once: true })
        instance.attachMedia(video)
        instance.loadSource(VIDEO_FUSION_LIVE_STREAM_URL)
      })

      const handleRuntimeError = (_event: unknown, data: { fatal?: boolean; details?: string }) => {
        if (!data.fatal || disposed || attempt !== liveAttempt || abortController.signal.aborted) {
          return
        }

        console.error(`HLS 直播流运行时失败：${data.details ?? '未知错误'}`)
        void switchToLocalAfterLiveFailure(attempt)
      }
      instance.on(Hls.Events.ERROR, handleRuntimeError)
    } catch (error) {
      destroyHls()
      throw error
    }
  }

  async function switchToLocalAfterLiveFailure(failedAttempt: number) {
    if (disposed || failedAttempt !== liveAttempt || abortController.signal.aborted) {
      return
    }

    destroyHls()
    setVideoSource(localVideoUrl, 'local')
    const playing = await playVideo()
    if (playing && !disposed && failedAttempt === liveAttempt && !abortController.signal.aborted) {
      setStatus(messages.liveFallback)
    }
  }

  async function connectLive() {
    const attempt = ++liveAttempt
    destroyHls()

    try {
      if (shouldUseNativeHls(video)) {
        setVideoSource(VIDEO_FUSION_LIVE_STREAM_URL, 'live')
        await waitForNativeHls()
      } else {
        await attachHls(attempt)
      }

      if (disposed || attempt !== liveAttempt || abortController.signal.aborted) {
        return
      }

      markVideoSource('live')
      if (!(await playVideo(false))) {
        await switchToLocalAfterLiveFailure(attempt)
        return
      }
      setStatus(messages.livePlaying)
    } catch (error) {
      if (abortController.signal.aborted || attempt !== liveAttempt) {
        return
      }
      console.error(`视频投射直播流连接失败，已切换本地回退视频：${describeMediaError(error)}`)
      await switchToLocalAfterLiveFailure(attempt)
    }
  }

  setVideoSource(localVideoUrl, 'local')
  setStatus(mode === 'local' ? messages.localPlaying : messages.liveConnecting)

  return {
    element: video,
    subscribeSourceChange(listener) {
      sourceListeners.add(listener)
      return () => sourceListeners.delete(listener)
    },
    async start() {
      if (disposed) {
        return
      }
      await playVideo()
      if (mode === 'live-with-fallback' && !disposed) {
        void connectLive()
      }
    },
    dispose() {
      disposed = true
      liveAttempt += 1
      abortController.abort()
      signal?.removeEventListener('abort', abortFromOutside)
      sourceListeners.clear()
      destroyHls()
      video.pause()
      video.removeAttribute('src')
      video.remove()
    },
  }
}
