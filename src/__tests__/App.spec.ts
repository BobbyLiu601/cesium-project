import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'

import App from '../App.vue'
import { disposeActiveSession, getActiveSession } from '../components/cesiumGlobeSession'
import router from '../router'
import {
  cesiumMockState,
  resetCesiumMock,
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
  await wrapper.get('[data-testid="feature-card"]').trigger('click')
  await flushPromises()
  await vi.waitFor(() => {
    expect(viewerInstances).toHaveLength(1)
  })
  await flushPromises()
}

describe('App', () => {
  beforeAll(() => {
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: ResizeObserverMock,
    })
  })

  afterAll(() => {
    Reflect.deleteProperty(globalThis, 'ResizeObserver')
  })

  beforeEach(() => {
    disposeActiveSession()
    resetCesiumMock()
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

  it('shows the feature card as one accessible button without the legacy heading', async () => {
    const wrapper = await mountAt('/basic-config')
    const card = wrapper.get('[data-testid="feature-card"]')
    const image = card.get('img')

    expect(card.element.tagName).toBe('BUTTON')
    expect(card.attributes('type')).toBe('button')
    expect(card.findAll('div')).toHaveLength(0)
    expect(card.findAll('span')).toHaveLength(3)
    expect(card.attributes('aria-label')).toBe('打开三维地球')
    expect(card.text()).toContain('三维地球')
    expect(image.attributes('alt')).toBe('蓝色三维地球与环绕轨道示意图')
    expect(image.attributes('src')).not.toMatch(/^https?:\/\//)
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
    expect(wrapper.find('[data-testid="cesium-globe"]').exists()).toBe(true)
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
