import { expect, test, type Locator, type Page } from '@playwright/test'

const CESIUM_READY_TIMEOUT = 15_000

async function expectCesiumReady(globe: Locator) {
  await expect(globe).toHaveAttribute('data-cesium-state', 'ready', {
    timeout: CESIUM_READY_TIMEOUT,
  })
}

async function expectCanvasToAnimate(page: Page, canvas: Locator) {
  const clip = await canvas.boundingBox()
  expect(clip).not.toBeNull()

  const frames: Buffer[] = []
  for (let index = 0; index < 6; index += 1) {
    frames.push(await page.screenshot({ clip: clip! }))
    if (index < 5) {
      await page.waitForTimeout(150)
    }
  }

  expect(frames.some((frame) => !frame.equals(frames[0]!))).toBe(true)
}

async function expectSubmenuArrowsPointDown(menu: Locator) {
  const arrows = menu.locator('.sidebar-menu__group > .el-sub-menu__title .el-sub-menu__icon-arrow')
  await expect(arrows).toHaveCount(2)
  await expect
    .poll(() =>
      arrows.evaluateAll((elements) =>
        elements.map((element) => getComputedStyle(element).transform),
      ),
    )
    .toEqual(['none', 'none'])
}

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
  await page.route(/https:\/\/elevation3d\.arcgis\.com\//, (route) => route.abort())
  await page.route(/https:\/\/webrd\d+\.is\.autonavi\.com\//, (route) =>
    route.fulfill({
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
        'base64',
      ),
      contentType: 'image/png',
      status: 200,
    }),
  )
})

test('根路径进入图层目录并显示后台管理壳', async ({ page }) => {
  const cesiumRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('CesiumGlobe') || request.url().includes('/cesium/')) {
      cesiumRequests.push(request.url())
    }
  })

  await page.goto('/')

  await expect(page).toHaveURL(/\/layers$/)
  await expect(page.getByText('三维效果展示', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { level: 1, name: '1、图层' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '1.1、影像' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '1.2、地形' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '1.3、矢量' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '视觉效果' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '1.1、影像' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page.getByRole('menuitem', { name: '1.3.1、entity点' })).toHaveCount(0)
  await expectSubmenuArrowsPointDown(page.locator('.admin-sidebar'))
  await expect(page.getByRole('button', { name: '打开1.1.1、天地图' })).toContainText(
    '1.1.1、天地图',
  )
  await expect(
    page.getByRole('button', { name: '打开1.1.1、天地图' }).locator('img'),
  ).toHaveAttribute('src', /tianditu-cover/)
  await expect(page.getByRole('button', { name: '打开1.1.2、高德地图' })).toContainText(
    '1.1.2、高德地图',
  )
  await expect(
    page.getByRole('button', { name: '打开1.1.2、高德地图' }).locator('img'),
  ).toHaveAttribute('src', /amap-cover/)
  await expect(page.getByRole('button', { name: '打开1.2.1、高程' })).toContainText('1.2.1、高程')
  await expect(page.getByRole('button', { name: '打开1.3.1、entity点' })).toContainText(
    '1.3.1、entity点',
  )
  await expect(page.getByRole('button', { name: '打开1.3.16、gif' })).toContainText('1.3.16、gif')
  await expect(page.getByRole('button', { name: '打开雷达图' })).toContainText('雷达图')
  await expect(page.getByTestId('feature-card')).toHaveCount(20)
  expect(
    await page
      .getByTestId('feature-card')
      .evaluateAll((cards) => cards.map((card) => card.getAttribute('data-feature-id'))),
  ).toEqual([
    'tianditu',
    'amap',
    'elevation',
    'entity-point',
    'entity-line',
    'entity-polygon',
    'billboard',
    'billboard-collection',
    'popup',
    'geojson',
    'primitive',
    'all-primitive',
    'entity-collection',
    'entity-operation',
    'html-overlay',
    'click-popup',
    'road',
    'svg',
    'gif',
    'radar',
  ])
  await expect(page.getByText('展示能力', { exact: true })).toHaveCount(0)
  await expect(page.getByText('从统一入口浏览当前已准备的展示能力。', { exact: true })).toHaveCount(
    0,
  )
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(cesiumRequests).toHaveLength(0)
})

