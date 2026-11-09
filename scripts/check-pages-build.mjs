#!/usr/bin/env node

import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

import { chromium } from '@playwright/test'

const DEFAULT_BASE_PATH = '/cesium-project/'
const DEFAULT_DIST_DIR = 'dist'
const PAGE_TIMEOUT_MS = 15_000
const CONTENT_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm',
}

function printHelp() {
  console.log(`用法：node scripts/check-pages-build.mjs [选项]

检查 GitHub Pages 构建产物的基路径、404 回退和 Cesium 静态资源加载。

选项：
  --dist <目录>      构建产物目录，默认 dist
  --base <路径>      Pages 基路径，默认 /cesium-project/
  --static-only      只检查文件结构，不启动浏览器
  --help             显示帮助
`)
}

function parseArgs(argv) {
  const options = {
    basePath: DEFAULT_BASE_PATH,
    dist: DEFAULT_DIST_DIR,
    help: false,
    staticOnly: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--dist') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--dist 需要一个目录参数')
      }
      options.dist = value
      index += 1
    } else if (argument === '--base') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--base 需要一个路径参数')
      }
      options.basePath = normalizeBasePath(value)
      index += 1
    } else if (argument === '--static-only') {
      options.staticOnly = true
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`未知参数：${argument}`)
    }
  }

  return options
}

function normalizeBasePath(value) {
  const basePath = value.trim().replace(/^([^/])/, '/$1')
  return basePath.endsWith('/') ? basePath : `${basePath}/`
}

function addFailure(failures, code, message) {
  failures.push({ code, message })
}

function validateStaticArtifact(distDir, basePath) {
  const failures = []
  const indexPath = join(distDir, 'index.html')
  const fallbackPath = join(distDir, '404.html')

  if (!existsSync(indexPath)) {
    addFailure(failures, 'index-missing', '构建产物中缺少 index.html。')
    return failures
  }

  if (!existsSync(fallbackPath)) {
    addFailure(failures, 'fallback-missing', '构建产物中缺少 404.html。')
  } else if (!readFileSync(indexPath).equals(readFileSync(fallbackPath))) {
    addFailure(failures, 'fallback-mismatch', '404.html 必须与 index.html 完全一致。')
  }

  const html = readFileSync(indexPath, 'utf8')
  const assetPaths = [...html.matchAll(/(?:href|src)="(\/[^"]+)"/g)].map((match) => match[1])
  const outsideBasePath = assetPaths.filter((assetPath) => !assetPath.startsWith(basePath))

  if (assetPaths.length === 0) {
    addFailure(failures, 'assets-missing', 'index.html 中没有找到根路径静态资源。')
  } else if (outsideBasePath.length > 0) {
    addFailure(
      failures,
      'asset-base-mismatch',
      `以下静态资源未使用 Pages 基路径 ${basePath}：${outsideBasePath.join(', ')}`,
    )
  }

  if (!existsSync(join(distDir, 'cesium', 'Workers'))) {
    addFailure(failures, 'cesium-static-missing', '构建产物中缺少 Cesium 静态资源目录 cesium/。')
  }

  return failures
}

function getContentType(filePath) {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function createPagesServer(distDir, basePath) {
  return createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', 'http://127.0.0.1')
    let pathname

    try {
      pathname = decodeURIComponent(requestUrl.pathname)
    } catch {
      response.writeHead(400)
      response.end('Bad Request')
      return
    }

    const fallbackPath = join(distDir, '404.html')
    let filePath = fallbackPath
    let statusCode = 404

    if (pathname.startsWith(basePath)) {
      const relativePath = pathname.slice(basePath.length) || 'index.html'
      const candidatePath = resolve(distDir, relativePath)
      const distPrefix = distDir.endsWith(sep) ? distDir : `${distDir}${sep}`

      if (
        (candidatePath === distDir || candidatePath.startsWith(distPrefix)) &&
        existsSync(candidatePath) &&
        statSync(candidatePath).isFile()
      ) {
        filePath = candidatePath
        statusCode = 200
      }
    }

    if (!existsSync(filePath)) {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Not Found')
      return
    }

    response.writeHead(statusCode, {
      'Cache-Control': 'no-store',
      'Content-Type': getContentType(filePath),
    })
    createReadStream(filePath).pipe(response)
  })
}

