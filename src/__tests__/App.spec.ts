import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'

import App from '../App.vue'
import { disposeActiveSession, getActiveSession } from '../components/cesiumGlobeSession'
import router from '../router'
import {
  ArcGISTiledElevationTerrainProvider,
  cesiumMockState,
  elevationProviderRequests,
  elevationTerrainProviderInstances,
  EllipsoidTerrainProvider,
  groundPrimitiveInstances,
  imageryLayerInstances,
  materialInstances,
  primitiveInstances,
  resetCesiumMock,
  scenePrimitiveAdds,
  scenePrimitiveRemoves,
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
  await wrapper.get('[data-feature-id="three-dimensional-earth"]').trigger('click')
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

async function openRadar(wrapper: Awaited<ReturnType<typeof mountAt>>) {
  await wrapper.get('[data-feature-id="radar"]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => {
    expect(viewerInstances).toHaveLength(1)
  })
  await vi.waitFor(() => {
    expect(primitiveInstances.length).toBeGreaterThan(0)
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

  it('redirects the root route to the basic configuration page', async () => {
    const wrapper = await mountAt('/')

    expect(router.currentRoute.value.fullPath).toBe('/basic-config')
    expect(wrapper.text()).toContain('三维效果展示')
    expect(wrapper.text()).not.toContain('展示能力')
    expect(wrapper.text()).not.toContain('从统一入口浏览当前已准备的展示能力')

    wrapper.unmount()
  })

  it('shows both feature cards as accessible buttons in the requested order', async () => {
    const wrapper = await mountAt('/basic-config')
    const cards = wrapper.findAll('[data-testid="feature-card"]')

    expect(cards).toHaveLength(2)
    expect(cards.map((card) => card.attributes('data-feature-id'))).toEqual([
      'three-dimensional-earth',
      'elevation',
    ])

    for (const card of cards) {
      expect(card.element.tagName).toBe('BUTTON')
      expect(card.attributes('type')).toBe('button')
      expect(card.findAll('div')).toHaveLength(0)
      expect(card.findAll('span')).toHaveLength(3)
      expect(card.get('img').attributes('src')).not.toMatch(/^https?:\/\//)
    }

    expect(cards[0]?.attributes('aria-label')).toBe('打开三维地球')
    expect(cards[0]?.text()).toContain('三维地球')
    expect(cards[0]?.get('img').attributes('alt')).toBe('蓝色三维地球与环绕轨道示意图')
    expect(cards[1]?.attributes('aria-label')).toBe('打开高程')
    expect(cards[1]?.text()).toContain('高程')
    expect(cards[1]?.get('img').attributes('alt')).toBe('从化山地三维地形效果')
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('展示能力')
    expect(wrapper.text()).not.toContain('从统一入口浏览当前已准备的展示能力')
    expect(wrapper.get('.basic-config').text()).not.toContain('基础配置')

    wrapper.unmount()
  })

  it('opens a non-fullscreen globe dialog with both Tianditu WMTS layers', async () => {
    const wrapper = await mountAt('/basic-config')
    await openGlobe(wrapper)

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('三维地球')
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
    expect(wrapper.find('button[aria-label="关闭三维地球弹窗"]').exists()).toBe(false)

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

    await wrapper.get('.three-earth-dialog button[aria-label="关闭此对话框"]').trigger('click')
    await flushPromises()
    wrapper.unmount()
  })

  it('loads the elevation scene independently and applies terrain after the provider resolves', async () => {
    let resolveProvider!: (provider: ArcGISTiledElevationTerrainProvider) => void
    cesiumMockState.elevationProviderPromise = new Promise((resolve) => {
      resolveProvider = resolve
    })

    const wrapper = await mountAt('/basic-config')
    await openElevation(wrapper)

    const dialog = wrapper.get('.elevation-dialog')
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

    await wrapper.get('.elevation-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(tileLoadProgressListeners).toHaveLength(0)

    wrapper.unmount()
  })

  it('keeps the normal globe and current camera when elevation loading fails', async () => {
    cesiumMockState.elevationProviderOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/basic-config')

    await openElevation(wrapper)

    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.terrainProvider).toBeInstanceOf(EllipsoidTerrainProvider)
    expect(viewerInstances[0]?.camera.setView).not.toHaveBeenCalled()
    expect(viewerInstances[0]?.scene.globe.enableLighting).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('.elevation-dialog').text()).not.toContain('加载失败')
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.elevation-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('ignores elevation provider completion after the dialog closes', async () => {
    let resolveProvider!: (provider: ArcGISTiledElevationTerrainProvider) => void
    cesiumMockState.elevationProviderPromise = new Promise((resolve) => {
      resolveProvider = resolve
    })

    const wrapper = await mountAt('/basic-config')
    await openElevation(wrapper)

    await wrapper.get('.elevation-dialog .el-dialog__headerbtn').trigger('click')
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
    const wrapper = await mountAt('/basic-config')
    await openGlobe(wrapper)
    expect(getActiveSession()?.viewer).toBe(viewerInstances[0])

    await wrapper.get('[data-feature-id="elevation"]').trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(2)
    })

    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(getActiveSession()?.viewer).toBe(viewerInstances[1])
    expect(wrapper.get('.elevation-dialog').text()).toContain('高程')

    await wrapper.get('.elevation-dialog .el-dialog__headerbtn').trigger('click')
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

    await wrapper.get('.three-earth-dialog .el-dialog__headerbtn').trigger('click')
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

    await wrapper.get('.three-earth-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    wrapper.unmount()
  })

  it('marks the globe as failed when viewer initialization fails', async () => {
    cesiumMockState.failNextViewer = true
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/basic-config')

    await wrapper.get('[data-feature-id="three-dimensional-earth"]').trigger('click')
    await flushPromises()

    const globe = wrapper.get('[data-testid="cesium-globe"]')
    expect(globe.attributes('data-cesium-state')).toBe('error')
    expect(globe.attributes('data-cesium-state')).not.toBe('ready')
    expect(getActiveSession()).toBeUndefined()
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.three-earth-dialog .el-dialog__headerbtn').trigger('click')
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

    expect(wrapper.get('.three-earth-dialog').classes()).toContain('is-fullscreen')
    expect(viewerInstances).toHaveLength(1)

    const exitFullscreenButton = wrapper.get('button[aria-label="退出全屏"]')
    expect(exitFullscreenButton.attributes('title')).toBe('退出全屏')
    await exitFullscreenButton.trigger('click')
    await flushPromises()

    expect(wrapper.get('.three-earth-dialog').classes()).not.toContain('is-fullscreen')
    expect(viewerInstances).toHaveLength(1)

    await wrapper.get('.three-earth-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(wrapper.find('[data-testid="cesium-globe"]').exists()).toBe(false)

    await card.trigger('click')
    await flushPromises()
    await vi.waitFor(() => {
      expect(viewerInstances).toHaveLength(2)
    })
    expect(viewerInstances[1]?.destroy).not.toHaveBeenCalled()

    await wrapper.get('.three-earth-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[1]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('keeps the menu selection in sync with the current route', async () => {
    const wrapper = await mountAt('/basic-config')
    const activeMenuItem = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === '基础配置')

    expect(activeMenuItem?.attributes('aria-current')).toBe('page')

    await router.push('/a-missing-page')
    await flushPromises()

    const menuItemAfterNavigation = wrapper
      .findAll('[role="menuitem"]')
      .find((item) => item.text() === '基础配置')

    expect(menuItemAfterNavigation?.attributes('aria-current')).toBeUndefined()

    wrapper.unmount()
  })

  it('shows the visual effects menu and radar card on the effects page', async () => {
    const wrapper = await mountAt('/effects')
    const menuItem = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === '视觉效果')

    expect(menuItem?.attributes('aria-current')).toBe('page')
    expect(wrapper.find('[data-testid="effects-view"]').exists()).toBe(true)

    const cards = wrapper.findAll('[data-testid="feature-card"]')
    expect(cards).toHaveLength(1)
    expect(cards[0]?.attributes('data-feature-id')).toBe('radar')
    expect(cards[0]?.attributes('aria-label')).toBe('打开雷达图')
    expect(cards[0]?.text()).toContain('雷达图')
    expect(cards[0]?.get('img').attributes('src')).not.toMatch(/^https?:\/\//)
    expect(cards[0]?.get('img').attributes('alt')).toBe('广州海珠区三维雷达扫描效果截图')

    wrapper.unmount()
  })

  it('opens a live radar scene with a ground sweep and 3d dome', async () => {
    const wrapper = await mountAt('/effects')
    const now = vi.spyOn(performance, 'now').mockReturnValue(1_000)

    await openRadar(wrapper)

    const dialog = wrapper.get('.radar-dialog')
    expect(dialog.text()).toContain('雷达图')
    expect(dialog.classes()).not.toContain('is-fullscreen')
    expect(wrapper.get('[data-testid="radar-globe"]').attributes('data-cesium-state')).toBe('ready')
    expect(viewerInstances).toHaveLength(1)
    expect(viewerInstances[0]?.camera.lookAt).toHaveBeenCalledOnce()
    expect(viewerInstances[0]?.camera.lookAtTransform).toHaveBeenCalledOnce()
    expect(imageryLayerInstances).toHaveLength(2)
    expect(imageryLayerInstances[1]?.alpha).toBe(0.5)

    expect(groundPrimitiveInstances).toHaveLength(1)
    expect(primitiveInstances).toHaveLength(1)
    expect(scenePrimitiveAdds).toHaveLength(2)
    expect(materialInstances.map((material) => material.options.fabric.type)).toEqual([
      'RadarGroundSweep',
      'RadarDomeSweep',
    ])
    expect(frameCallbacks).toHaveLength(1)

    now.mockReturnValue(5_000)
    frameCallbacks[0]?.(0)
    expect(materialInstances[0]?.uniforms.time).toBeCloseTo(0.5)
    expect(materialInstances[1]?.uniforms.time).toBeCloseTo(0.5)
    expect(viewerInstances[0]?.scene.requestRender).toHaveBeenCalled()

    await wrapper.get('.radar-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()

    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()
    expect(scenePrimitiveRemoves).toHaveLength(2)
    expect(cancelAnimationFrame).toHaveBeenCalled()

    wrapper.unmount()
  })

  it('silently falls back to a fixed-height radar disc when ground materials are unsupported', async () => {
    cesiumMockState.groundMaterialsSupported = false
    const wrapper = await mountAt('/effects')

    await openRadar(wrapper)

    expect(groundPrimitiveInstances).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(2)
    expect(wrapper.get('[data-testid="radar-globe"]').attributes('data-cesium-state')).toBe('ready')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('.radar-dialog').text()).not.toContain('不支持')

    await wrapper.get('.radar-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('silently falls back to a fixed-height radar disc when terrain heights fail to initialize', async () => {
    cesiumMockState.groundTerrainHeightsOutcome = 'failure'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const wrapper = await mountAt('/effects')

    await openRadar(wrapper)

    expect(groundPrimitiveInstances).toHaveLength(0)
    expect(primitiveInstances).toHaveLength(2)
    expect(wrapper.get('[data-testid="radar-globe"]').attributes('data-cesium-state')).toBe('ready')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.get('.radar-dialog').text()).not.toContain('加载失败')
    expect(consoleError).toHaveBeenCalled()

    await wrapper.get('.radar-dialog .el-dialog__headerbtn').trigger('click')
    await flushPromises()
    expect(viewerInstances[0]?.destroy).toHaveBeenCalledOnce()

    wrapper.unmount()
  })

  it('preserves an unknown URL and renders the 404 page inside the admin shell', async () => {
    const wrapper = await mountAt('/unknown/page?source=test')

    expect(router.currentRoute.value.fullPath).toBe('/unknown/page?source=test')
    expect(wrapper.text()).toContain('三维效果展示')
    expect(wrapper.text()).toContain('基础配置')
    expect(wrapper.get('h1').text()).toBe('页面不存在')

    const returnLink = wrapper.get('a[href="/basic-config"]')
    expect(returnLink.text()).toBe('返回基础配置')

    await returnLink.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/basic-config')
    expect(wrapper.get('[data-testid="feature-card"]').text()).toContain('三维地球')

    wrapper.unmount()
  })

  it('navigates to the basic configuration page from the sidebar menu', async () => {
    const wrapper = await mountAt('/missing-route')
    const menuItem = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === '基础配置')

    await menuItem?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/basic-config')
    expect(wrapper.get('[data-testid="feature-card"]').text()).toContain('三维地球')

    wrapper.unmount()
  })
})
