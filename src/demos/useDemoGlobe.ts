import { onBeforeUnmount, onMounted, ref, shallowRef, type Ref } from 'vue'
import * as Cesium from 'cesium'
import 'cesium/Build/Cesium/Widgets/widgets.css'

import {
  disposeActiveSession,
  disposeGlobeSession,
  getActiveSession,
  setActiveSession,
  type GlobeSession,
} from '@/components/cesiumGlobeSession'
import { createTiandituTileUrl, getTiandituToken, tiandituLayers } from '@/config/tianditu'

export interface DemoSceneAction {
  id: string
  label: string
  run: () => void | Promise<void>
}

export interface DemoScene {
  actions: DemoSceneAction[]
  dispose: () => void
}

export interface DemoSceneContext {
  viewer: Cesium.Viewer
  host: HTMLDivElement
  setStatus: (message: string) => void
  signal: AbortSignal
}

interface UseDemoGlobeOptions {
  actionErrorLabel: string
  container: Ref<HTMLDivElement | null>
  creditTestId: string
  errorLabel: string
  errorStatus: string
  initialStatus: string
  loadScene: (context: DemoSceneContext) => Promise<DemoScene>
  scenePrefix: string
  sceneId: string
}

const RENDER_DELAYS = [120, 350, 750, 1_400, 2_400]

export function useDemoGlobe({
  actionErrorLabel,
  container,
  creditTestId,
  errorLabel,
  errorStatus,
  initialStatus,
  loadScene,
  scenePrefix,
  sceneId,
}: UseDemoGlobeOptions) {
  const sceneState = ref<'loading' | 'ready' | 'error'>('loading')
  const statusMessage = ref(initialStatus)
  const actions = ref<DemoSceneAction[]>([])
  const loadedScene = shallowRef<DemoScene | undefined>()
  let session: GlobeSession | undefined
  let scene: DemoScene | undefined
  let sceneAbortController: AbortController | undefined
  let cancelled = false
  let renderTimers: ReturnType<typeof setTimeout>[] = []

  function clearScheduledRenders() {
    renderTimers.forEach((timer) => clearTimeout(timer))
    renderTimers = []
  }

  function scheduleSceneRenders(viewer: Cesium.Viewer) {
    clearScheduledRenders()
    renderTimers = RENDER_DELAYS.map((delay) =>
      setTimeout(() => {
        if (getActiveSession() === session) {
          viewer.scene.requestRender()
        }
      }, delay),
    )
  }

  function resize() {
    session?.viewer.resize()
    session?.viewer.scene.requestRender()
  }

  function setStatus(message: string) {
    statusMessage.value = message
  }

  async function runAction(action: DemoSceneAction) {
    try {
      await action.run()
    } catch (error) {
      console.error(`${actionErrorLabel}：${action.label}`, error)
      setStatus(`${action.label}失败，请重试`)
    }
  }

  async function createSession() {
    if (!container.value) {
      sceneState.value = 'error'
      statusMessage.value = '未找到 Cesium 容器'
      return
    }

    clearScheduledRenders()
    disposeActiveSession()
    sceneAbortController = new AbortController()

    let host: HTMLDivElement | undefined

    try {
      host = document.createElement('div')
      host.className = `${scenePrefix}__viewer`

      const creditContainer = document.createElement('div')
      creditContainer.className = `${scenePrefix}__credits`
      creditContainer.dataset.testid = creditTestId
      creditContainer.hidden = true
      creditContainer.style.display = 'none'
      host.append(creditContainer)

      const viewer = new Cesium.Viewer(host, {
        animation: false,
        baseLayer: false,
        baseLayerPicker: false,
        creditContainer,
        fullscreenButton: false,
        geocoder: false,
        homeButton: false,
        infoBox: false,
        navigationHelpButton: false,
        requestRenderMode: true,
        sceneModePicker: false,
        selectionIndicator: false,
        timeline: false,
        terrainProvider: new Cesium.EllipsoidTerrainProvider(),
      })
      const removeTileLoadProgressListener =
        viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
          viewer.scene.requestRender()
        })

      session = {
        cleanup: () => {
          sceneAbortController?.abort()
          removeTileLoadProgressListener()
        },
        host,
        viewer,
      }
      setActiveSession(session)

      const token = getTiandituToken()
      if (!token) {
        console.error('未配置 VITE_TIANDITU_TOKEN，已跳过天地图图层。')
      }

      const layers = token ? tiandituLayers : []
      for (const layer of layers) {
        viewer.imageryLayers.addImageryProvider(
          new Cesium.WebMapTileServiceImageryProvider({
            url: createTiandituTileUrl(layer.id, token),
            layer: layer.id,
            style: 'default',
            format: 'tiles',
            tileMatrixSetID: 'w',
            tilingScheme: new Cesium.WebMercatorTilingScheme(),
            maximumLevel: 18,
            subdomains: ['0', '1', '2', '3', '4', '5', '6', '7'],
            credit: '天地图',
            enablePickFeatures: false,
          }),
        )
      }

      container.value.replaceChildren(host)
      viewer.resize()
      scene = await loadScene({
        host,
        setStatus,
        signal: sceneAbortController.signal,
        viewer,
      })

      if (cancelled || sceneAbortController.signal.aborted || getActiveSession() !== session) {
        scene.dispose()
        scene = undefined
        return
      }

      loadedScene.value = scene
      actions.value = scene.actions
      session.cleanup = () => {
        sceneAbortController?.abort()
        removeTileLoadProgressListener()
        loadedScene.value = undefined
        scene?.dispose()
        scene = undefined
      }

      if (typeof ResizeObserver !== 'undefined') {
        session.resizeObserver = new ResizeObserver(resize)
        session.resizeObserver.observe(host)
      }

      viewer.resize()
      viewer.scene.requestRender()
      sceneState.value = 'ready'
      scheduleSceneRenders(viewer)
    } catch (error) {
      const aborted = sceneAbortController?.signal.aborted ?? false
      scene?.dispose()
      scene = undefined
      loadedScene.value = undefined

      if (session) {
        if (getActiveSession() === session) {
          disposeGlobeSession(session)
        }
        session = undefined
      }

      host?.remove()
      if (aborted) {
        return
      }

      console.error(`${errorLabel}：${sceneId}`, error)
      sceneState.value = 'error'
      statusMessage.value = errorStatus
    }
  }

  onMounted(() => {
    void createSession()
  })

  onBeforeUnmount(() => {
    cancelled = true
    sceneAbortController?.abort()
    clearScheduledRenders()
    scene?.dispose()
    scene = undefined
    loadedScene.value = undefined

    if (session) {
      if (getActiveSession() === session) {
        disposeGlobeSession(session)
      }
      session = undefined
    }
  })

  return {
    actions,
    scene: loadedScene,
    resize,
    runAction,
    sceneState,
    statusMessage,
  }
}
