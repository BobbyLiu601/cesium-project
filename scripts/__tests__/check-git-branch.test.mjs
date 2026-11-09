import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/check-git-branch.mjs')
const temporaryDirectories = []
const zeroSha = '0'.repeat(40)

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-git-guard-'))
  temporaryDirectories.push(directory)
  execFileSync('git', ['init', '-b', 'main'], { cwd: directory, stdio: 'ignore' })
  return directory
}

function setBranch(directory, branch) {
  execFileSync('git', ['symbolic-ref', 'HEAD', `refs/heads/${branch}`], {
    cwd: directory,
    stdio: 'ignore',
  })
}

function createRepositoryWithRemote() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-git-hook-'))
  temporaryDirectories.push(directory)

  const remoteDirectory = join(directory, 'remote.git')
  const workDirectory = join(directory, 'work')
  mkdirSync(workDirectory)

  execFileSync('git', ['init', '--bare', remoteDirectory], { stdio: 'ignore' })
  execFileSync('git', ['init', '-b', 'main', workDirectory], { stdio: 'ignore' })
  execFileSync('git', ['config', 'user.name', 'Git Guard Test'], { cwd: workDirectory })
  execFileSync('git', ['config', 'user.email', 'git-guard@example.test'], { cwd: workDirectory })
  execFileSync('git', ['commit', '--allow-empty', '-m', 'initial'], {
    cwd: workDirectory,
    stdio: 'ignore',
  })
  execFileSync('git', ['remote', 'add', 'origin', remoteDirectory], { cwd: workDirectory })
  execFileSync('git', ['push', '-u', 'origin', 'main'], {
    cwd: workDirectory,
    stdio: 'ignore',
  })

  const hooksDirectory = join(workDirectory, 'hooks')
  mkdirSync(hooksDirectory)
  const prePushHook = join(hooksDirectory, 'pre-push')
  writeFileSync(
    prePushHook,
    `#!/bin/sh\nexec node "${scriptPath.replaceAll('\\', '/')}" pre-push\n`,
  )
  // Git only executes hooks with the executable bit set on Unix runners.
  chmodSync(prePushHook, 0o755)
  execFileSync('git', ['config', 'core.hooksPath', 'hooks'], { cwd: workDirectory })

  return workDirectory
}

function runGuard(directory, hookType, options = {}) {
  const environment = { ...process.env }
  delete environment.ALLOW_MAIN_GIT_UPDATE
  delete environment.MAIN_GIT_UPDATE_REASON
  Object.assign(environment, options.env)

  const result = spawnSync(process.execPath, [scriptPath, hookType], {
    cwd: directory,
    encoding: 'utf8',
    input: options.input ?? '',
    env: environment,
  })

  return {
    status: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

function pushLine(remoteBranch) {
  return `refs/heads/fix/alcy-39-test ${zeroSha} refs/heads/${remoteBranch} ${zeroSha}\n`
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('check-git-branch', () => {
  it('阻止在 main 上创建提交', () => {
    const directory = createRepository()

    const result = runGuard(directory, 'pre-commit')

    expect(result.status).toBe(1)
    expect(result.output).toContain('当前分支是 main')
  })

  it('允许在任务分支上创建提交', () => {
    const directory = createRepository()
    setBranch(directory, 'fix/alcy-39-test')

    const result = runGuard(directory, 'pre-commit')

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe('')
  })

  it('阻止向远端 main 推送', () => {
    const directory = createRepository()

    const result = runGuard(directory, 'pre-push', {
      input: pushLine('main'),
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('refs/heads/main')
  })

  it('允许向任务分支推送', () => {
    const directory = createRepository()

    const result = runGuard(directory, 'pre-push', {
      input: pushLine('fix/alcy-39-test'),
    })

    expect(result.status).toBe(0)
    expect(result.output.trim()).toBe('')
  })

  it('要求显式授权必须附带非空原因', () => {
    const directory = createRepository()

    const result = runGuard(directory, 'pre-push', {
      input: pushLine('main'),
      env: {
        ALLOW_MAIN_GIT_UPDATE: '1',
      },
    })

    expect(result.status).toBe(2)
    expect(result.output).toContain('缺少非空 MAIN_GIT_UPDATE_REASON')
  })

  it('允许带授权原因的显式合并放行', () => {
    const directory = createRepository()

    const result = runGuard(directory, 'pre-push', {
      input: pushLine('main'),
      env: {
        ALLOW_MAIN_GIT_UPDATE: '1',
        MAIN_GIT_UPDATE_REASON: '用户已明确授权合并',
      },
    })

    expect(result.status).toBe(0)
    expect(result.output).toContain('显式授权放行向远端 main 推送')
    expect(result.output).toContain('用户已明确授权合并')
  })

  it('通过真实 pre-push hook 阻止 main 并允许任务分支', () => {
    const directory = createRepositoryWithRemote()
    execFileSync('git', ['commit', '--allow-empty', '-m', 'advance main'], {
      cwd: directory,
      stdio: 'ignore',
    })

    const blockedPush = spawnSync('git', ['push', 'origin', 'main'], {
      cwd: directory,
      encoding: 'utf8',
    })

    expect(blockedPush.status).not.toBe(0)
    expect(`${blockedPush.stdout}${blockedPush.stderr}`).toContain('拒绝向远端 main 推送')

    execFileSync('git', ['switch', '-c', 'fix/alcy-39-test'], {
      cwd: directory,
      stdio: 'ignore',
    })
    execFileSync('git', ['commit', '--allow-empty', '-m', 'task change'], {
      cwd: directory,
      stdio: 'ignore',
    })
    const allowedPush = spawnSync('git', ['push', '-u', 'origin', 'fix/alcy-39-test'], {
      cwd: directory,
      encoding: 'utf8',
    })

    expect(allowedPush.status).toBe(0)
  }, 20_000)
})
