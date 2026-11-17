#!/usr/bin/env node

import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import {
  branchExists,
  gitStatus,
  isAncestor,
  parseTaskBranch,
  resolvePersistentBranch,
  revParse,
  taskBranchBase,
} from './lib/task-branches.mjs'
import {
  assertWorktreeSafe,
  currentBranch,
  listWorktrees,
  mustGit,
  worktreesForBranch,
} from './lib/task-worktrees.mjs'

function printHelp() {
  console.log(`用法：node scripts/finalize-task-branch.mjs [--fallback <分支>] [--target <分支>] [--dry-run] [--delete]

把任务分支合并回同一 Issue 的持久分支：
  1. 确认或完成 task 分支到持久分支的合并；
  2. 默认保留 task 分支，供下一轮继续使用和最终统一清理；
  3. 仅显式传入 --delete 时才尝试删除本地 task 分支。

参数：
  --fallback <分支>  默认使用当前分支
  --target <分支>    默认按 Issue key 从 agent/*/<issue-key> 解析
  --dry-run          只打印计划，不修改任何 ref 或工作树
  --delete           合并后删除本地 task 分支（仅限明确清理时使用）
  --after-commit     供 post-commit hook 使用；非 task 分支静默跳过

命令不会更新 main、不会删除远端分支、不会强制推送。普通任务完成时保留分支；
用户明确回复“issue完成”后使用 scripts/cleanup-task-branches.mjs 统一清理。
`)
}

function parseArgs(argv) {
  const options = {
    fallback: '',
    target: '',
    dryRun: false,
    deleteBranch: false,
    afterCommit: false,
  }

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
    if (argument === '--delete') {
      options.deleteBranch = true
      continue
    }
    if (argument === '--after-commit') {
      options.afterCommit = true
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

function prepareNextTaskCheckout({ repoRoot, target, dryRun }) {
  if (worktreesForBranch(repoRoot, target).length > 0) {
    return false
  }

  const primary = listWorktrees(repoRoot)[0]
  if (
    !primary ||
    !primary.branch ||
    resolve(primary.path) === resolve(repoRoot) ||
    taskBranchBase(primary.branch) !== target
  ) {
    return false
  }

  assertWorktreeSafe(primary, '主检出 ')
  if (dryRun) {
    console.log(
      `[branch-sync] dry-run：将把主检出 ${primary.path} 从 ${primary.branch} 切回 ${target}`,
    )
    return true
  }

  mustGit(primary.path, ['switch', target])
  console.log(`[branch-sync] 已把主检出 ${primary.path} 切回 ${target}，下一任务将从该分支派生`)
  return true
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
        `[branch-sync] 持久分支 ${target} 已被 ${targetWorktrees.map((item) => item.path).join(', ')} 占用；本轮保留 task 分支。`,
      )
      return false
    }

    if (dryRun) {
      for (const worktree of fallbackWorktrees) {
        console.log(`[branch-sync] dry-run：将把 ${worktree.path} 从 ${fallback} 切回 ${target}`)
      }
    } else {
      for (const worktree of fallbackWorktrees) {
        mustGit(worktree.path, ['switch', target])
        console.log(`[branch-sync] 已将 ${worktree.path} 切回 ${target}`)
      }
    }
  }

  if (dryRun) {
    console.log(
      `[branch-sync] dry-run：将删除本地 task 分支 ${fallback}（删除前 SHA：${fallbackTip}）`,
    )
    return true
  }

  mustGit(repoRoot, ['update-ref', '-d', `refs/heads/${fallback}`, fallbackTip])
  console.log(
    `[branch-sync] 已删除本地 task 分支 ${fallback}；恢复命令：git branch ${fallback} ${fallbackTip}`,
  )
  return true
}

function finalize(options) {
  const repoRoot = mustGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  const fallback = options.fallback || currentBranch(repoRoot)

  if (!fallback) {
    if (options.afterCommit) {
      return
    }
    throw new UsageError('当前 HEAD 不在命名分支上，请用 --fallback 指定 task 分支')
  }

  if (!branchExists(repoRoot, fallback)) {
    if (options.fallback) {
      console.log(`[branch-sync] ${fallback} 不存在；同步是幂等的，无需处理。`)
      return
    }
    throw new UsageError(`当前分支 ${fallback} 不存在`)
  }

  const taskMeta = parseTaskBranch(fallback)
  if (!taskMeta) {
    if (options.afterCommit) {
      return
    }
    if (options.fallback) {
      throw new UsageError(`${fallback} 不是带 task id 后缀的 task 分支`)
    }
    console.log(`[branch-sync] 当前分支 ${fallback} 是持久分支；无需合并。`)
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

  if (!options.afterCommit) {
    console.log(`[branch-sync] task 分支：${fallback}（${fallbackTip}）`)
  }
  console.log(`[branch-sync] 持久分支：${target}（${targetTip}，解析方式：${resolution.source}）`)

  prepareNextTaskCheckout({ repoRoot, target, dryRun: options.dryRun })

  if (isAncestor(repoRoot, fallbackTip, targetTip)) {
    if (!options.afterCommit) {
      console.log('[branch-sync] 持久分支已包含 task 分支，无需重复合并。')
    }
  } else if (options.dryRun) {
    const method = isAncestor(repoRoot, targetTip, fallbackTip) ? 'fast-forward' : 'merge'
    console.log(`[branch-sync] dry-run：将执行 ${method}，把 ${fallback} 合并到 ${target}`)
  } else {
    const method = mergeFallback({ repoRoot, target, targetTip, fallbackTip })
    console.log(`[branch-sync] 已通过 ${method} 把 ${fallback} 合并到 ${target}`)
  }

  const mergedTargetTip = options.dryRun ? targetTip : revParse(repoRoot, target)
  if (!options.dryRun && !isAncestor(repoRoot, fallbackTip, mergedTargetTip)) {
    throw new Error(`合并后 ${target} 仍不包含 ${fallbackTip}；保留 task 分支`)
  }

  if (options.deleteBranch) {
    deleteFallback({
      repoRoot,
      fallback,
      fallbackTip,
      target,
      dryRun: options.dryRun,
    })
  } else if (!options.afterCommit) {
    console.log(`[branch-sync] 已保留 task 分支 ${fallback}；待用户确认 issue完成后统一清理。`)
  }
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
    console.error(`[branch-sync] 失败：${error.message}`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}

main()
