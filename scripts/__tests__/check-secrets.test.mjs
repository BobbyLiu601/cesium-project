import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/check-secrets.mjs')
const temporaryDirectories = []
const tokenKey = 'VITE_TIANDITU_TOKEN'

function envLine(value) {
  return `${tokenKey}=${value}\n`
}

function createFixtureDirectory() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-secrets-'))
  temporaryDirectories.push(directory)
  return directory
}

function runScanner(...args) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
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

describe('check-secrets', () => {
  it('允许空白、占位符和显式 allowlist 中的测试假值', () => {
    const directory = createFixtureDirectory()
    writeFileSync(join(directory, '.env.example'), envLine(''))
    writeFileSync(join(directory, 'README.md'), envLine('your-token'))
    writeFileSync(join(directory, 'fake.env'), envLine('test-only-tianditu-token'))

    const result = runScanner('--root', directory, '--walk')

    expect(result.status).toBe(0)
    expect(result.output).toContain('密钥扫描通过')
  })

  it('发现非空、非占位的天地图 token，并遮罩原文', () => {
    const directory = createFixtureDirectory()
    const fakeToken = 'c'.repeat(32)
    writeFileSync(join(directory, 'config.env'), envLine(fakeToken))

    const result = runScanner('--root', directory, '--walk')

    expect(result.status).toBe(1)
    expect(result.output).toContain('config.env:1')
    expect(result.output).toContain('tianditu-token')
    expect(result.output).not.toContain(fakeToken)
  })

  it('使用 secretlint 发现常见凭据，并遮罩原文', () => {
    const directory = createFixtureDirectory()
    const fakeGithubToken = ['ghp_', 'A'.repeat(36)].join('')
    writeFileSync(join(directory, 'config.txt'), `token = ${fakeGithubToken}\n`)

    const result = runScanner('--root', directory, '--walk')

    expect(result.status).toBe(1)
    expect(result.output).toContain('secretlint-rule-github')
    expect(result.output).not.toContain(fakeGithubToken)
  })

  it('pre-commit 模式只扫描暂存内容', () => {
    const directory = createFixtureDirectory()
    const stagedToken = 'd'.repeat(32)
    const unstagedToken = 'e'.repeat(32)
    execFileSync('git', ['init'], { cwd: directory, stdio: 'ignore' })
    writeFileSync(join(directory, 'staged.env'), envLine(stagedToken))
    writeFileSync(join(directory, 'unstaged.env'), envLine(unstagedToken))
    execFileSync('git', ['add', 'staged.env'], { cwd: directory, stdio: 'ignore' })

    const result = runScanner('--root', directory, '--staged')

    expect(result.status).toBe(1)
    expect(result.output).toContain('staged.env:1')
    expect(result.output).not.toContain('unstaged.env')
    expect(result.output).not.toContain(stagedToken)
    expect(result.output).not.toContain(unstagedToken)
  })
})
