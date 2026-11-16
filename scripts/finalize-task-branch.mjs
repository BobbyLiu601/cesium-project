#!/usr/bin/env node

import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import {
  branchExists,
  gitStatus,
  isAncestor,
  parseFallbackBranch,
  resolvePersistentBranch,
  revParse,
} from './lib/task-branches.mjs'

function printHelp() {
  console.log(`用法：node scripts/finalize-task-branch.mjs [--fallback <分支>] [--target <分支>] [--dry-run]

把临时 fallback 分支收敛回同一 Issue 的持久任务分支：
  1. 确认持久任务分支已经包含 fallback 的 tip；
  2. 必要时把 fallback 快进或合并到持久任务分支；
  3. 仅在安全条件全部满足时删除本地 fallback ref。

参数：
  --fallback <分支>  默认使用当前分支
  --target <分支>    默认按 Issue key 从 agent/*/<issue-key> 解析
  --dry-run          只打印计划，不修改任何 ref 或工作树

删除前会记录 fallback SHA。命令不会更新 main、不会删除远端分支、不会强制推送。
`)
}

function parseArgs(argv) {
  const options = { fallback: '', target: '', dryRun: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--fallback' || argument === '--target') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new UsageError(`${argument} 需要一个分支名`)
      }
      options[argument === '--fallback' ? 'fallback' : 'target'] = value
      index += 1
      continue
    }
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true
      continue
    }

    throw new UsageError(`无法识别的参数：${argument}`)
  }

  return options
}

class UsageError extends Error {}

function runGit(cwd, args) {
  return gitStatus(cwd, args)
}

function mustGit(cwd, args) {
  const result = runGit(cwd, args)
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')} 失败：${result.stderr.trim() || result.stdout.trim()}`)
  }
  return result.stdout.trim()
}

