import { expect, test } from '@playwright/test'

const responsiveViewports = [
  { width: 375, height: 812, name: '手机' },
  { width: 767, height: 900, name: '手机断点前' },
  { width: 768, height: 900, name: '平板断点起点' },
  { width: 900, height: 900, name: '平板' },
  { width: 1199, height: 900, name: '桌面断点前' },
  { width: 1200, height: 900, name: '桌面断点起点' },
  { width: 1440, height: 900, name: '桌面' },
]

test.beforeEach(async ({ page }) => {
  await page.route(/https:\/\/t\d\.tianditu\.gov\.cn\//, (route) => route.abort())
})

test('根路径进入基础配置并显示后台管理壳', async ({ page }) => {
  const cesiumRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('CesiumGlobe') || request.url().includes('/cesium/')) {
      cesiumRequests.push(request.url())
    }
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/basic-config$/)
  await expect(page.getByText('三维效果展示', { exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '基础配置' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('button', { name: '打开三维地球' })).toContainText('三维地球')
  await expect(page.getByText('展示能力', { exact: true })).toHaveCount(0)
  await expect(page.getByText('从统一入口浏览当前已准备的展示能力。', { exact: true })).toHaveCount(
    0,
  )
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(cesiumRequests).toHaveLength(0)
})

test('通过卡片图片或文字打开三维地球，并可全屏、退出全屏和关闭', async ({ page }) => {
  await page.goto('/basic-config')

  const card = page.getByRole('button', { name: '打开三维地球' })
  await card.locator('img').click()

  const dialog = page.getByRole('dialog', { name: '三维地球' })
  const dialogPanel = page.locator('.three-earth-dialog')
  const fullscreenButton = dialog.getByRole('button', { name: '全屏' })
  const closeButton = dialog.getByRole('button', { name: '关闭此对话框' })
  await expect(dialog).toBeVisible()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)
  await expect(dialog.getByTestId('cesium-globe')).toBeVisible()
  await expect(dialog.getByTestId('cesium-credit-container')).toBeHidden()
  await expect(dialog.locator('.cesium-viewer-bottom')).toBeHidden()
  await expect(closeButton).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: '关闭三维地球弹窗' })).toHaveCount(0)
  expect(await fullscreenButton.innerText()).toBe('')
  await expect(fullscreenButton.locator('svg')).toBeVisible()

  const titleBox = await dialog.locator('.three-earth-dialog__title').boundingBox()
  const fullscreenBox = await fullscreenButton.boundingBox()
  const closeBox = await closeButton.boundingBox()

  expect(titleBox).not.toBeNull()
  expect(fullscreenBox).not.toBeNull()
  expect(closeBox).not.toBeNull()
  expect(titleBox?.x).toBeLessThan(fullscreenBox?.x ?? 0)
  expect((fullscreenBox?.x ?? 0) + (fullscreenBox?.width ?? 0)).toBeLessThanOrEqual(
    (closeBox?.x ?? 0) + 1,
  )
  expect(
    Math.abs(
      (titleBox?.y ?? 0) +
        (titleBox?.height ?? 0) / 2 -
        ((closeBox?.y ?? 0) + (closeBox?.height ?? 0) / 2),
    ),
  ).toBeLessThan(3)

  await fullscreenButton.click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)

  const exitFullscreenButton = dialog.getByRole('button', { name: '退出全屏' })
  await expect(exitFullscreenButton).toHaveAttribute('title', '退出全屏')
  await exitFullscreenButton.click()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)

  await closeButton.click()
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()

  await card.getByText('三维地球', { exact: true }).click()
  await expect(dialog).toBeVisible()
  await expect(dialog.getByTestId('cesium-globe')).toBeVisible()
  expect(await dialog.evaluate((element) => element.isConnected)).toBe(true)
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
})

test('Cesium 异步加载失败时弹窗仍可关闭且不显示用户可见错误', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  await page.route('**/CesiumGlobe.vue*', (route) => route.abort())

  await page.goto('/basic-config')
  await page.getByRole('button', { name: '打开三维地球' }).click()

  const dialog = page.getByRole('dialog', { name: '三维地球' })
  const mapRegion = dialog.locator('.el-dialog__body')
  await expect(dialog).toBeVisible()
  await expect(mapRegion).toBeVisible()
  expect(await mapRegion.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(7, 17, 31)',
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(dialog).not.toContainText('加载失败')

  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
  await expect(dialog).toBeHidden()
  expect(consoleErrors.length).toBeGreaterThan(0)
})

