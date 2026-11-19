#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)))
const distDir = join(projectRoot, 'dist')
const pagesBasePath = '/cesium-project/'
const viteCli = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js')
const commitPattern = /^[0-9a-f]{40}$/i

function resolveBuildCommit() {
  const environmentCommit = process.env.GITHUB_SHA?.trim()
  if (environmentCommit) {
    return environmentCommit.toLowerCase()
  }

  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })
  return (result.stdout ?? '').trim().toLowerCase()
}

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

  const commit = resolveBuildCommit()
  if (!commitPattern.test(commit)) {
    throw new Error(`无法确定 Pages 构建提交：${commit || 'missing'}`)
  }

  writeFileSync(
    join(distDir, 'version.json'),
    `${JSON.stringify(
      {
        commit,
        builtAt: new Date().toISOString(),
      },
      null,
      2,
    )}\n`,
  )

  copyFileSync(indexPath, join(distDir, '404.html'))
  console.log(
    `GitHub Pages 构建完成：基路径 ${pagesBasePath}，提交 ${commit}，已生成 version.json 和 404.html。`,
  )
}

try {
  buildPages()
} catch (error) {
  console.error(`GitHub Pages 构建出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
