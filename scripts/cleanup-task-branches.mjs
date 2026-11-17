#!/usr/bin/env node

import {
  MAIN_BRANCH,
  branchExists,
  isAncestor,
  listTaskBranchesForBase,
  parseTaskBranch,
  revParse,
} from './lib/task-branches.mjs'
import {
  assertWorktreeSafe,
  currentBranch,
  mustGit,
  worktreesForBranch,
} from './lib/task-worktrees.mjs'

function printHelp() {
  console.log(`用法：node scripts/cleanup-task-branches.mjs [--base <持久分支>] [--dry-run] [--keep-current]

仅在用户明确回复“issue完成”后执行：
  1. 找出所有基于该持久分支创建的 task 分支；
  2. 确认每个 task 分支的 tip 都已合并进持久分支；
  3. 删除这些本地 task 分支，保留持久分支和 main。

参数：
  --base <分支>  默认为当前持久分支
  --dry-run      只检查并打印计划，不删除 ref
  --keep-current 用户回复“issue完成”时保留本次运行占用的活动 task 分支
`)
}

function parseArgs(argv) {
  const options = { base: '', dryRun: false, keepCurrent: false, help: false }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--base') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new UsageError('--base 需要一个分支名')
      }
      options.base = value
      index += 1
      continue
    }
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--keep-current') {
      options.keepCurrent = true
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

function cleanup(options) {
  const repoRoot = mustGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  const base = options.base || currentBranch(repoRoot)

  if (!base) {
    throw new UsageError('当前 HEAD 不在命名分支上，请用 --base 指定持久分支')
  }
  if (base === MAIN_BRANCH || parseTaskBranch(base)) {
    throw new UsageError(`--base 必须是持久 Issue 分支，不能是 ${base}`)
  }
  if (!branchExists(repoRoot, base)) {
    throw new UsageError(`持久分支 ${base} 不存在`)
  }

  const baseTip = revParse(repoRoot, base)
  const taskBranches = listTaskBranchesForBase(repoRoot, base)
  if (taskBranches.length === 0) {
    console.log(`[branch-cleanup] ${base} 下没有待清理的 task 分支。`)
    return
  }

  const current = currentBranch(repoRoot)
  const deferred = []
  const targets = []

  for (const branch of taskBranches) {
    const tip = revParse(repoRoot, branch)
    if (!isAncestor(repoRoot, tip, baseTip)) {
      throw new Error(`task 分支 ${branch}（${tip}）尚未合并到 ${base}；拒绝清理`)
    }
    if (branch === current && options.keepCurrent) {
      deferred.push({ branch, tip })
      continue
    }

    const worktrees = worktreesForBranch(repoRoot, branch)
    for (const worktree of worktrees) {
      assertWorktreeSafe(worktree, 'task 分支 ')
    }
    if (worktrees.length > 0) {
      throw new Error(
        `task 分支 ${branch} 仍被工作树 ${worktrees.map((item) => item.path).join(', ')} 占用；先关闭或移除该工作树`,
      )
    }

    targets.push({ branch, tip })
  }

  if (options.dryRun) {
    for (const target of targets) {
      console.log(
        `[branch-cleanup] dry-run：将删除 ${target.branch}（${target.tip}），恢复命令：git branch ${target.branch} ${target.tip}`,
      )
    }
    for (const branch of deferred) {
      console.log(
        `[branch-cleanup] dry-run：保留本次运行的活动 task 分支 ${branch.branch}（${branch.tip}）`,
      )
    }
    return
  }

  for (const target of targets) {
    mustGit(repoRoot, ['update-ref', '-d', `refs/heads/${target.branch}`, target.tip])
    console.log(
      `[branch-cleanup] 已删除 ${target.branch}（${target.tip}），恢复命令：git branch ${target.branch} ${target.tip}`,
    )
  }
  for (const branch of deferred) {
    console.log(
      `[branch-cleanup] 本次运行的活动 task 分支 ${branch.branch}（${branch.tip}）暂时无法删除；工作树释放后请再次运行清理。`,
    )
  }
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }
    cleanup(options)
  } catch (error) {
    console.error(`[branch-cleanup] 失败：${error.message}`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}

main()
