import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/check-template-content.mjs')
const temporaryDirectories = []

function createFixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-template-'))
  temporaryDirectories.push(directory)
  return directory
}

function runChecker(directory) {
  const result = spawnSync(process.execPath, [scriptPath, '--root', directory], {
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

describe('check-template-content', () => {
  it('允许原生按钮内的行内内容', () => {
    const directory = createFixtureDirectory()
    writeFileSync(
      join(directory, 'ValidButton.vue'),
      `<template>
  <button type="button" aria-label="打开">
    <span>打开</span>
    <img src="/icon.png" alt="" />
  </button>
</template>
`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(0)
    expect(result.output).toContain('模板内容模型校验通过')
  })

  it('拒绝按钮内的块级内容并报告行号', () => {
    const directory = createFixtureDirectory()
    writeFileSync(
      join(directory, 'BlockButton.vue'),
      `<template>
  <button type="button">
    <div>非法内容</div>
  </button>
</template>
`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('BlockButton.vue:3')
    expect(result.output).toContain('<div>')
    expect(result.output).toContain('块级元素')
  })

  it('拒绝按钮内的嵌套交互内容', () => {
    const directory = createFixtureDirectory()
    writeFileSync(
      join(directory, 'InteractiveButton.vue'),
      `<template>
  <button type="button">
    <a href="/next">下一步</a>
  </button>
</template>
`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('InteractiveButton.vue:3')
    expect(result.output).toContain('<a>')
    expect(result.output).toContain('交互元素')
  })

  it('不误报非按钮模板中的块级内容', () => {
    const directory = createFixtureDirectory()
    writeFileSync(
      join(directory, 'Content.vue'),
      `<template>
  <section>
    <div>
      <p>合法块级内容</p>
    </div>
  </section>
</template>
`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(0)
  })

  it('同时检查 Element Plus 按钮组件的默认插槽内容', () => {
    const directory = createFixtureDirectory()
    writeFileSync(
      join(directory, 'ElementButton.vue'),
      `<template>
  <ElButton>
    <div>非法内容</div>
  </ElButton>
</template>
`,
    )

    const result = runChecker(directory)

    expect(result.status).toBe(1)
    expect(result.output).toContain('<div>')
  })
})
