import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { gitStatus } from './task-branches.mjs'

export function mustGit(cwd, args) {
  const result = gitStatus(cwd, args)
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${result.stderr.trim() || result.stdout.trim()}`)
  }
  return result.stdout.trim()
}

export function currentBranch(cwd) {
  const result = gitStatus(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  return result.status === 0 ? result.stdout.trim() : ''
}

export function listWorktrees(cwd) {
  const output = mustGit(cwd, ['worktree', 'list', '--porcelain'])
  const worktrees = []
  let current = null

  for (const line of output.split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      if (current) {
        worktrees.push(current)
      }
      current = { path: line.slice('worktree '.length), branch: '', head: '' }
      continue
    }
    if (!current) {
      continue
    }
    if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length)
    }
    if (line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length)
    }
  }

  if (current) {
    worktrees.push(current)
  }

  return worktrees
}

export function worktreesForBranch(cwd, branch) {
  return listWorktrees(cwd).filter((worktree) => worktree.branch === branch)
}

export function operationInProgress(worktreePath) {
  for (const ref of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD']) {
    if (gitStatus(worktreePath, ['rev-parse', '-q', '--verify', ref]).status === 0) {
      return ref
    }
  }

  const gitDirectory = mustGit(worktreePath, ['rev-parse', '--absolute-git-dir'])
  for (const directory of ['rebase-merge', 'rebase-apply', 'sequencer']) {
    if (existsSync(join(gitDirectory, directory))) {
      return directory
    }
  }

  return ''
}

export function assertWorktreeSafe(worktree, role) {
  const status = mustGit(worktree.path, ['status', '--porcelain', '--untracked-files=normal'])
  if (status) {
    throw new Error(`${role}工作树 ${worktree.path} 存在未提交改动；请先处理后再继续`)
  }

  const operation = operationInProgress(worktree.path)
  if (operation) {
    throw new Error(`${role}工作树 ${worktree.path} 正在进行 ${operation}；请先完成或中止`)
  }
}