test('通过 Enter 或空格打开三维地球弹窗', async ({ page }) => {
  await page.goto('/basic-config')

  const card = page.getByRole('button', { name: '打开三维地球' })
  const dialog = page.getByRole('dialog', { name: '三维地球' })

  await card.focus()
  await card.press('Enter')
  await expect(dialog).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()

  await card.focus()
  await card.press('Space')
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
})

test('窄屏下三维地球弹窗保持在视口内并可切换全屏', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/basic-config')

  await page.getByRole('button', { name: '打开三维地球' }).click()
  const dialog = page.getByRole('dialog', { name: '三维地球' })
  const dialogPanel = page.locator('.three-earth-dialog')
  await expect(dialog).toBeVisible()

  const box = await dialogPanel.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)
})

test('桌面端内容区独立滚动，顶部栏保持固定', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 240 })
  await page.goto('/basic-config')

  const header = page.getByRole('banner')
  const sidebar = page.getByRole('navigation', { name: '侧边导航' })
  const content = page.getByRole('main')
  const initialHeaderBox = await header.boundingBox()
  const initialSidebarBox = await sidebar.boundingBox()
  const scrollMetrics = await content.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))

  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight)

  await content.evaluate((element) => {
    element.scrollTop = 120
  })

  const headerAfterScroll = await header.boundingBox()
  const sidebarAfterScroll = await sidebar.boundingBox()
  expect(headerAfterScroll?.y).toBe(initialHeaderBox?.y)
  expect(sidebarAfterScroll?.y).toBe(initialSidebarBox?.y)
  expect(await content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
})

for (const viewport of responsiveViewports) {
  test(`${viewport.name}视口下功能卡片宽度符合响应式网格`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/basic-config')

    const measurements = await page.getByTestId('feature-grid').evaluate((grid) => {
      const card = grid.querySelector('[data-testid="feature-card"]')

      if (!(card instanceof HTMLElement)) {
        throw new Error('未找到功能卡片')
      }

      return {
        cardWidth: card.getBoundingClientRect().width,
        gridWidth: grid.getBoundingClientRect().width,
      }
    })

    const ratio = measurements.cardWidth / measurements.gridWidth

    if (viewport.width < 768) {
      expect(ratio).toBeGreaterThan(0.95)
    } else if (viewport.width < 1200) {
      expect(ratio).toBeGreaterThan(0.46)
      expect(ratio).toBeLessThan(0.52)
    } else {
      expect(ratio).toBeGreaterThan(0.3)
      expect(ratio).toBeLessThan(0.34)
    }
  })
}

test('移动端可通过按钮和键盘打开抽屉，并选择菜单关闭', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/basic-config')

  const openButton = page.getByRole('button', { name: '打开导航菜单' })
  await expect(openButton).toBeVisible()
  await openButton.focus()
  await openButton.press('Enter')

  const drawer = page.getByRole('dialog', { name: '后台导航' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('基础配置', { exact: true })).toBeVisible()

  const menuItem = drawer.getByRole('menuitem', { name: '基础配置' })
  await menuItem.focus()
  await menuItem.press('Enter')

  await expect(drawer).toBeHidden()
  await expect(page).toHaveURL(/\/basic-config$/)
})

test('移动端点击抽屉遮罩后自动关闭', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/basic-config')

  await page.getByRole('button', { name: '打开导航菜单' }).click()
  const drawer = page.getByRole('dialog', { name: '后台导航' })
  await expect(drawer).toBeVisible()

  await page.mouse.click(350, 200)

  await expect(drawer).toBeHidden()
})

test('未知地址保留原 URL，并在后台管理壳内返回基础配置', async ({ page }) => {
  await page.goto('/missing/page?source=playwright')

  await expect(page).toHaveURL('/missing/page?source=playwright')
  await expect(page.getByRole('heading', { level: 1, name: '页面不存在' })).toBeVisible()
  await expect(page.getByText('三维效果展示', { exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '基础配置' })).toBeVisible()

  await page.getByRole('link', { name: '返回基础配置' }).click()

  await expect(page).toHaveURL(/\/basic-config$/)
  await expect(page.getByRole('button', { name: '打开三维地球' })).toBeVisible()
})