test('桌面端后台壳采用 Cesium Examples 视觉布局', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/layers')

  const header = page.getByRole('banner')
  const sidebar = page.getByRole('navigation', { name: '侧边导航' })
  const brand = page.getByText('三维效果展示', { exact: true })
  const heading = page.getByTestId('page-heading').first()

  const headerBox = await header.boundingBox()
  const sidebarBox = await sidebar.boundingBox()
  const brandBox = await brand.boundingBox()
  const brandStyle = await brand.evaluate((element) => {
    const style = getComputedStyle(element)
    return {
      backgroundColor: style.backgroundColor,
      backgroundClip: style.backgroundClip,
      backgroundImage: style.backgroundImage,
      color: style.color,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
    }
  })
  const menuHighlight = await sidebar.evaluate((element) => {
    const activeGroup = element.querySelector<HTMLElement>(
      '.el-sub-menu.is-active > .el-sub-menu__title',
    )
    const activeGroupIcon = activeGroup?.querySelector<HTMLElement>('.sidebar-menu__icon')
    const activeItem = element.querySelector<HTMLElement>('.el-menu-item.is-active')
    const activeItemLabel = activeItem?.querySelector<HTMLElement>('.sidebar-menu__label')

    if (!activeGroup || !activeGroupIcon || !activeItem || !activeItemLabel) {
      throw new Error('未找到菜单高亮元素')
    }

    return {
      activeGroupColor: getComputedStyle(activeGroup).color,
      activeGroupIconColor: getComputedStyle(activeGroupIcon).color,
      activeItemColor: getComputedStyle(activeItem).color,
      activeItemLabelColor: getComputedStyle(activeItemLabel).color,
    }
  })

  expect(headerBox?.height).toBeCloseTo(72, 0)
  expect(sidebarBox?.width).toBeCloseTo(230, 0)
  expect(brandBox?.x).toBeGreaterThanOrEqual(20)
  expect(brandBox?.x).toBeLessThanOrEqual(28)
  expect(brandStyle.fontSize).toBe('32px')
  expect(brandStyle.fontWeight).toBe('700')
  expect(brandStyle.color).toBe('rgba(0, 0, 0, 0)')
  expect(brandStyle.backgroundImage).toContain('linear-gradient')
  expect(brandStyle.backgroundClip).toBe('text')
  expect(menuHighlight.activeGroupColor).toBe('rgb(224, 76, 64)')
  expect(menuHighlight.activeGroupIconColor).toBe('rgb(224, 76, 64)')
  expect(menuHighlight.activeItemColor).toBe('rgb(232, 238, 246)')
  expect(menuHighlight.activeItemLabelColor).toBe('rgb(224, 76, 64)')
  await expect(page.locator('.sidebar-menu__marker')).toHaveCount(0)

  const hoveredMenuItem = sidebar.getByRole('menuitem', { name: '1.2、地形' })
  await hoveredMenuItem.hover()
  await expect(hoveredMenuItem).toHaveCSS('background-color', 'rgba(255, 72, 62, 0.04)')
  await expect(hoveredMenuItem).toHaveCSS('border-left-color', 'rgb(224, 76, 64)')
  await expect(hoveredMenuItem.locator('.sidebar-menu__label')).toHaveCSS(
    'color',
    'rgb(224, 76, 64)',
  )

  await expect(header.getByRole('menuitem')).toHaveCount(0)
  await expect(heading.getByRole('heading', { level: 1, name: '1、图层' })).toBeVisible()

  const layout = await page.evaluate(() => {
    const headerElement = document.querySelector('header')
    const sidebarElement = document.querySelector('aside')
    const contentElement = document.querySelector('main')
    const pageHeadingElement = document.querySelector('.page-heading')
    const pageHeadingTitle = document.querySelector('.page-heading__title')
    const bodyPanel = document.querySelector('.showcase__body')
    const cardElement = document.querySelector('[data-feature-id="tianditu"]')
    const cardHeading = cardElement?.querySelector('.feature-card__heading')
    const cardMedia = cardElement?.querySelector('.feature-card__media')

    if (
      !headerElement ||
      !sidebarElement ||
      !contentElement ||
      !pageHeadingElement ||
      !pageHeadingTitle ||
      !bodyPanel ||
      !cardElement ||
      !cardMedia
    ) {
      throw new Error('未找到后台布局元素')
    }

    const cardMediaBox = cardMedia.getBoundingClientRect()

    return {
      headerBackground: getComputedStyle(headerElement).backgroundColor,
      sidebarBackground: getComputedStyle(sidebarElement).backgroundColor,
      contentBackground: getComputedStyle(contentElement).backgroundColor,
      pageHeadingBackground: getComputedStyle(pageHeadingElement).backgroundColor,
      pageHeadingTitleColor: getComputedStyle(pageHeadingTitle).color,
      pageHeadingTitleFontSize: getComputedStyle(pageHeadingTitle).fontSize,
      pageHeadingTitleFontWeight: getComputedStyle(pageHeadingTitle).fontWeight,
      bodyPanelBackground: getComputedStyle(bodyPanel).backgroundColor,
      cardRadius: getComputedStyle(cardElement).borderRadius,
      cardShadow: getComputedStyle(cardElement).boxShadow,
      cardMediaAspectRatio: cardMediaBox.width / cardMediaBox.height,
      headingTop: cardHeading?.getBoundingClientRect().top ?? 0,
      mediaTop: cardMediaBox.top,
    }
  })

  expect(layout.headerBackground).toBe(layout.sidebarBackground)
  expect(layout.headerBackground).toBe('rgb(23, 40, 62)')
  expect(layout.contentBackground).toBe('rgb(245, 246, 246)')
  expect(layout.pageHeadingBackground).toBe('rgba(0, 0, 0, 0)')
  expect(layout.pageHeadingTitleColor).toBe('rgb(85, 85, 85)')
  expect(layout.pageHeadingTitleFontSize).toBe('24px')
  expect(layout.pageHeadingTitleFontWeight).toBe('500')
  expect(layout.bodyPanelBackground).toBe('rgb(249, 249, 249)')
  expect(layout.cardRadius).toBe('2px')
  expect(layout.cardShadow).not.toBe('none')
  expect(layout.cardMediaAspectRatio).toBeCloseTo(4 / 3, 2)
  expect(layout.headingTop).toBeLessThan(layout.mediaTop)

  const hoveredCard = page.getByRole('button', { name: '打开1.1.1、天地图' })
  await hoveredCard.hover()
  await expect
    .poll(() =>
      hoveredCard.evaluate((element) => {
        const style = getComputedStyle(element)
        return {
          transform: style.transform,
          zIndex: style.zIndex,
          boxShadow: style.boxShadow,
        }
      }),
    )
    .toEqual({
      transform: 'matrix(1.1, 0, 0, 1.1, 0, 0)',
      zIndex: '100',
      boxShadow: 'rgba(150, 150, 150, 0.6) 1px 1px 6px 0px',
    })
})

