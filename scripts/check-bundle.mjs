#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { gzipSync } from 'node:zlib'

const DEFAULT_DIST_DIR = 'dist'
const DEFAULT_BUDGET_KB = 400
const CESIUM_SOURCE_MARKER = 'CesiumGlobe.vue'
const CESIUM_ENTRY_MARKERS = [
  'WebMapTileServiceImageryProvider',
  'EllipsoidTerrainProvider',
  'CesiumTerrainProvider',
  'Cesium3DTileset',
  'CESIUM_BASE_URL',
]

function printHelp() {
  console.log(`用法：node scripts/check-bundle.mjs [选项]

检查生产构建中的 Cesium 加载边界与入口 JavaScript 包体预算。

选项：
  --dist <目录>      构建产物目录，默认 dist
  --budget-kb <数值>  入口 JavaScript gzip 预算，单位 kB，默认 400
  --help             显示帮助

退出码：
  0  检查通过
  1  检查失败
  2  检查过程出错
`)
}

function parseArgs(argv) {
  const options = {
    dist: DEFAULT_DIST_DIR,
    budgetKb: DEFAULT_BUDGET_KB,
    help: false,
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
    } else if (argument === '--budget-kb') {
      const value = Number(argv[index + 1])
      if (!Number.isFinite(value) || value <= 0) {
        throw new Error('--budget-kb 需要一个正数')
      }
      options.budgetKb = value
      index += 1
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`未知参数：${argument}`)
    }
  }

  return options
}

function readManifest(distDir) {
  const candidates = [join(distDir, '.vite', 'manifest.json'), join(distDir, 'manifest.json')]
  const manifestPath = candidates.find((candidate) => existsSync(candidate))

  if (!manifestPath) {
    throw new Error(
      '未找到构建 manifest。请确认 vite.config.ts 中启用了 build.manifest，并先执行 pnpm build-only。',
    )
  }

  return JSON.parse(readFileSync(manifestPath, 'utf8'))
}

function findEntry(manifest) {
  return Object.entries(manifest).find(([, chunk]) => chunk.isEntry)
}

function findCesiumChunk(manifest) {
  return Object.entries(manifest).find(([key, chunk]) => {
    return key.includes(CESIUM_SOURCE_MARKER) || chunk.name === 'CesiumGlobe'
  })
}

function collectStaticImports(manifest, startKey) {
  const visited = new Set()
  const queue = [startKey]

  while (queue.length > 0) {
    const key = queue.shift()
    if (!key || visited.has(key)) {
      continue
    }

    visited.add(key)
    for (const importedKey of manifest[key]?.imports ?? []) {
      queue.push(importedKey)
    }
  }

  return visited
}

function isDynamicallyReachable(manifest, startKey, targetKey) {
  const staticImports = collectStaticImports(manifest, startKey)
  const visited = new Set()
  const queue = [...staticImports]

  while (queue.length > 0) {
    const key = queue.shift()
    if (!key || visited.has(key)) {
      continue
    }

    visited.add(key)
    for (const dynamicKey of manifest[key]?.dynamicImports ?? []) {
      if (dynamicKey === targetKey) {
        return true
      }
      queue.push(dynamicKey)
    }
  }

  return false
}

function formatKb(bytes) {
  return `${(bytes / 1000).toFixed(1)} kB`
}

