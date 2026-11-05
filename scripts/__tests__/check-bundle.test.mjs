import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/check-bundle.mjs')
const temporaryDirectories = []

function createFixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-bundle-'))
  temporaryDirectories.push(directory)
  return directory
}

function writeFixture({ entryContent, entryImports, entryDynamicImports, cesium, htmlExtra }) {
  const directory = createFixtureDirectory()
  mkdirSync(join(directory, '.vite'), { recursive: true })
  mkdirSync(join(directory, 'assets'), { recursive: true })

  const manifest = {
    'index.html': {
      file: 'assets/index.js',
      name: 'index',
      src: 'index.html',
      isEntry: true,
      imports: entryImports ?? [],
      dynamicImports: entryDynamicImports ?? ['src/components/CesiumGlobe.vue'],
      css: [],
    },
  }

  if (cesium !== null) {
    manifest['src/components/CesiumGlobe.vue'] = {
      file: 'assets/CesiumGlobe.js',
      name: 'CesiumGlobe',
      src: 'src/components/CesiumGlobe.vue',
      isDynamicEntry: true,
      imports: ['index.html'],
      css: [],
      ...cesium,
    }
  }

  writeFileSync(join(directory, '.vite/manifest.json'), JSON.stringify(manifest, null, 2))
  writeFileSync(
    join(directory, 'index.html'),
    `<!doctype html><html><head><script type="module" src="/assets/index.js"></script>${htmlExtra ?? ''}</head><body></body></html>`,
  )
  writeFileSync(join(directory, 'assets/index.js'), entryContent ?? 'console.log("app")\n')
  writeFileSync(join(directory, 'assets/CesiumGlobe.js'), 'console.log("cesium")\n')

  return directory
}

function runChecker(directory) {
  const result = spawnSync(process.execPath, [scriptPath, '--dist', directory], {
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

describe('check-bundle', () => {
  it('允许入口不含 Cesium 且包体在预算内的正常构建', () => {
    const directory = writeFixture({})

    const result = runChecker(directory)

    expect(result.status).toBe(0)
    expect(result.output).toContain('包体门禁通过')
    expect(result.output).toContain('Cesium 位于动态 chunk')
  })

  it('拒绝入口包含 Cesium 代码', () => {
    const directory = writeFixture({
      entryContent: 'console.log("WebMapTileServiceImageryProvider")\n',
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-in-entry]')
  })

  it('拒绝入口 HTML 预加载 Cesium 资源', () => {
    const directory = writeFixture({
      htmlExtra: '<link rel="modulepreload" href="/assets/CesiumGlobe.js" />',
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-preloaded]')
  })

  it('拒绝入口 gzip 超出预算', () => {
    const directory = writeFixture({
      entryContent: randomBytes(450 * 1024),
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[entry-budget]')
    expect(result.output).toContain('400.0 kB')
  })

  it('拒绝入口静态导入 Cesium chunk', () => {
    const directory = writeFixture({
      entryImports: ['src/components/CesiumGlobe.vue'],
      entryDynamicImports: [],
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-static-import]')
  })

  it('拒绝 Cesium chunk 不再是动态入口', () => {
    const directory = writeFixture({
      cesium: { isDynamicEntry: false },
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-not-dynamic]')
  })

  it('拒绝缺少独立 Cesium chunk 的构建', () => {
    const directory = writeFixture({
      cesium: null,
    })

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('[cesium-chunk-missing]')
  })
})
