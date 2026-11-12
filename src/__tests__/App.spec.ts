import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'

import App from '../App.vue'
import { disposeActiveSession, getActiveSession } from '../components/cesiumGlobeSession'
import { AmapTilingScheme } from '../config/amap'
import router from '../router'
import {
  ArcGISTiledElevationTerrainProvider,
  cesiumMockState,
  CesiumTerrainProvider,
  elevationProviderRequests,
  elevationTerrainProviderInstances,
  EllipsoidTerrainProvider,
  primitiveInstances,
  resetCesiumMock,
  tileLoadProgressListeners,
  tileProviderInstances,
  viewerInstances,
  WebMercatorTilingScheme,
} from './mocks/cesium'

vi.mock('cesium', async () => import('./mocks/cesium'))

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

async function mountAt(path: string) {
  await router.push(path)
  await router.isReady()

  const wrapper = mount(App, {
    global: {
      plugins: [createPinia(), router, [ElementPlus, { locale: zhCn }]],
      stubs: {
        teleport: true,
      },
    },
  })

  await flushPromises()
  return wrapper
}

async function openGlobe(wrapper: Awaited<ReturnType<typeof mountAt>>) {
  await wrapper.get('[data-feature-id="tianditu"]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => {
    expect(viewerInstances).toHaveLength(1)
  })
  await flushPromises()
}

async function openElevation(wrapper: Awaited<ReturnType<typeof mountAt>>) {
  await wrapper.get('[data-feature-id="elevation"]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => {
    expect(viewerInstances).toHaveLength(1)
  })
  await flushPromises()
}

const frameCallbacks: FrameRequestCallback[] = []