function checkBundle(distDir, budgetKb) {
  const manifest = readManifest(distDir)
  const entry = findEntry(manifest)
  const cesium = findCesiumChunk(manifest)
  const failures = []

  if (!entry) {
    return {
      failures: [
        {
          code: 'entry-missing',
          message: '构建 manifest 中没有找到入口 chunk。',
          fix: '确认 Vite 构建正常完成，并检查 build.manifest 产物。',
        },
      ],
    }
  }

  const [entryKey, entryChunk] = entry
  const entryPath = join(distDir, entryChunk.file)
  if (!existsSync(entryPath)) {
    return {
      failures: [
        {
          code: 'entry-file-missing',
          message: `manifest 指向的入口文件不存在：${entryChunk.file}`,
          fix: '重新执行 pnpm build-only，并检查构建产物是否被清理。',
        },
      ],
    }
  }

  const entrySource = readFileSync(entryPath)
  const entryGzipBytes = gzipSync(entrySource).length
  const budgetBytes = budgetKb * 1000
  const htmlPath = join(distDir, 'index.html')

  if (!existsSync(htmlPath)) {
    failures.push({
      code: 'html-missing',
      message: '构建产物中缺少 index.html。',
      fix: '重新执行 pnpm build-only，并确认构建没有被中断或清理。',
    })
  }

  if (entryGzipBytes > budgetBytes) {
    failures.push({
      code: 'entry-budget',
      message: `入口 JavaScript gzip 体积 ${formatKb(entryGzipBytes)} 超过预算 ${formatKb(budgetBytes)}。`,
      fix: '检查新增依赖或静态导入；如确需提高预算，请单独提交可审查的预算配置变更。',
    })
  }

  const entryText = entrySource.toString('utf8')
  const entryMarker = CESIUM_ENTRY_MARKERS.find((marker) => entryText.includes(marker))
  if (entryMarker) {
    failures.push({
      code: 'cesium-in-entry',
      message: `入口 chunk 包含 Cesium 代码标记 ${entryMarker}。`,
      fix: '确认 CesiumGlobe.vue 仍通过 import() 动态加载，且 Cesium 未被静态导入入口。',
    })
  }

  if (!cesium) {
    failures.push({
      code: 'cesium-chunk-missing',
      message: '构建产物中没有找到独立的 Cesium chunk。',
      fix: '确认 CesiumGlobe.vue 通过动态 import() 加载，且构建配置没有把 Cesium 合入入口。',
    })
  } else {
    const [cesiumKey, cesiumChunk] = cesium

    if (!existsSync(join(distDir, cesiumChunk.file))) {
      failures.push({
        code: 'cesium-file-missing',
        message: `manifest 指向的 Cesium 文件不存在：${cesiumChunk.file}`,
        fix: '重新执行 pnpm build-only，并检查构建产物是否被清理。',
      })
    }

    if (!cesiumChunk.isDynamicEntry) {
      failures.push({
        code: 'cesium-not-dynamic',
        message: `Cesium chunk ${cesiumChunk.file} 不是动态入口。`,
        fix: '确认 CesiumGlobe.vue 只通过 import() 加载，不要改成静态 import。',
      })
    }

    if (collectStaticImports(manifest, entryKey).has(cesiumKey)) {
      failures.push({
        code: 'cesium-static-import',
        message: `入口静态导入了 Cesium chunk ${cesiumChunk.file}。`,
        fix: '移除入口到 Cesium chunk 的静态 import 链，恢复 import() 动态加载。',
      })
    }

    if (!isDynamicallyReachable(manifest, entryKey, cesiumKey)) {
      failures.push({
        code: 'cesium-not-dynamically-reachable',
        message: '入口没有通过动态 import 链加载 Cesium chunk。',
        fix: '确认 ThreeDimensionalEarthDialog.vue 通过 import() 打开 CesiumGlobe.vue。',
      })
    }

    if (existsSync(htmlPath)) {
      const html = readFileSync(htmlPath, 'utf8')
      const cesiumAssets = [cesiumChunk.file, ...(cesiumChunk.css ?? [])]
      const preloadedAsset = cesiumAssets.find((asset) => html.includes(asset))
      if (preloadedAsset) {
        failures.push({
          code: 'cesium-preloaded',
          message: `入口 HTML 预加载了 Cesium 资源 ${preloadedAsset}。`,
          fix: '移除入口 HTML 中对 Cesium chunk 或样式的 preload，保持首屏不下载 Cesium。',
        })
      }
    }
  }

  return {
    failures,
    summary: {
      entryFile: entryChunk.file,
      entryGzipBytes,
      budgetBytes,
      cesiumFile: cesium?.[1].file,
    },
  }
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const distDir = resolve(options.dist)
  if (!existsSync(distDir)) {
    throw new Error(`构建产物目录不存在：${distDir}。请先执行 pnpm build-only。`)
  }

  const result = checkBundle(distDir, options.budgetKb)

  if (result.failures.length === 0) {
    console.log(
      `包体门禁通过：入口 ${result.summary.entryFile} gzip ${formatKb(result.summary.entryGzipBytes)}（预算 ${formatKb(result.summary.budgetBytes)}），Cesium 位于动态 chunk ${result.summary.cesiumFile}。`,
    )
    return
  }

  console.error(`包体门禁失败：发现 ${result.failures.length} 个问题。`)
  for (const failure of result.failures) {
    console.error(`- [${failure.code}] ${failure.message} 修复：${failure.fix}`)
  }
  process.exitCode = 1
}

try {
  main()
} catch (error) {
  console.error(`包体门禁出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
}