function currentBranch(cwd) {
  const result = runGit(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  return result.status === 0 ? result.stdout.trim() : ''
}

function listWorktrees(cwd) {
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

function worktreesForBranch(cwd, branch) {
  return listWorktrees(cwd).filter((worktree) => worktree.branch === branch)
}

function operationInProgress(worktreePath) {
  for (const ref of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'REBASE_HEAD']) {
    if (runGit(worktreePath, ['rev-parse', '-q', '--verify', ref]).status === 0) {
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

function assertWorktreeSafe(worktree, role) {
  const status = mustGit(worktree.path, ['status', '--porcelain', '--untracked-files=normal'])
  if (status) {
    throw new Error(`${role}工作树 ${worktree.path} 存在未提交改动；请先处理后再执行 finalize`)
  }

  const operation = operationInProgress(worktree.path)
  if (operation) {
    throw new Error(`${role}工作树 ${worktree.path} 正在进行 ${operation}；请先完成或中止`)
  }
}

function mergeFallback({ repoRoot, target, targetTip, fallbackTip }) {
  const targetWorktrees = worktreesForBranch(repoRoot, target)

  if (targetWorktrees.length > 0) {
    const worktree = targetWorktrees[0]
    assertWorktreeSafe(worktree, `持久分支 ${target} 的`)

    const fastForward = isAncestor(repoRoot, targetTip, fallbackTip)
    const mergeArgs = fastForward
      ? ['merge', '--ff-only', fallbackTip]
      : ['merge', '--no-edit', fallbackTip]
    const result = runGit(worktree.path, mergeArgs)
    if (result.status !== 0) {
      runGit(worktree.path, ['merge', '--abort'])
      throw new Error(`合并 ${fallbackTip} 到 ${target} 失败：${result.stderr.trim()}`)
    }

    return fastForward ? 'fast-forward' : 'merge'
  }

  if (isAncestor(repoRoot, targetTip, fallbackTip)) {
    mustGit(repoRoot, ['update-ref', `refs/heads/${target}`, fallbackTip, targetTip])
    return 'fast-forward'
  }

  const temporaryWorktree = join(tmpdir(), `cesium-finalize-${randomUUID()}`)
  try {
    mustGit(repoRoot, ['worktree', 'add', '--detach', temporaryWorktree, targetTip])
    const result = runGit(temporaryWorktree, ['merge', '--no-edit', fallbackTip])
    if (result.status !== 0) {
      runGit(temporaryWorktree, ['merge', '--abort'])
      throw new Error(`合并 ${fallbackTip} 到 ${target} 发生冲突；fallback 保持不动`)
    }

    const mergedTip = mustGit(temporaryWorktree, ['rev-parse', 'HEAD'])
    mustGit(repoRoot, ['update-ref', `refs/heads/${target}`, mergedTip, targetTip])
    return 'merge'
  } finally {
    runGit(repoRoot, ['worktree', 'remove', '--force', temporaryWorktree])
  }
}

function deleteFallback({ repoRoot, fallback, fallbackTip, target, dryRun }) {
  const fallbackWorktrees = worktreesForBranch(repoRoot, fallback)

  for (const worktree of fallbackWorktrees) {
    assertWorktreeSafe(worktree, 'fallback ')
  }

  if (fallbackWorktrees.length > 0) {
    const targetWorktrees = worktreesForBranch(repoRoot, target)
    if (targetWorktrees.length > 0) {
      console.warn(
        `[branch-finalize] 持久分支 ${target} 已被 ${targetWorktrees.map((item) => item.path).join(', ')} 占用；本轮保留 fallback，待下一次 finalize 删除。`,
      )
      return false
    }

    if (dryRun) {
      for (const worktree of fallbackWorktrees) {
        console.log(
          `[branch-finalize] dry-run：将把 ${worktree.path} 从 ${fallback} 切回 ${target}`,
        )
      }
    } else {
      for (const worktree of fallbackWorktrees) {
        mustGit(worktree.path, ['switch', target])
        console.log(`[branch-finalize] 已将 ${worktree.path} 切回 ${target}`)
      }
    }
  }

  if (dryRun) {
    console.log(
      `[branch-finalize] dry-run：将删除本地 fallback ${fallback}（删除前 SHA：${fallbackTip}）`,
    )
    return true
  }

  mustGit(repoRoot, ['update-ref', '-d', `refs/heads/${fallback}`, fallbackTip])
  console.log(
    `[branch-finalize] 已删除本地 fallback ${fallback}；恢复命令：git branch ${fallback} ${fallbackTip}`,
  )
  return true
}

function finalize(options) {
  const repoRoot = mustGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  const fallback = options.fallback || currentBranch(repoRoot)

  if (!fallback) {
    throw new UsageError('当前 HEAD 不在命名分支上，请用 --fallback 指定临时 fallback 分支')
  }

  if (!branchExists(repoRoot, fallback)) {
    if (options.fallback) {
      console.log(`[branch-finalize] ${fallback} 不存在；finalize 是幂等的，无需处理。`)
      return
    }
    throw new UsageError(`当前分支 ${fallback} 不存在`)
  }

  const fallbackMeta = parseFallbackBranch(fallback)
  if (!fallbackMeta) {
    if (options.fallback) {
      throw new UsageError(`${fallback} 不是带 task id 后缀的临时 fallback 分支`)
    }
    console.log(`[branch-finalize] 当前分支 ${fallback} 不是临时 fallback；无需收敛。`)
    return
  }

  const fallbackTip = revParse(repoRoot, fallback)
  const resolution = resolvePersistentBranch({
    cwd: repoRoot,
    fallbackBranch: fallback,
    fallbackTip,
    target: options.target,
  })
  const target = resolution.target
  const targetTip = revParse(repoRoot, target)

  console.log(`[branch-finalize] fallback：${fallback}（${fallbackTip}）`)
  console.log(
    `[branch-finalize] 持久分支：${target}（${targetTip}，解析方式：${resolution.source}）`,
  )

  for (const worktree of worktreesForBranch(repoRoot, fallback)) {
    assertWorktreeSafe(worktree, 'fallback ')
  }

  if (isAncestor(repoRoot, fallbackTip, targetTip)) {
    console.log('[branch-finalize] 持久分支已包含 fallback，无需合并。')
  } else if (options.dryRun) {
    const method = isAncestor(repoRoot, targetTip, fallbackTip) ? 'fast-forward' : 'merge'
    console.log(`[branch-finalize] dry-run：将执行 ${method}，把 ${fallback} 合并到 ${target}`)
  } else {
    const method = mergeFallback({ repoRoot, target, targetTip, fallbackTip })
    console.log(`[branch-finalize] 已通过 ${method} 把 ${fallback} 合并到 ${target}`)
  }

  const mergedTargetTip = options.dryRun ? targetTip : revParse(repoRoot, target)
  if (!options.dryRun && !isAncestor(repoRoot, fallbackTip, mergedTargetTip)) {
    throw new Error(`合并后 ${target} 仍不包含 ${fallbackTip}；保留 fallback`)
  }

  deleteFallback({
    repoRoot,
    fallback,
    fallbackTip,
    target,
    dryRun: options.dryRun,
  })
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }
    finalize(options)
  } catch (error) {
    console.error(`[branch-finalize] 失败：${error.message}`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}

main()
