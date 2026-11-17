import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/cleanup-task-branches.mjs')
const temporaryDirectories = []

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function createRepository() {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-cleanup-'))
  temporaryDirectories.push(directory)

  git(directory, ['init', '-b', 'main'])
  git(directory, ['config', 'user.name', 'Cleanup Test'])
  git(directory, ['config', 'user.email', 'cleanup@example.test'])
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

function branchExists(directory, branch) {
  const result = spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
    cwd: directory,
  })
  return result.status === 0
}

function runCleanup(directory, args) {
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

describe('cleanup-task-branches', { timeout: 90_000 }, () => {
  it('删除所有已合并到持久分支的 task 分支', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const firstTask = 'agent/deepseek-pro/alcy-51-111111111111'
    const secondTask = 'agent/deepseek-pro/alcy-51-222222222222'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, firstTask, true)
    commitFile(directory, 'first.txt', 'first\n', 'first task')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--ff-only', firstTask])
    switchBranch(directory, secondTask, true)
    commitFile(directory, 'second.txt', 'second\n', 'second task')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--ff-only', secondTask])
    switchBranch(directory, 'main')

    const result = runCleanup(directory, ['--base', persistent])

    expect(result.status).toBe(0)
    expect(branchExists(directory, persistent)).toBe(true)
    expect(branchExists(directory, firstTask)).toBe(false)
    expect(branchExists(directory, secondTask)).toBe(false)
  })

  it('任一 task 分支未合并时整体拒绝清理', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const mergedTask = 'agent/deepseek-pro/alcy-51-111111111111'
    const unmergedTask = 'agent/deepseek-pro/alcy-51-222222222222'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, mergedTask, true)
    commitFile(directory, 'merged.txt', 'merged\n', 'merged task')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--ff-only', mergedTask])
    switchBranch(directory, unmergedTask, true)
    commitFile(directory, 'unmerged.txt', 'unmerged\n', 'unmerged task')

    const result = runCleanup(directory, ['--base', persistent])

    expect(result.status).toBe(1)
    expect(result.output).toContain('尚未合并')
    expect(branchExists(directory, mergedTask)).toBe(true)
    expect(branchExists(directory, unmergedTask)).toBe(true)
  })

  it('dry-run 只报告待删除分支', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const taskBranch = 'agent/deepseek-pro/alcy-51-111111111111'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, taskBranch, true)
    commitFile(directory, 'task.txt', 'task\n', 'task change')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--ff-only', taskBranch])
    switchBranch(directory, 'main')

    const result = runCleanup(directory, ['--base', persistent, '--dry-run'])

    expect(result.status).toBe(0)
    expect(result.output).toContain('dry-run')
    expect(branchExists(directory, taskBranch)).toBe(true)
  })

  it('task 分支仍被工作树占用时拒绝删除', () => {
    const directory = createRepository()
    const persistent = 'agent/deepseek-pro/alcy-51'
    const taskBranch = 'agent/deepseek-pro/alcy-51-111111111111'

    switchBranch(directory, persistent, true)
    commitFile(directory, 'persistent.txt', 'persistent\n', 'persistent change')
    switchBranch(directory, taskBranch, true)
    commitFile(directory, 'task.txt', 'task\n', 'task change')
    switchBranch(directory, persistent)
    git(directory, ['merge', '--ff-only', taskBranch])
    switchBranch(directory, taskBranch)

    const result = runCleanup(directory, ['--base', persistent])

    expect(result.status).toBe(1)
    expect(result.output).toContain('仍被工作树')
    expect(branchExists(directory, taskBranch)).toBe(true)
  })
})