test('通过卡片图片或文字打开天地图，并可全屏、退出全屏和关闭', async ({ page }) => {
  await page.goto('/layers')

  const card = page.getByRole('button', { name: '打开1.1.1、天地图' })
  await card.locator('img').click()

  const dialog = page.getByRole('dialog', { name: '1.1.1、天地图' })
  const dialogPanel = page.locator('.feature-dialog--tianditu')
  const fullscreenButton = dialog.getByRole('button', { name: '全屏' })
  const closeButton = dialog.getByRole('button', { name: '关闭此对话框' })
  await expect(dialog).toBeVisible()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)
  const globe = dialog.getByTestId('cesium-globe')
  await expectCesiumReady(globe)
  await expect(globe).toBeVisible()
  await expect(dialog.getByTestId('cesium-credit-container')).toBeHidden()
  await expect(dialog.locator('.cesium-viewer-bottom')).toBeHidden()
  await expect(closeButton).toHaveCount(1)
  await expect(dialog.getByRole('button', { name: '关闭天地图弹窗' })).toHaveCount(0)
  expect(await fullscreenButton.innerText()).toBe('')
  await expect(fullscreenButton.locator('svg')).toBeVisible()

  const titleBox = await dialog.locator('.feature-dialog__title').boundingBox()
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

  await card.getByText('1.1.1、天地图', { exact: true }).click()
  await expect(dialog).toBeVisible()
  await expectCesiumReady(dialog.getByTestId('cesium-globe'))
  expect(await dialog.evaluate((element) => element.isConnected)).toBe(true)
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
})

