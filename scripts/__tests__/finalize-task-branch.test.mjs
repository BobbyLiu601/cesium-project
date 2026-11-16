import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/finalize-task-branch.mjs')
const temporaryDirectories = []

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-finalize-'))
  temporaryDirectories.push(directory)

  git(directory, ['init', '-b', 'main'])
  git(directory, ['config', 'user.name', 'Finalize Test'])
  git(directory, ['config', 'user.email', 'finalize@example.test'])
  writeFileSync(join(directory, 'story.txt'), 'base\n')
  git(directory, ['add', '.'])
  git(directory, ['commit', '-m', 'initial'])
  return directory
}

function commitFile(directory, name, content, message) {
  writeFileSync(join(directory, name), content)
  git(directory, ['add', '.'])
  git(directory, ['commit', '-m', message])
}

function switchBranch(directory, branch, create = false) {
  git(directory, create ? ['switch', '-c', branch] : ['switch', branch])
}

function revParse(directory, revision) {
  return git(directory, ['rev-parse', revision])
}

function branchExists(directory, branch) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: directory,
  })
  return result.status === 0
}

function runFinalize(directory, args = []) {
  const result = spawnSync(process.execPath, [scriptPath, ...args], {
    cwd: directory,
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

describe('finalize-task-branch', () => {
  it('快进持久分支后删除 fallback，重复执行是 no-op', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    const fallbackTip = revParse(directory, 'HEAD')
    switchBranch(directory, 'main')

    const first = runFinalize(directory, ['--fallback', fallback])

    expect(first.status).toBe(0)
    expect(first.output).toContain('fast-forward')
    expect(revParse(directory, persistent)).toBe(fallbackTip)
    expect(branchExists(directory, fallback)).toBe(false)

    const second = runFinalize(directory, ['--fallback', fallback])
    expect(second.status).toBe(0)
    expect(second.output).toContain('不存在')
  })

  it('持久分支已前进时生成 merge commit', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    const fallbackTip = revParse(directory, 'HEAD')
    switchBranch(directory, persistent)
    commitFile(directory, 'advanced.txt', 'advanced\n', 'advance persistent')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(0)
    expect(result.output).toContain('merge')
    const parents = git(directory, ['rev-list', '--parents', '-n', '1', persistent]).split(/\s+/)
    expect(parents).toHaveLength(3)
    expect(git(directory, ['merge-base', '--is-ancestor', fallbackTip, persistent])).toBe('')
    expect(branchExists(directory, fallback)).toBe(false)
  })

  it('内容冲突时停止且不删除 fallback', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'story.txt', 'persistent base\n', 'persistent base')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'story.txt', 'fallback edit\n', 'fallback edit')
    switchBranch(directory, persistent)
    commitFile(directory, 'story.txt', 'persistent edit\n', 'persistent edit')
    const persistentTip = revParse(directory, 'HEAD')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(1)
    expect(result.output).toContain('冲突')
    expect(revParse(directory, persistent)).toBe(persistentTip)
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('fallback 工作树不干净时停止', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'
    const fallbackWorktree = join(directory, 'fallback-worktree')

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, 'main')
    git(directory, ['worktree', 'add', fallbackWorktree, fallback])
    writeFileSync(join(fallbackWorktree, 'uncommitted.txt'), 'dirty\n')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(1)
    expect(result.output).toContain('未提交改动')
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('持久分支已包含 fallback 时只删除本地 ref', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--no-ff', '--no-edit', fallback])
    const persistentTip = revParse(directory, 'HEAD')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(0)
    expect(result.output).toContain('已包含')
    expect(revParse(directory, persistent)).toBe(persistentTip)
    expect(branchExists(directory, fallback)).toBe(false)
  })

  it('目标分支缺失时失败', () => {
    const directory = createRepository()
    const fallback = 'agent/deepseek-pro/alcy-99-abcdef123456'

    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(1)
    expect(result.output).toContain('无法确定')
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('存在多个持久分支候选时失败', () => {
    const directory = createRepository()
    const fallback = 'agent/deepseek-pro/alcy-99-abcdef123456'

    switchBranch(directory, 'agent/deepseek-pro/alcy-99', true)
    commitFile(directory, 'pro.txt', 'pro\n', 'pro change')
    switchBranch(directory, 'main')
    switchBranch(directory, 'agent/deepseek-flash/alcy-99', true)
    commitFile(directory, 'flash.txt', 'flash\n', 'flash change')
    switchBranch(directory, 'main')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(1)
    expect(result.output).toContain('无法唯一确定')
    expect(result.output).toContain('agent/deepseek-pro/alcy-99')
    expect(result.output).toContain('agent/deepseek-flash/alcy-99')
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('持久分支工作树不干净时停止', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'
    const targetWorktree = join(directory, 'target-worktree')

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, 'main')
    git(directory, ['worktree', 'add', targetWorktree, persistent])
    writeFileSync(join(targetWorktree, 'uncommitted.txt'), 'dirty\n')

    const result = runFinalize(directory, ['--fallback', fallback])

    expect(result.status).toBe(1)
    expect(result.output).toContain('未提交改动')
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('dry-run 不修改 ref 或工作树', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    const persistentTip = revParse(directory, 'HEAD')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')
    switchBranch(directory, 'main')

    const result = runFinalize(directory, ['--fallback', fallback, '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.output).toContain('dry-run')
    expect(revParse(directory, persistent)).toBe(persistentTip)
    expect(branchExists(directory, fallback)).toBe(true)
  })

  it('当前 fallback 工作树干净时切回持久分支并删除 fallback', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const fallback = 'agent/deepseek-pro/alcy-51-d9d0e4c5d03c'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, fallback, true)
    commitFile(directory, 'fallback.txt', 'fallback\n', 'fallback change')

    const result = runFinalize(directory)

    expect(result.status).toBe(0)
    expect(result.output).toContain('切回')
    expect(git(directory, ['symbolic-ref', '--short', 'HEAD'])).toBe(persistent)
    expect(branchExists(directory, fallback)).toBe(false)
  })
})
