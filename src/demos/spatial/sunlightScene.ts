import * as Cesium from 'cesium'

import {
  createAbortError,
  frameBoundingSphere,
  getPublicAssetUrl,
  throwIfAborted,
  waitForLoad,
} from '@/demos/spatial/shared'
import type { SpatialScene, StatusReporter, SunlightRange } from '@/demos/spatial/types'

const SUNLIGHT_CAMERA_RANGE_FACTOR = 2.8
const SUNLIGHT_TILESET_PATH = 'spatial-analysis/sunlight-model/tileset.json'
const SUNLIGHT_TILESET_LOAD_TIMEOUT_MS = 20_000

function parseSunlightRange(range: SunlightRange) {
  const start = new Date(`${range.date}T${range.startTime}:00`)
  const stop = new Date(`${range.date}T${range.endTime}:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(stop.getTime()) || stop <= start) {
    return undefined
  }
  return { start, stop }
}

function destroyTilesetIfNeeded(tileset: Cesium.Cesium3DTileset) {
  if (!tileset.isDestroyed()) {
    tileset.destroy()
  }
}

async function loadSunlightTileset(signal?: AbortSignal): Promise<Cesium.Cesium3DTileset> {
  throwIfAborted(signal)
  const tilesetPromise = Cesium.Cesium3DTileset.fromUrl(getPublicAssetUrl(SUNLIGHT_TILESET_PATH), {
    cullWithChildrenBounds: true,
    dynamicScreenSpaceError: true,
    maximumScreenSpaceError: 8,
    shadows: Cesium.ShadowMode.ENABLED,
  })

  const tileset = await waitForLoad(tilesetPromise, {
    signal,
    timeoutMs: SUNLIGHT_TILESET_LOAD_TIMEOUT_MS,
    timeoutMessage: '日照分析 3D Tiles 模型加载超时',
    onDiscard(tileset) {
      destroyTilesetIfNeeded(tileset)
    },
  })

  if (signal?.aborted) {
    destroyTilesetIfNeeded(tileset)
    throw createAbortError()
  }

  return tileset
}

export async function createSunlightScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
  initialRange: SunlightRange,
  signal?: AbortSignal,
): Promise<SpatialScene> {
  const tileset = await loadSunlightTileset(signal)
  throwIfAborted(signal)

  viewer.scene.primitives.add(tileset)

  function applyRange(range: SunlightRange, announce: boolean) {
    const parsed = parseSunlightRange(range)
    if (!parsed) {
      setStatus('请选择有效的日期和起止时间，结束时间需要晚于开始时间')
      return
    }

    const startTime = Cesium.JulianDate.fromDate(parsed.start)
    const stopTime = Cesium.JulianDate.fromDate(parsed.stop)
    viewer.clock.startTime = startTime
    viewer.clock.stopTime = stopTime
    viewer.clock.currentTime = startTime.clone()
    viewer.clock.clockRange = Cesium.ClockRange.LOOP_STOP
    viewer.clock.multiplier = 900
    viewer.clock.shouldAnimate = false
    if (announce) {
      setStatus(
        `日照区间已更新为 ${range.date} ${range.startTime}–${range.endTime}，当前处于暂停状态`,
      )
    }
    viewer.scene.requestRender()
  }

  applyRange(initialRange, false)
  setStatus(
    `已加载参考站 4.1.6「日照分析」3D Tiles 城市模型，日照日期 ${initialRange.date}，区间 ${initialRange.startTime}–${initialRange.endTime}；点击播放查看建筑阴影变化`,
  )

  const tick = () => {
    if (viewer.clock.shouldAnimate) {
      viewer.scene.requestRender()
    }
  }
  viewer.scene.preUpdate.addEventListener(tick)

  frameBoundingSphere(viewer, tileset.boundingSphere, 24, -46, SUNLIGHT_CAMERA_RANGE_FACTOR)

  return {
    actions: [
      {
        id: 'play-sunlight',
        label: '播放日照',
        run() {
          viewer.scene.globe.enableLighting = true
          viewer.shadows = true
          viewer.clock.shouldAnimate = true
          setStatus('日照模拟播放中，建筑阴影会随所选时间段变化')
          viewer.scene.requestRender()
        },
      },
      {
        id: 'pause-sunlight',
        label: '暂停日照',
        run() {
          viewer.clock.shouldAnimate = false
          setStatus('日照模拟已暂停')
          viewer.scene.requestRender()
        },
      },
    ],
    applySunlightRange(range) {
      applyRange(range, true)
    },
    dispose() {
      viewer.scene.preUpdate.removeEventListener(tick)
      viewer.clock.shouldAnimate = false
      viewer.shadows = false
      viewer.scene.primitives.remove(tileset)
      destroyTilesetIfNeeded(tileset)
    },
  }
}
