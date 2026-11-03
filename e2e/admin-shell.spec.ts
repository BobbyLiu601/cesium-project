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

test('根路径进入基础配置并显示后台管理壳', async ({ page }) => {
  await page.goto('/')

  await expect(page).toHaveURL(/\/basic-config$/)
  await expect(page.getByText('三维效果展示', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '基础配置' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '基础配置' })).toHaveAttribute(
    'aria-current',
    'page',
  )
  await expect(page.getByRole('article')).toContainText('三维地球')
})

test('桌面端内容区独立滚动，顶部栏保持固定', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 420 })
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
  await expect(page.getByRole('heading', { level: 1, name: '基础配置' })).toBeVisible()
})
