import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { createPinia } from 'pinia'

import App from '../App.vue'
import router from '../router'

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
      plugins: [createPinia(), router, ElementPlus],
    },
  })

  await flushPromises()
  return wrapper
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

  it('redirects the root route to the basic configuration page', async () => {
    const wrapper = await mountAt('/')

    expect(router.currentRoute.value.fullPath).toBe('/basic-config')
    expect(wrapper.get('h1').text()).toBe('基础配置')
    expect(wrapper.text()).toContain('三维效果展示')
    expect(wrapper.text()).toContain('基础配置')

    wrapper.unmount()
  })

  it('shows the feature card with a local image and accessible alternative text', async () => {
    const wrapper = await mountAt('/basic-config')
    const card = wrapper.get('[data-testid="feature-card"]')
    const image = card.get('img')

    expect(card.element.tagName).toBe('ARTICLE')
    expect(card.text()).toContain('三维地球')
    expect(image.attributes('alt')).toBe('蓝色三维地球与环绕轨道示意图')
    expect(image.attributes('src')).not.toMatch(/^https?:\/\//)
    expect(card.element.querySelector('a, button')).toBeNull()

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
    expect(wrapper.get('h1').text()).toBe('基础配置')

    wrapper.unmount()
  })

  it('navigates to the basic configuration page from the sidebar menu', async () => {
    const wrapper = await mountAt('/missing-route')
    const menuItem = wrapper.findAll('[role="menuitem"]').find((item) => item.text() === '基础配置')

    await menuItem?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/basic-config')
    expect(wrapper.get('h1').text()).toBe('基础配置')

    wrapper.unmount()
  })
})
