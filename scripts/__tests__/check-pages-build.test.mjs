import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/check-pages-build.mjs')
const temporaryDirectories = []

function createFixture({ fallbackContent, indexContent } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-pages-'))
  temporaryDirectories.push(directory)
  mkdirSync(join(directory, 'assets'), { recursive: true })
  mkdirSync(join(directory, 'cesium', 'Workers'), { recursive: true })

  const indexHtml =
    indexContent ??
    '<!doctype html><html><head><script type="module" src="/cesium-project/assets/index.js"></script></head><body></body></html>'
  writeFileSync(join(directory, 'index.html'), indexHtml)
  writeFileSync(join(directory, '404.html'), fallbackContent ?? indexHtml)
  writeFileSync(join(directory, 'assets/index.js'), 'console.log("app")\n')
  writeFileSync(join(directory, 'cesium/Workers/test.js'), 'console.log("cesium")\n')
  writeFileSync(
    join(directory, 'version.json'),
    `${JSON.stringify(
      {
        commit: '0123456789abcdef0123456789abcdef01234567',
        builtAt: '2026-11-19T00:00:00.000Z',
      },
      null,
      2,
    )}\n`,
  )

  return directory
}

function runChecker(directory) {
  const result = spawnSync(process.execPath, [scriptPath, '--dist', directory, '--static-only'], {
    cwd: projectRoot,
    encoding: 'utf8',
  })

  return {
    status: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('check-pages-build', () => {
  it('接受具有 Pages 基路径、404 回退和 Cesium 静态资源的产物', () => {
    const directory = createFixture()

    const result = runChecker(directory)

    expect(result.status).toBe(0)
    expect(result.output).toContain('Pages 产物检查通过')
  })

  it('拒绝未使用 Pages 基路径的静态资源', () => {
    const directory = createFixture({
      indexContent:
        '<!doctype html><html><head><script type="module" src="/assets/index.js"></script></head><body></body></html>',
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[asset-base-mismatch]')
  })

  it('拒绝与 index.html 不一致的 404 回退页', () => {
    const directory = createFixture({
      fallbackContent: '<!doctype html><html><body>fallback</body></html>',
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[fallback-mismatch]')
  })

  it('拒绝缺少 Cesium 静态资源的产物', () => {
    const directory = createFixture()
    rmSync(join(directory, 'cesium'), { recursive: true, force: true })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-static-missing]')
  })

  it('拒绝缺少版本清单的产物', () => {
    const directory = createFixture()
    rmSync(join(directory, 'version.json'))

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[version-manifest-missing]')
  })

  it('拒绝提交 SHA 无效的版本清单', () => {
    const directory = createFixture()
    writeFileSync(
      join(directory, 'version.json'),
      `${JSON.stringify({
        commit: 'not-a-sha',
        builtAt: '2026-11-19T00:00:00.000Z',
      })}\n`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[version-commit-invalid]')
  })
})
