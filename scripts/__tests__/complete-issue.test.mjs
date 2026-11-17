import { execFileSync, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/complete-issue.mjs')
const temporaryDirectories = []

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function commitFile(directory, name, content, message) {
  writeFileSync(join(directory, name), content)
  git(directory, ['add', '.'])
  git(directory, ['commit', '-m', message])
}

function branchExists(directory, branch) {
  return (
    spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd: directory,
    }).status === 0
  )
}

function currentBranch(directory) {
  return git(directory, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
}

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-complete-issue-'))
  temporaryDirectories.push(directory)

  const remote = join(directory, 'remote.git')
  const primary = join(directory, 'primary')
  const active = join(directory, 'active')
  const persistent = 'agent/deepseek-pro/alcy-55'
  const previousTask = 'agent/deepseek-pro/alcy-55-111111111111'
  const activeTask = 'agent/deepseek-pro/alcy-55-222222222222'

  git(directory, ['init', '--bare', remote])
  git(directory, ['init', '-b', 'main', primary])
  git(primary, ['config', 'user.name', 'Complete Issue Test'])
  git(primary, ['config', 'user.email', 'complete@example.test'])
  mkdirSync(join(primary, '.github/workflows'), { recursive: true })
  writeFileSync(join(primary, '.github/workflows/pages.yml'), 'name: Deploy GitHub Pages\n')
  commitFile(primary, 'story.txt', 'base\n', 'initial')
  git(primary, ['remote', 'add', 'origin', remote])
  git(primary, ['push', '-u', 'origin', 'main'])

  const hooksDirectory = join(primary, 'hooks')
  mkdirSync(hooksDirectory)
  const prePushHook = join(hooksDirectory, 'pre-push')
  writeFileSync(
    prePushHook,
    `#!/bin/sh\nexec node "${join(projectRoot, 'scripts/check-git-branch.mjs').replaceAll('\\', '/')}" pre-push\n`,
  )
  chmodSync(prePushHook, 0o755)
  git(primary, ['config', 'core.hooksPath', 'hooks'])

  git(primary, ['switch', '-c', persistent])
  commitFile(primary, 'persistent.txt', 'persistent\n', 'persistent change')

  git(primary, ['switch', '-c', previousTask])
  commitFile(primary, 'previous.txt', 'previous\n', 'previous task')
  git(primary, ['switch', persistent])
  git(primary, ['merge', '--ff-only', previousTask])

  git(primary, ['switch', '-c', activeTask])
  commitFile(primary, 'active.txt', 'active\n', 'active task')
  git(primary, ['switch', persistent])
  git(primary, ['merge', '--ff-only', activeTask])
  git(primary, ['worktree', 'add', active, activeTask])

  return {
    directory,
    remote,
    primary,
    active,
    persistent,
    previousTask,
    activeTask,
  }
}

function runComplete(directory, args) {
  const environment = { ...process.env }
  delete environment.ALLOW_MAIN_GIT_UPDATE
  delete environment.MAIN_GIT_UPDATE_REASON

  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: directory,
    encoding: 'utf8',
    env: environment,
  })
  return {
    status: result.status,
    output: `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
  }
}

function remoteMain(repository) {
  return git(repository.remote, ['rev-parse', 'refs/heads/main'])
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('complete-issue', { timeout: 90_000 }, () => {
  it('清理 task 分支、推送 main 并更新本地主检出', () => {
    const repository = createRepository()
    const persistentTip = git(repository.primary, ['rev-parse', repository.persistent])

    const result = runComplete(repository.active, [
      '--base',
      repository.persistent,
      '--merge',
      repository.persistent,
      '--authorize-main-push',
    ])

    expect(result.status).toBe(0)
    expect(remoteMain(repository)).toBe(persistentTip)
    expect(git(repository.primary, ['rev-parse', 'HEAD'])).toBe(persistentTip)
    expect(currentBranch(repository.primary)).toBe('main')
    expect(branchExists(repository.primary, repository.previousTask)).toBe(false)
    expect(branchExists(repository.primary, repository.activeTask)).toBe(true)
    expect(result.output).toContain('暂时无法删除')
    expect(result.output).toContain('GitHub Pages')
  })

  it('没有明确授权时不删除分支也不推送 main', () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)

    const result = runComplete(repository.active, [
      '--base',
      repository.persistent,
      '--merge',
      repository.persistent,
    ])

    expect(result.status).toBe(2)
    expect(result.output).toContain('--authorize-main-push')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
    expect(currentBranch(repository.primary)).toBe(repository.persistent)
  })

  it('dry-run 只报告计划', () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)

    const result = runComplete(repository.active, [
      '--base',
      repository.persistent,
      '--merge',
      repository.persistent,
      '--dry-run',
    ])

    expect(result.status).toBe(0)
    expect(result.output).toContain('dry-run')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
    expect(currentBranch(repository.primary)).toBe(repository.persistent)
  })

  it('主检出不干净时在清理和推送前拒绝', () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)
    writeFileSync(join(repository.primary, 'dirty.txt'), 'dirty\n')

    const result = runComplete(repository.active, [
      '--base',
      repository.persistent,
      '--merge',
      repository.persistent,
      '--authorize-main-push',
    ])

    expect(result.status).toBe(1)
    expect(result.output).toContain('存在未提交改动')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
  })
})