describe('App', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    })
    Object.defineProperty(globalThis, 'requestAnimationFrame', {
      configurable: true,
      value: vi.fn<(callback: FrameRequestCallback) => number>((callback) => {
        frameCallbacks.push(callback)
        return frameCallbacks.length
      }),
    })
    Object.defineProperty(globalThis, 'cancelAnimationFrame', {
      configurable: true,
      value: vi.fn<(handle: number) => void>(),
    })
  })

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver')
    Reflect.deleteProperty(globalThis, 'requestAnimationFrame')
    Reflect.deleteProperty(globalThis, 'cancelAnimationFrame')
  })

  beforeEach(() => {
    disposeActiveSession()
    resetCesiumMock()
    frameCallbacks.length = 0
    vi.mocked(cancelAnimationFrame).mockClear()
    vi.stubEnv('VITE_TIANDITU_TOKEN', 'test-tianditu-token')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('redirects the root route to the layer catalog', async () => {
    const wrapper = await mountAt('/')

    expect(router.currentRoute.value.fullPath).toBe('/layers')
    expect(wrapper.text()).toContain('三维效果展示')
    expect(wrapper.get('h1').text()).toBe('1、图层')
    expect(wrapper.get('#spatial-heading').text()).toBe('2、空间分析')
    expect(wrapper.findAll('[data-testid="feature-card"]')).toHaveLength(25)
    expect(wrapper.findAll('.sidebar-menu__group')).toHaveLength(2)
    expect(wrapper.findAll('.sidebar-menu__section-item')).toHaveLength(5)
    expect(wrapper.get('.sidebar-menu').text()).not.toContain('1.1.1、天地图')
    expect(wrapper.findAll('.el-sub-menu__icon-arrow').length).toBeGreaterThanOrEqual(2)
    expect(wrapper.find('.sidebar-menu__marker').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('展示能力')
    expect(wrapper.text()).not.toContain('从统一入口浏览当前已准备的展示能力')

    wrapper.unmount()
  })

  it('shows numbered layer groups and accessible feature cards', async () => {
    const wrapper = await mountAt('/layers')
    const cards = wrapper.findAll('[data-testid="feature-card"]')

    expect(cards).toHaveLength(25)
    expect(cards[0]?.attributes('data-feature-id')).toBe('tianditu')
    expect(cards[1]?.attributes('data-feature-id')).toBe('amap')
    expect(cards[2]?.attributes('data-feature-id')).toBe('elevation')
    expect(cards[3]?.attributes('data-feature-id')).toBe('entity-point')
    expect(cards[18]?.attributes('data-feature-id')).toBe('gif')
    expect(cards[19]?.attributes('data-feature-id')).toBe('model-interpolation')
    expect(cards[20]?.attributes('data-feature-id')).toBe('wind-turbine')
    expect(cards[21]?.attributes('data-feature-id')).toBe('inundation-analysis-simple')
    expect(cards[22]?.attributes('data-feature-id')).toBe('sunlight-analysis')
    expect(cards[23]?.attributes('data-feature-id')).toBe('water-surface')
    expect(cards[24]?.attributes('data-feature-id')).toBe('aspect-analysis')
    expect(cards.map((card) => card.attributes('id'))).toEqual(
      cards.map((card) => card.attributes('data-feature-id')),
    )
    expect(
      wrapper.get('[data-testid="feature-grid"]').findAll('[data-testid="feature-card"]'),
    ).toHaveLength(2)
    expect(
      wrapper.get('[data-testid="terrain-grid"]').findAll('[data-testid="feature-card"]'),
    ).toHaveLength(1)
    expect(
      wrapper.get('[data-testid="vector-grid"]').findAll('[data-testid="feature-card"]'),
    ).toHaveLength(16)
    expect(
      wrapper.get('[data-testid="model-grid"]').findAll('[data-testid="feature-card"]'),
    ).toHaveLength(2)
    expect(
      wrapper.get('[data-testid="spatial-grid"]').findAll('[data-testid="feature-card"]'),
    ).toHaveLength(4)

    for (const card of cards) {
      expect(card.element.tagName).toBe('BUTTON')
      expect(card.attributes('type')).toBe('button')
      expect(card.findAll('div')).toHaveLength(0)
      expect(card.findAll('span')).toHaveLength(3)
      expect(card.findAll('span')[0]?.classes()).toContain('feature-card__heading')
      expect(card.findAll('span')[2]?.classes()).toContain('feature-card__media')
      expect(card.get('img').attributes('src')).not.toMatch(/^https?:\/\//)
    }

    expect(cards[0]?.attributes('aria-label')).toBe('打开1.1.1、天地图')
    expect(cards[0]?.text()).toContain('1.1.1、天地图')
    expect(cards[0]?.get('img').attributes('alt')).toBe('天地图卫星影像三维地球实际效果截图')
    expect(cards[1]?.attributes('aria-label')).toBe('打开1.1.2、高德地图')
    expect(cards[1]?.text()).toContain('1.1.2、高德地图')
    expect(cards[1]?.get('img').attributes('alt')).toBe('高德地图标准矢量三维地球实际效果截图')
    expect(cards[2]?.attributes('aria-label')).toBe('打开1.2.1、高程')
    expect(cards[2]?.text()).toContain('1.2.1、高程')
    expect(cards[2]?.get('img').attributes('alt')).toBe('从化山地三维地形效果')
    expect(cards[3]?.attributes('aria-label')).toBe('打开1.3.1、entity点')
    expect(cards[18]?.attributes('aria-label')).toBe('打开1.3.16、gif')
    expect(cards[19]?.attributes('aria-label')).toBe('打开1.4.1、模型插值运动')
    expect(cards[20]?.attributes('aria-label')).toBe('打开1.4.2、风力发电机')
    expect(cards[21]?.attributes('aria-label')).toBe('打开2.1.3、淹没分析（简易）')
    expect(cards[21]?.get('img').attributes('alt')).toBe('淹没分析（简易）参考示例封面')
    expect(cards[22]?.attributes('aria-label')).toBe('打开2.1.6、日照分析')
    expect(cards[23]?.attributes('aria-label')).toBe('打开2.1.10、水域面')
    expect(cards[24]?.attributes('aria-label')).toBe('打开2.1.13、坡向分析')
    expect(wrapper.get('h1').text()).toBe('1、图层')
    expect(wrapper.get('h2').text()).toBe('1.1、影像')
    expect(wrapper.text()).not.toContain('展示能力')
    expect(wrapper.text()).not.toContain('从统一入口浏览当前已准备的展示能力')
    expect(
      wrapper.findAll('[data-testid="page-heading"]').map((heading) => heading.text()),
    ).toEqual(['1、图层', '2、空间分析'])
    expect(wrapper.findAll('.showcase__group-title').map((heading) => heading.text())).toEqual([
      '1.1、影像',
      '1.2、地形',
      '1.3、矢量',
      '1.4、模型',
      '2.1、空间分析',
    ])

    wrapper.unmount()
  })

  it('opens a non-fullscreen globe dialog with both Tianditu WMTS layers', async () => {
    const wrapper = await mountAt('/layers')
    await openGlobe(wrapper)

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('1.1.1、天地图')
    expect(dialog.classes()).not.toContain('is-fullscreen')
    const globe = wrapper.get('[data-testid="cesium-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.options).toMatchObject({
      baseLayer: false,
      animation: false,
      timeline: false,
      geocoder: false,
      baseLayerPicker: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      requestRenderMode: true,
    })
    expect(viewerInstances[0]?.camera.setView).toHaveBeenCalledOnce()
    const creditContainer = viewerInstances[0]?.options.creditContainer as HTMLElement
    expect(creditContainer.hidden).toBe(true)
    expect(creditContainer.style.display).toBe('none')

    const headerButtons = wrapper.get('.el-dialog__header').findAll('button')
    expect(headerButtons.map((button) => button.attributes('aria-label'))).toEqual([
      '全屏',
      '关闭此对话框',
    ])
    expect(headerButtons[0]?.text()).toBe('')
    expect(headerButtons[0]?.find('svg').exists()).toBe(true)
    expect(wrapper.find('button[aria-label="关闭天地图弹窗"]').exists()).toBe(false)

    const token = encodeURIComponent('test-tianditu-token')
    expect(tileProviderInstances).toHaveLength(2)
    expect(tileProviderInstances.map((provider) => provider.options.layer)).toEqual(['img', 'cia'])

    for (const provider of tileProviderInstances) {
      expect(provider.options.url).toContain(`tk=${token}`)
      expect(provider.options.url).toContain('TILEMATRIXSET=w')
      expect(provider.options.tilingScheme).toBeInstanceOf(WebMercatorTilingScheme)
      expect(provider.options.maximumLevel).toBe(18)
      expect(provider.options.subdomains).toEqual(['0', '1', '2', '3', '4', '5', '6', '7'])
    }

    await wrapper.get('.feature-dialog button[aria-label="关闭此对话框"]').trigger('click')
    await flushPromises()
    wrapper.unmount()
  })

  it('opens the AMap electric layer in Cesium with WGS84 tile alignment metadata', async () => {
    const wrapper = await mountAt('/layers')

    await wrapper.get('[data-feature-id="amap"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const dialog = wrapper.get('.feature-dialog--amap')
    const globe = dialog.get('[data-testid="cesium-globe"]')
    expect(dialog.text()).toContain('1.1.2、高德地图')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.attributes('data-imagery-source')).toBe('amap')
    expect(dialog.get('[data-testid="amap-attribution"]').text()).toBe('© 高德地图')

    expect(tileProviderInstances).toHaveLength(1)
    const provider = tileProviderInstances[0]
    expect(provider?.options).toMatchObject({
      url: expect.stringContaining('webrd{s}.is.autonavi.com/appmaptile'),
      maximumLevel: 18,
      subdomains: ['01', '02', '03', '04'],
      credit: '高德地图',
      enablePickFeatures: false,
    })
    expect(provider?.options.tilingScheme).toBeInstanceOf(AmapTilingScheme)
    expect(provider?.options.url).toContain('style=8')
    expect(provider?.options.url).not.toContain('key=')
    expect(viewerInstances[0]?.camera.setView).toHaveBeenCalledWith({
      destination: { longitude: 116.397, latitude: 39.909, height: 60_000 },
      orientation: {
        heading: 0,
        pitch: -Math.PI / 2,
        roll: 0,
      },
    })

    wrapper.unmount()
  })

  it('loads the elevation scene independently and applies terrain after the provider resolves', async () => {
    let resolveProvider!: (provider: ArcGISTiledElevationTerrainProvider) => void
    cesiumMockState.elevationProviderPromise = new Promise((resolve) => {
      resolveProvider = resolve
    })

    const wrapper = await mountAt('/layers')
    await openElevation(wrapper)

    const dialog = wrapper.get('.feature-dialog--elevation')
    expect(dialog.text()).toContain('高程')
    expect(dialog.classes()).not.toContain('is-fullscreen')
    expect(wrapper.find('[data-testid="elevation-globe"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="elevation-globe"]').attributes('data-cesium-state')).toBe(
      'ready',
    )
    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.options).toMatchObject({
      requestRenderMode: true,
    })
    expect(viewerInstances[0]?.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewerInstances[0]?.camera.setView).not.toHaveBeenCalled()
    expect(viewerInstances[0]?.scene.requestRender).toHaveBeenCalled()
    expect(elevationProviderRequests).toEqual([
      {
        url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
        options: undefined,
      },
    ])
    expect(tileProviderInstances).toHaveLength(2)

    const creditContainer = viewerInstances[0]?.options.creditContainer as HTMLElement
    expect(creditContainer.hidden).toBe(true)
    expect(creditContainer.style.display).toBe('none')

    const provider = new ArcGISTiledElevationTerrainProvider(
      'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
    )
    const requestRender = viewerInstances[0]?.scene.requestRender
    requestRender?.mockClear()
    resolveProvider(provider)
    await flushPromises()

    expect(viewerInstances[0]?.terrainProvider).toBe(provider)
    expect(viewerInstances[0]?.scene.globe.enableLighting).toBe(true)
    expect(viewerInstances[0]?.scene.verticalExaggeration).toBe(1.5)
    expect(viewerInstances[0]?.camera.setView).toHaveBeenCalledExactlyOnceWith({
      destination: {
        longitude: 113.72,
        latitude: 23.61,
        height: 15_000,
      },
      orientation: {
        heading: 0,
        pitch: (-35 * Math.PI) / 180,
        roll: 0,
      },
    })
    expect(requestRender).toHaveBeenCalled()
    requestRender?.mockClear()
    tileLoadProgressListeners.forEach((listener) => listener())
    expect(requestRender).toHaveBeenCalled()
    expect(elevationTerrainProviderInstances).toEqual([provider])

    await wrapper.get('.feature-dialog--elevation .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(tileLoadProgressListeners).toHaveLength(0)

    wrapper.unmount()
  })

  it('opens a vector demo from its deep link and returns to the card anchor on close', async () => {
    const wrapper = await mountAt('/layers/vector/1-3-1-entity-point')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('1.3.1、entity点')
    expect(wrapper.get('[data-testid="vector-demo-globe"]').attributes('data-scene-id')).toBe(
      'entity-point',
    )
    expect(wrapper.get('[data-testid="vector-demo-globe"]').attributes('data-cesium-state')).toBe(
      'ready',
    )
    expect(viewerInstances[0]?.entities.values).toHaveLength(3)
    expect(wrapper.get('.vector-demo-globe__status').text()).toContain('Entity 点')

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/layers#entity-point')
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="vector-demo-globe"]').exists()).toBe(false)
    expect(getActiveSession()).toBeUndefined()

    wrapper.unmount()
  })

  it('opens a model demo from its deep link and returns to the card anchor on close', async () => {
    const wrapper = await mountAt('/layers/model/1-4-1-model-interpolation-motion')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('1.4.1、模型插值运动')
    expect(wrapper.get('[data-testid="model-demo-globe"]').attributes('data-scene-id')).toBe(
      'model-interpolation',
    )
    expect(wrapper.get('[data-testid="model-demo-globe"]').attributes('data-cesium-state')).toBe(
      'ready',
    )
    expect(viewerInstances[0]?.entities.values).toHaveLength(2)
    expect(
      viewerInstances[0]?.entities.values.find((entity) => entity.id === 'model-interpolation-demo')
        ?.model?.uri,
    ).toContain('cesium-air.glb')
    expect(wrapper.get('.model-demo-globe__status').text()).toContain('完整运动轨迹')

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/layers#model-interpolation')
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="model-demo-globe"]').exists()).toBe(false)
    expect(getActiveSession()).toBeUndefined()

    wrapper.unmount()
  })

  it('aborts a wind turbine scene that is closed while terrain is loading', async () => {
    let resolveTerrain!: (provider: CesiumTerrainProvider) => void
    cesiumMockState.cesiumTerrainProviderPromise = new Promise((resolve) => {
      resolveTerrain = resolve
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/layers/model/1-4-2-wind-turbine')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    const viewer = viewerInstances[0]!
    expect(viewer.entities.values).toHaveLength(0)

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    resolveTerrain(new CesiumTerrainProvider('https://data.mars3d.cn/terrain'))
    await flushPromises()

    expect(viewer.destroy).toHaveBeenCalledOnce()
    expect(viewer.entities.add).not.toHaveBeenCalled()
    expect(viewer.camera.setView).not.toHaveBeenCalled()
    expect(viewer.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="model-demo-globe"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('aborts a pending model scene when its active session is disposed', async () => {
    let resolveTerrain!: (provider: CesiumTerrainProvider) => void
    cesiumMockState.cesiumTerrainProviderPromise = new Promise((resolve) => {
      resolveTerrain = resolve
    })
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/layers/model/1-4-2-wind-turbine')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    const viewer = viewerInstances[0]!
    disposeActiveSession()
    await flushPromises()

    resolveTerrain(new CesiumTerrainProvider('https://data.mars3d.cn/terrain'))
    await flushPromises()

    expect(viewer.entities.add).not.toHaveBeenCalled()
    expect(viewer.camera.setView).not.toHaveBeenCalled()
    expect(viewer.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewer.scene.globe.depthTestAgainstTerrain).toBe(false)
    expect(consoleError).not.toHaveBeenCalled()

    wrapper.unmount()
  })

  it('keeps the normal globe and current camera when elevation loading fails', async () => {
    cesiumMockState.elevationProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/layers')

    await openElevation(wrapper)

    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewerInstances[0]?.camera.setView).not.toHaveBeenCalled()
    expect(viewerInstances[0]?.scene.globe.enableLighting).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('.feature-dialog--elevation').text()).not.toContain('加载失败')
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.feature-dialog--elevation .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('ignores elevation provider completion after the dialog closes', async () => {
    let resolveProvider!: (provider: ArcGISTiledElevationTerrainProvider) => void
    cesiumMockState.elevationProviderPromise = new Promise((resolve) => {
      resolveProvider = resolve
    })

    const wrapper = await mountAt('/layers')
    await openElevation(wrapper)

    await wrapper.get('.feature-dialog--elevation .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    resolveProvider(
      new ArcGISTiledElevationTerrainProvider(
        'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
      ),
    )
    await flushPromises()

    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.camera.setView).not.toHaveBeenCalled()
    expect(getActiveSession()).toBeUndefined()

    wrapper.unmount()
  })

  it('keeps at most one active viewer when another feature is opened', async () => {
    const wrapper = await mountAt('/layers')
    await openGlobe(wrapper)
    expect(getActiveSession()?.viewer).toBe(viewerInstances[0])

    await wrapper.get('[data-feature-id="elevation"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(2)
    })

    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(getActiveSession()?.viewer).toBe(viewerInstances[1])
    expect(wrapper.get('.feature-dialog--elevation').text()).toContain('高程')

    await wrapper.get('.feature-dialog--elevation .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[1]?.destroy).toHaveBeenCalledOnce()
    expect(getActiveSession()).toBeUndefined()

    wrapper.unmount()
  })

  it('keeps the application and globe dialog usable without a token', async () => {
    vi.stubEnv('VITE_TIANDITU_TOKEN', '   ')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/basic-config')

    await openGlobe(wrapper)

    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(viewerInstances).toHaveLength(1)
    expect(tileProviderInstances).toHaveLength(0)
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('destroys a partially initialized viewer when layer setup fails', async () => {
    cesiumMockState.failNextImageryLayer = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/basic-config')

    await openGlobe(wrapper)

    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(getActiveSession()).toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    wrapper.unmount()
  })

  it('marks the globe as failed when viewer initialization fails', async () => {
    cesiumMockState.failNextViewer = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/basic-config')

    await wrapper.get('[data-feature-id="tianditu"]').trigger('click')
    await flushPromises()

    const globe = wrapper.get('[data-testid="cesium-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('error')
    expect(globe.attributes('data-cesium-state')).not.toBe('ready')
    expect(getActiveSession()).toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    wrapper.unmount()
  })

  it('toggles fullscreen without rebuilding the viewer and destroys it on close', async () => {
    const wrapper = await mountAt('/basic-config')
    const card = wrapper.get('[data-testid="feature-card"]')
    await openGlobe(wrapper)

    expect(viewerInstances).toHaveLength(1)

    const fullscreenButton = wrapper.get('button[aria-label="全屏"]')
    expect(fullscreenButton.attributes('title')).toBe('全屏')
    expect(fullscreenButton.text()).toBe('')
    expect(fullscreenButton.find('svg').exists()).toBe(true)
    await fullscreenButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('.feature-dialog').classes()).toContain('is-fullscreen')
    expect(viewerInstances).toHaveLength(1)

    const exitFullscreenButton = wrapper.get('button[aria-label="退出全屏"]')
    expect(exitFullscreenButton.attributes('title')).toBe('退出全屏')
    await exitFullscreenButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('.feature-dialog').classes()).not.toContain('is-fullscreen')
    expect(viewerInstances).toHaveLength(1)

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="cesium-globe"]').exists()).toBe(false)

    await card.trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(2)
    })
    expect(viewerInstances[1]?.destroy).not.toHaveBeenCalled()

    await wrapper.get('.feature-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[1]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('keeps the menu selection in sync with the current route', async () => {
    const wrapper = await mountAt('/layers')
    const imageryMenuItem = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === '1.1、影像')

    expect(imageryMenuItem?.attributes('aria-current')).toBe('location')

    await router.push('/layers#spatial')
    await flushPromises()

    const spatialMenuItem = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === '2.1、空间分析')

    expect(spatialMenuItem?.attributes('aria-current')).toBe('location')
    expect(imageryMenuItem?.attributes('aria-current')).toBeUndefined()

    await router.push('/a-missing-page')
    await flushPromises()

    expect(
      wrapper.findAll('[role="menuitem"]').some((item) => item.attributes('aria-current')),
    ).toBe(false)

    wrapper.unmount()
  })

  it('updates the selected section and accordion group while content scrolls', async () => {
    const wrapper = await mountAt('/layers')
    const content = wrapper.get('main').element
    const positions = {
      imagery: -260,
      terrain: -160,
      vector: -60,
      model: 30,
      spatial: 40,
    }

    vi.spyOn(content, 'getBoundingClientRect').mockReturnValue({
      top: 0,
    } as DOMRect)
    const spies = Object.fromEntries(
      Object.keys(positions).map((anchor) => [
        anchor,
        vi
          .spyOn(
            wrapper.get(`[data-navigation-anchor="${anchor}"]`).element,
            'getBoundingClientRect',
          )
          .mockReturnValue({ top: positions[anchor as keyof typeof positions] } as DOMRect),
      ]),
    )

    await wrapper.get('main').trigger('scroll')
    frameCallbacks.splice(0).forEach((callback) => callback(0))
    await flushPromises()

    expect(
      wrapper
        .findAll('[role="menuitem"]')
        .find((item) => item.attributes('aria-current') === 'location')
        ?.text(),
    ).toBe('1.3、矢量')
    expect(wrapper.findAll('.el-sub-menu')[0]?.classes()).toContain('is-opened')
    expect(wrapper.findAll('.el-sub-menu')[1]?.classes()).not.toContain('is-opened')
    expect(router.currentRoute.value.fullPath).toBe('/layers')

    positions.imagery = -360
    positions.terrain = -260
    positions.vector = -160
    positions.model = -100
    positions.spatial = -60
    for (const [anchor, spy] of Object.entries(spies)) {
      spy.mockReturnValue({ top: positions[anchor as keyof typeof positions] } as DOMRect)
    }

    await wrapper.get('main').trigger('scroll')
    frameCallbacks.splice(0).forEach((callback) => callback(0))
    await flushPromises()

    expect(
      wrapper
        .findAll('[role="menuitem"]')
        .find((item) => item.attributes('aria-current') === 'location')
        ?.text(),
    ).toBe('2.1、空间分析')
    expect(wrapper.findAll('.el-sub-menu')[0]?.classes()).not.toContain('is-opened')
    expect(wrapper.findAll('.el-sub-menu')[1]?.classes()).toContain('is-opened')
    expect(router.currentRoute.value.fullPath).toBe('/layers')

    wrapper.unmount()
  })

  it('treats the removed effects route as an unknown address with the original URL preserved', async () => {
    const wrapper = await mountAt('/effects')

    expect(router.currentRoute.value.fullPath).toBe('/effects')
    expect(wrapper.get('h1').text()).toBe('页面不存在')
    expect(wrapper.find('[data-testid="showcase-view"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('opens the simple inundation demo from its deep link and returns to its card', async () => {
    const wrapper = await mountAt('/spatial-analysis/2-1-3-inundation-analysis-simple')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const dialog = wrapper.get('.feature-dialog--spatial')
    const globe = wrapper.get('[data-testid="spatial-demo-globe"]')
    expect(dialog.text()).toContain('2.1.3、淹没分析（简易）')
    expect(globe.attributes('data-scene-id')).toBe('inundation-analysis-simple')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.text()).toContain('1000 米')
    expect(viewerInstances[0]?.entities.values).toHaveLength(1)
    expect(viewerInstances[0]?.entities.values[0]?.polygon?.extrudedHeight).toBeDefined()

    await wrapper.get('.feature-dialog--spatial .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/layers#inundation-analysis-simple')
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="spatial-demo-globe"]').exists()).toBe(false)

    wrapper.unmount()
  })

  it('opens the sunlight demo with date and time controls that drive the scene clock', async () => {
    const wrapper = await mountAt('/spatial-analysis/2-1-6-sunlight-analysis')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const globe = wrapper.get('[data-testid="spatial-demo-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.text()).toContain('36 栋本地低多边形建筑')
    expect(globe.find('.spatial-demo-globe__sunlight-controls').exists()).toBe(true)
    expect(globe.find('input[aria-label="日照日期"]').exists()).toBe(true)
    expect(globe.find('input[aria-label="开始时间"]').exists()).toBe(true)
    expect(globe.find('input[aria-label="结束时间"]').exists()).toBe(true)
    expect(viewerInstances[0]?.scene.globe.enableLighting).toBe(true)

    await globe.get('button').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.clock.shouldAnimate).toBe(true)
    expect(globe.text()).toContain('日照模拟播放中')

    const buttons = globe.findAll('button')
    await buttons[1]?.trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.clock.shouldAnimate).toBe(false)
    expect(globe.text()).toContain('日照模拟已暂停')

    wrapper.unmount()
  })

  it('opens the animated water surface demo and renders a water primitive', async () => {
    const wrapper = await mountAt('/spatial-analysis/2-1-10-water-surface')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await flushPromises()

    const globe = wrapper.get('[data-testid="spatial-demo-globe"]')
    expect(globe.attributes('data-scene-id')).toBe('water-surface')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.text()).toContain('动态水域面')
    expect(primitiveInstances).toHaveLength(1)
    expect(viewerInstances[0]?.entities.values).toHaveLength(1)

    wrapper.unmount()
  })

  it('opens the aspect analysis demo with color cells, arrows and a legend', async () => {
    const wrapper = await mountAt('/spatial-analysis/2-1-13-aspect-analysis')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await vi.waitFor(() => {
      expect(primitiveInstances.length).toBeGreaterThan(0)
      expect(viewerInstances[0]?.entities.values.length).toBeGreaterThan(0)
    })
    await flushPromises()

    const globe = wrapper.get('[data-testid="spatial-demo-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.text()).toContain('30 × 30 网格')
    const legend = globe.get('[data-testid="aspect-legend"]')
    expect(legend.text()).toContain('坡向')
    expect(legend.text()).toContain('北')
    expect(legend.text()).toContain('西南')

    wrapper.unmount()
  })

  it('keeps the aspect scene operable when terrain loading falls back to the ellipsoid', async () => {
    cesiumMockState.cesiumTerrainProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/spatial-analysis/2-1-13-aspect-analysis')

    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(1)
    })
    await vi.waitFor(() => {
      expect(primitiveInstances.length).toBeGreaterThan(0)
    })
    await flushPromises()

    const globe = wrapper.get('[data-testid="spatial-demo-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('ready')
    expect(globe.text()).toContain('已回退椭球地形')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.feature-dialog--spatial .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('preserves an unknown URL and renders the 404 page inside the admin shell', async () => {
    const wrapper = await mountAt('/unknown/page?source=test')

    expect(router.currentRoute.value.fullPath).toBe('/unknown/page?source=test')
    expect(wrapper.text()).toContain('三维效果展示')
    expect(wrapper.text()).toContain('1、图层')
    expect(wrapper.get('h1').text()).toBe('页面不存在')

    const returnLink = wrapper.get('a[href="/layers"]')
    expect(returnLink.text()).toBe('返回图层列表')

    await returnLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/layers')
    expect(wrapper.get('[data-testid="feature-card"]').text()).toContain('1.1.1、天地图')

    wrapper.unmount()
  })

  it('navigates to an anchor from the sidebar menu on another route', async () => {
    const wrapper = await mountAt('/missing-route')
    const menuItem = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === '1.1、影像')

    await menuItem?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.fullPath).toBe('/layers#imagery')
    expect(wrapper.get('[data-testid="feature-card"]').text()).toContain('1.1.1、天地图')

    wrapper.unmount()
  })
})