async function listen(server) {
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    throw new Error('无法获取 Pages 测试服务器地址。')
  }

  return `http://127.0.0.1:${address.port}`
}

async function waitForText(page, text) {
  await page.getByText(text, { exact: true }).waitFor({ timeout: PAGE_TIMEOUT_MS })
}

async function validateBrowserBehavior(origin, basePath) {
  const failures = []
  const localRequests = []
  const cesiumRequests = []
  const browser = await chromium.launch()
  const page = await browser.newPage()

  page.on('request', (request) => {
    const requestUrl = new URL(request.url())
    if (requestUrl.origin !== origin) {
      return
    }

    localRequests.push(requestUrl.pathname)
    if (requestUrl.pathname.startsWith(`${basePath}cesium/`)) {
      cesiumRequests.push(requestUrl.pathname)
    }
  })

  try {
    await page.route(/https:\/\/t\d\.tianditu\.gov\.cn\//, (route) => route.abort())
    await page.route(/https:\/\/elevation3d\.arcgis\.com\//, (route) => route.abort())

    const entryResponse = await page.goto(`${origin}${basePath}`, {
      waitUntil: 'domcontentloaded',
    })
    if (entryResponse?.status() !== 200) {
      addFailure(
        failures,
        'entry-status',
        `基路径入口返回 HTTP ${entryResponse?.status() ?? 'unknown'}，预期 200。`,
      )
    }

    await waitForText(page, '三维效果展示')
    await page.waitForURL((url) => url.pathname === `${basePath}basic-config`, {
      timeout: PAGE_TIMEOUT_MS,
    })

    const outsideBasePath = localRequests.filter((pathname) => !pathname.startsWith(basePath))
    if (outsideBasePath.length > 0) {
      addFailure(
        failures,
        'request-base-mismatch',
        `页面请求了 Pages 基路径之外的本地资源：${outsideBasePath.join(', ')}`,
      )
    }

    await page.getByRole('button', { name: '打开三维地球' }).click()
    await page.waitForFunction(
      () =>
        document
          .querySelector('[data-testid="cesium-globe"]')
          ?.getAttribute('data-cesium-state') === 'ready',
      undefined,
      { timeout: PAGE_TIMEOUT_MS },
    )

    if (cesiumRequests.length === 0) {
      addFailure(
        failures,
        'cesium-base-mismatch',
        `Cesium 没有从 ${basePath}cesium/ 加载静态资源。`,
      )
    }

    const fallbackResponse = await page.goto(`${origin}${basePath}effects`, {
      waitUntil: 'domcontentloaded',
    })
    if (fallbackResponse?.status() !== 404) {
      addFailure(
        failures,
        'fallback-status',
        `子路由回退返回 HTTP ${fallbackResponse?.status() ?? 'unknown'}，预期 404。`,
      )
    }

    await page.getByRole('button', { name: '打开雷达图' }).waitFor({ timeout: PAGE_TIMEOUT_MS })
    if (new URL(page.url()).pathname !== `${basePath}effects`) {
      addFailure(failures, 'fallback-url', '404.html 回退后没有保留原始子路由地址。')
    }
  } finally {
    await browser.close()
  }

  return failures
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const distDir = resolve(options.dist)
  if (!existsSync(distDir)) {
    throw new Error(`构建产物目录不存在：${distDir}。请先执行 pnpm build:pages。`)
  }

  const failures = validateStaticArtifact(distDir, options.basePath)
  if (failures.length > 0 || options.staticOnly) {
    reportResult(failures, options.basePath)
    return
  }

  const server = createPagesServer(distDir, options.basePath)

  try {
    const origin = await listen(server)
    failures.push(...(await validateBrowserBehavior(origin, options.basePath)))
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose))
  }

  reportResult(failures, options.basePath)
}

function reportResult(failures, basePath) {
  if (failures.length === 0) {
    console.log(`Pages 产物检查通过：基路径 ${basePath}，入口、子路由回退和 Cesium 资源均正常。`)
    return
  }

  console.error(`Pages 产物检查失败：发现 ${failures.length} 个问题。`)
  for (const failure of failures) {
    console.error(`- [${failure.code}] ${failure.message}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`Pages 产物检查出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
})
