#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(projectRoot, 'dist')
const pagesBasePath = '/cesium-project/'
const viteCli = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')

function buildPages() {
  if (!existsSync(viteCli)) {
    throw new Error('未找到 Vite CLI，请先执行 pnpm install。')
  }

  const result = spawnSync(process.execPath, [viteCli, 'build', '--configLoader', 'native'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PAGES_BASE_PATH: pagesBasePath,
    },
    stdio: 'inherit',
  })

  if (result.error) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    return
  }

  const indexPath = join(distDir, 'index.html')
  if (!existsSync(indexPath)) {
    throw new Error('Pages 构建产物中缺少 index.html。')
  }

  copyFileSync(indexPath, join(distDir, '404.html'))
  console.log(`GitHub Pages 构建完成：基路径 ${pagesBasePath}，已生成 404.html。`)
}

try {
  buildPages()
} catch (error) {
  console.error(`GitHub Pages 构建出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