test('1.1.2 高德地图使用 Cesium 标准矢量底图并显示来源标识', async ({ page }) => {
  const tileRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('.is.autonavi.com/appmaptile')) {
      tileRequests.push(request.url())
    }
  })

  await page.goto('/layers/imagery/1-1-2-amap')

  const dialog = page.getByRole('dialog', { name: '1.1.2、高德地图' })
  const globe = dialog.getByTestId('cesium-globe')
  await expect(dialog).toBeVisible()
  await expectCesiumReady(globe)
  await expect(globe).toHaveAttribute('data-imagery-source', 'amap')
  await expect(globe.locator('canvas')).toBeVisible()
  await expect(globe.getByTestId('amap-attribution')).toHaveText('© 高德地图')
  await expect.poll(() => tileRequests.some((url) => url.includes('style=8'))).toBe(true)

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(page.locator('.feature-dialog--amap')).toHaveClass(/is-fullscreen/)
  await dialog.getByRole('button', { name: '退出全屏' }).click()
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()

  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/layers#amap$/)
  await expect(page.getByRole('button', { name: '打开1.1.2、高德地图' })).toBeFocused()
})

test('Cesium 异步加载失败时弹窗显示降级状态且仍可关闭', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  await page.route('**/CesiumGlobe.vue*', (route) => route.abort())

  await page.goto('/layers')
  await page.getByRole('button', { name: '打开1.1.1、天地图' }).click()

  const dialog = page.getByRole('dialog', { name: '1.1.1、天地图' })
  const mapRegion = dialog.locator('.feature-dialog__stage')
  await expect(dialog).toBeVisible()
  await expect(mapRegion).toBeVisible()
  expect(await mapRegion.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(7, 17, 31)',
  )
  await expect(dialog.getByRole('alert')).toBeVisible()
  await expect(dialog).toContainText('示例场景加载失败')

  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
  await expect(dialog).toBeHidden()
  expect(consoleErrors.length).toBeGreaterThan(0)
})

test('矢量示例深链直接打开 entity点 并可执行交互和关闭', async ({ page }) => {
  await page.goto('/layers/vector/1-3-1-entity-point')

  const dialog = page.getByRole('dialog', { name: '1.3.1、entity点' })
  const dialogPanel = page.locator('.feature-dialog--vector')
  const globe = dialog.getByTestId('vector-demo-globe')
  await expect(dialog).toBeVisible()
  await expect(globe).toHaveAttribute('data-scene-id', 'entity-point', {
    timeout: CESIUM_READY_TIMEOUT,
  })
  await expectCesiumReady(globe)
  await expect(globe.locator('canvas')).toBeVisible()
  await expect(globe.getByText('已展示贴地、空中和高远三种 Entity 点')).toBeVisible()

  await dialog.getByRole('button', { name: '添加自动高度点' }).click()
  await expect(globe.getByText(/已按地形高度/)).toBeVisible()

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)
  await dialog.getByRole('button', { name: '退出全屏' }).click()
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()

  await expect(dialog).toBeHidden()
  await expect(page).toHaveURL(/\/layers#entity-point$/)
  await expect(page.getByRole('button', { name: '打开1.3.1、entity点' })).toBeFocused()
})

test('矢量示例修订项可稳定复现', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1440, height: 900 })
  const appearanceErrors: string[] = []
  const pageErrors: string[] = []

  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Appearance|Geometry mismatch|geometry instances/i.test(message.text())
    ) {
      appearanceErrors.push(message.text())
    }
  })
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/layers')
  await expect(page.getByRole('menuitem', { name: '1.1、影像' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '1.2、地形' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '1.3、矢量' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '1.3.1、entity点' })).toHaveCount(0)

  await page.goto('/layers/vector/1-3-8-primitive')
  let globe = page.getByTestId('vector-demo-globe')
  await expectCesiumReady(globe)
  await page.waitForTimeout(1_200)
  expect(appearanceErrors).toEqual([])
  expect(pageErrors).toEqual([])

  await page.goto('/layers/vector/1-3-12-html-overlay')
  globe = page.getByTestId('vector-demo-globe')
  await expectCesiumReady(globe)
  const htmlOverlay = globe.locator('[data-demo-overlay]')
  await expect(htmlOverlay).toBeVisible()
  await expect(htmlOverlay).toContainText('气泡窗口')

  await page.goto('/layers/vector/1-3-13-click-popup')
  globe = page.getByTestId('vector-demo-globe')
  await expectCesiumReady(globe)
  await page.waitForTimeout(2_600)
  const canvas = globe.locator('canvas')
  const canvasScreenshot = await canvas.screenshot()
  const markerPoints = await page.evaluate(async (imageBase64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${imageBase64}`
    await image.decode()

    const copy = document.createElement('canvas')
    copy.width = image.naturalWidth
    copy.height = image.naturalHeight
    const context = copy.getContext('2d')
    if (!context) {
      return []
    }

    context.drawImage(image, 0, 0)
    const { data, width, height } = context.getImageData(0, 0, copy.width, copy.height)
    const clusters = [
      { minX: width, minY: height, maxX: -1, maxY: -1, count: 0 },
      { minX: width, minY: height, maxX: -1, maxY: -1, count: 0 },
    ]

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4
        const red = data[offset] ?? 0
        const green = data[offset + 1] ?? 0
        const blue = data[offset + 2] ?? 0
        const alpha = data[offset + 3] ?? 0
        if (alpha > 200 && red > 170 && green < 120 && blue < 130) {
          const cluster = clusters[y < height / 2 ? 0 : 1]
          cluster.minX = Math.min(cluster.minX, x)
          cluster.minY = Math.min(cluster.minY, y)
          cluster.maxX = Math.max(cluster.maxX, x)
          cluster.maxY = Math.max(cluster.maxY, y)
          cluster.count += 1
        }
      }
    }

    const canvasBounds = document
      .querySelector('[data-testid="vector-demo-globe"] canvas')
      ?.getBoundingClientRect()
    if (!canvasBounds) {
      return []
    }

    return clusters
      .filter((cluster) => cluster.count > 20)
      .map((cluster) => ({
        x: (canvasBounds.width / width) * ((cluster.minX + cluster.maxX) / 2),
        y: (canvasBounds.height / height) * ((cluster.minY + cluster.maxY) / 2),
      }))
  }, canvasScreenshot.toString('base64'))

  expect(markerPoints.length).toBeGreaterThanOrEqual(2)
  const firstMarker = markerPoints[0]!
  await canvas.click({ position: firstMarker })
  const clickOverlay = globe.locator('[data-demo-overlay]')
  await expect(clickOverlay).toBeVisible()
  await expect(clickOverlay).toContainText(/设备 [AB]/)
  await clickOverlay.locator('[data-popup-close]').click()
  await expect(clickOverlay).toBeHidden()

  await page.goto('/layers/vector/1-3-16-gif')
  globe = page.getByTestId('vector-demo-globe')
  await expectCesiumReady(globe)
  await page.waitForTimeout(2_600)
  const gifCanvas = globe.locator('canvas')
  await expectCanvasToAnimate(page, gifCanvas)
})

test('GIF 在不支持 ImageDecoder 时仍使用原生图片动画', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(globalThis, 'ImageDecoder', {
      configurable: true,
      value: undefined,
    })
  })
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/layers/vector/1-3-16-gif')

  const globe = page.getByTestId('vector-demo-globe')
  await expectCesiumReady(globe)
  await expect(globe.getByText('当前浏览器使用原生 GIF 动画播放')).toBeVisible()
  const nativeGif = globe.locator('img[data-demo-gif]')
  await expect(nativeGif).toBeVisible()
  await expect(nativeGif).toHaveCSS('filter', 'none')

  await expectCanvasToAnimate(page, globe.locator('canvas'))
})

test('通过 Enter 或空格打开天地图弹窗', async ({ page }) => {
  await page.goto('/layers')

  const card = page.getByRole('button', { name: '打开1.1.1、天地图' })
  const dialog = page.getByRole('dialog', { name: '1.1.1、天地图' })

  await card.focus()
  await card.press('Enter')
  await expect(dialog).toBeVisible()
  await expectCesiumReady(dialog.getByTestId('cesium-globe'))
  await page.keyboard.press('Escape')
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()

  await card.focus()
  await card.press('Space')
  await expect(dialog).toBeVisible()
  await expectCesiumReady(dialog.getByTestId('cesium-globe'))
  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
})

test('窄屏下天地图弹窗保持在视口内并可切换全屏', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/layers')

  await page.getByRole('button', { name: '打开1.1.1、天地图' }).click()
  const dialog = page.getByRole('dialog', { name: '1.1.1、天地图' })
  const dialogPanel = page.locator('.feature-dialog--tianditu')
  await expect(dialog).toBeVisible()
  await expectCesiumReady(dialog.getByTestId('cesium-globe'))

  const box = await dialogPanel.boundingBox()
  expect(box).not.toBeNull()
  expect(box?.x).toBeGreaterThanOrEqual(0)
  expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(375)

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)
})

test('桌面端内容区独立滚动，顶部栏保持固定', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 240 })
  await page.goto('/layers')

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

test('内容区滚动联动区块选中态与互斥展开菜单', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 600 })
  await page.goto('/layers')

  const content = page.getByRole('main')
  const sidebar = page.locator('.admin-sidebar')
  const layersGroup = sidebar.locator('.sidebar-menu__group').nth(0)
  const effectsGroup = sidebar.locator('.sidebar-menu__group').nth(1)

  await expect(layersGroup).toHaveClass(/is-opened/)
  await expect(effectsGroup).not.toHaveClass(/is-opened/)

  await content.evaluate((element) => {
    const target = document.querySelector<HTMLElement>('[data-navigation-anchor="vector"]')
    if (!target) {
      throw new Error('未找到矢量区块')
    }
    element.scrollTop += target.getBoundingClientRect().top - element.getBoundingClientRect().top
  })

  await expect(page.getByRole('menuitem', { name: '1.3、矢量' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page).toHaveURL(/\/layers$/)
  await expect(layersGroup).toHaveClass(/is-opened/)

  await content.evaluate((element) => {
    element.scrollTop = element.scrollHeight
  })

  await expect(page.getByRole('menuitem', { name: '雷达图' })).toHaveAttribute(
    'aria-current',
    'location',
  )
  await expect(page).toHaveURL(/\/layers$/)
  await expect(layersGroup).not.toHaveClass(/is-opened/)
  await expect(effectsGroup).toHaveClass(/is-opened/)

  await sidebar.locator('.sidebar-menu__group').nth(0).locator('.el-sub-menu__title').click()
  await expect(layersGroup).toHaveClass(/is-opened/)
  await expect(effectsGroup).not.toHaveClass(/is-opened/)
})

for (const viewport of responsiveViewports) {
  test(`${viewport.name}视口下功能卡片宽度符合响应式网格`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/layers')

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
    } else if (viewport.width < 1440) {
      expect(ratio).toBeGreaterThan(0.2)
      expect(ratio).toBeLessThan(0.26)
    } else {
      expect(ratio).toBeGreaterThan(0.14)
      expect(ratio).toBeLessThan(0.17)
    }
  })
}

test('移动端可通过按钮和键盘打开抽屉，并选择菜单关闭', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/layers')

  const openButton = page.getByRole('button', { name: '打开导航菜单' })
  await expect(openButton).toBeVisible()
  const headerBox = await page.getByRole('banner').boundingBox()
  expect(headerBox?.height).toBeCloseTo(60, 0)
  await openButton.focus()
  await openButton.press('Enter')

  const drawer = page.getByRole('dialog', { name: '后台导航' })
  await expect(drawer).toBeVisible()
  await expect(drawer.getByText('1、图层', { exact: true })).toBeVisible()
  await expectSubmenuArrowsPointDown(drawer)

  const menuItem = drawer.getByRole('menuitem', { name: '1.1、影像' })
  await menuItem.focus()
  await menuItem.press('Enter')

  await expect(drawer).toBeHidden()
  await expect(page).toHaveURL(/\/layers#imagery$/)
})

test('移动端点击抽屉遮罩后自动关闭', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto('/layers')

  await page.getByRole('button', { name: '打开导航菜单' }).click()
  const drawer = page.getByRole('dialog', { name: '后台导航' })
  await expect(drawer).toBeVisible()

  await page.mouse.click(350, 200)

  await expect(drawer).toBeHidden()
})

test('未知地址保留原 URL，并在后台管理壳内返回图层目录', async ({ page }) => {
  await page.goto('/missing/page?source=playwright')

  await expect(page).toHaveURL('/missing/page?source=playwright')
  await expect(page.getByRole('heading', { level: 1, name: '页面不存在' })).toBeVisible()
  await expect(page.getByText('三维效果展示', { exact: true })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '1、图层' })).toBeVisible()

  await page.getByRole('link', { name: '返回图层列表' }).click()

  await expect(page).toHaveURL(/\/layers$/)
  await expect(page.getByRole('button', { name: '打开1.1.1、天地图' })).toBeVisible()
})

test('从高程卡片打开独立场景，加载失败时仍可操作、全屏和关闭', async ({ page }) => {
  await page.goto('/layers')

  const card = page.getByRole('button', { name: '打开1.2.1、高程' })
  await card.locator('img').click()

  const dialog = page.getByRole('dialog', { name: '1.2.1、高程' })
  const dialogPanel = page.locator('.feature-dialog--elevation')
  await expect(dialog).toBeVisible()
  const globe = dialog.getByTestId('elevation-globe')
  await expectCesiumReady(globe)
  await expect(globe).toBeVisible()
  await expect(dialog.getByTestId('elevation-credit-container')).toBeHidden()
  await expect(dialog.locator('.cesium-viewer-bottom')).toBeHidden()
  await expect(dialog.getByRole('alert')).toHaveCount(0)
  await expect(dialog).not.toContainText('加载失败')

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)
  await dialog.getByRole('button', { name: '退出全屏' }).click()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)

  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()
})

test('视觉效果菜单通过向下箭头分组并锚定雷达图内容', async ({ page }) => {
  await page.goto('/layers')

  await page
    .locator('.admin-sidebar .sidebar-menu__group')
    .nth(1)
    .locator('.el-sub-menu__title')
    .click()
  const effectsMenuItem = page.getByRole('menuitem', { name: '雷达图' })
  await effectsMenuItem.click()

  await expect(page).toHaveURL(/\/layers#radar$/)
  await expect(effectsMenuItem).toHaveAttribute('aria-current', 'location')
  const card = page.getByRole('button', { name: '打开雷达图' })
  await expect(card).toContainText('雷达图')
  await expect(card.locator('img')).toHaveAttribute('alt', '广州海珠区三维雷达扫描效果截图')
  await expectSubmenuArrowsPointDown(page.locator('.admin-sidebar'))

  await expect
    .poll(() =>
      card.evaluate((element) => {
        const content = document.querySelector('main')
        if (!content) {
          throw new Error('未找到内容区')
        }

        return element.getBoundingClientRect().top - content.getBoundingClientRect().top
      }),
    )
    .toBeLessThan(120)

  await card.click()

  const dialog = page.getByRole('dialog', { name: '雷达图' })
  const dialogPanel = page.locator('.radar-dialog')
  const globe = dialog.getByTestId('radar-globe')
  await expect(dialog).toBeVisible()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)
  await expectCesiumReady(globe)
  await expect(globe).toBeVisible()
  await expect(globe.locator('canvas')).toBeVisible()
  await expect(dialog.getByTestId('radar-credit-container')).toBeHidden()
  await expect(dialog.locator('.cesium-viewer-bottom')).toBeHidden()
  await expect(dialog.getByRole('alert')).toHaveCount(0)

  await dialog.getByRole('button', { name: '全屏' }).click()
  await expect(dialogPanel).toHaveClass(/is-fullscreen/)
  await dialog.getByRole('button', { name: '退出全屏' }).click()
  await expect(dialogPanel).not.toHaveClass(/is-fullscreen/)

  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
  await expect(dialog).toBeHidden()
  await expect(card).toBeFocused()
})

test('雷达模块异步加载失败时弹窗仍可关闭且不显示用户可见错误', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  await page.route('**/RadarGlobe.vue*', (route) => route.abort())

  await page.goto('/effects')
  await page.getByRole('button', { name: '打开雷达图' }).click()

  const dialog = page.getByRole('dialog', { name: '雷达图' })
  const mapRegion = dialog.locator('.el-dialog__body')
  await expect(dialog).toBeVisible()
  await expect(mapRegion).toBeVisible()
  expect(await mapRegion.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    'rgb(4, 16, 29)',
  )
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(dialog).not.toContainText('加载失败')

  await dialog.getByRole('button', { name: '关闭此对话框' }).click()
  await expect(dialog).toBeHidden()
  expect(consoleErrors.length).toBeGreaterThan(0)
})
