#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  MAIN_BRANCH,
  branchExists,
  gitEnvironment,
  gitStatus,
  isAncestor,
  parseTaskBranch,
  revParse,
} from './lib/task-branches.mjs'
import {
  assertWorktreeSafe,
  currentBranch,
  listWorktrees,
  mustGit,
  worktreesForBranch,
} from './lib/task-worktrees.mjs'

const PAGES_WORKFLOW = '.github/workflows/pages.yml'
const MAIN_UPDATE_REASON = '用户明确回复“issue完成”，授权合并到远端 main 并更新 GitHub Pages'

function printHelp() {
  console.log(`用法：node scripts/complete-issue.mjs [--base <持久分支>]... [--merge <待合并分支>]
       [--remote origin] [--dry-run] [--authorize-main-push]

仅在用户明确回复“issue完成”后执行：
  1. 删除 --base 下已合并且已释放的 task 分支；
  2. 把 --merge 分支 fast-forward 到本地和远端 main；
  3. 把主检出切换到最新 main，并触发 GitHub Pages workflow。

参数：
  --base <分支>         可重复；默认使用 --merge 分支
  --merge <分支>        默认使用唯一的 --base，或当前持久分支
  --remote <名称>      默认 origin
  --dry-run             只检查和打印计划，不删除分支、不更新 ref、不推送
  --authorize-main-push 确认本命令由“issue完成”评论明确授权，可更新远端 main

命令成功后，执行 agent 还需要把 Issue 状态改为 done。
`)
}

class UsageError extends Error {}

function parseArgs(argv) {
  const options = {
    bases: [],
    merge: '',
    remote: 'origin',
    dryRun: false,
    authorizeMainPush: false,
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--base' || argument === '--merge' || argument === '--remote') {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) {
        throw new UsageError(`${argument} 需要一个值`)
      }
      if (argument === '--base') {
        options.bases.push(value)
      } else if (argument === '--merge') {
        options.merge = value
      } else {
        options.remote = value
      }
      index += 1
      continue
    }
    if (argument === '--dry-run') {
      options.dryRun = true
      continue
    }
    if (argument === '--authorize-main-push') {
      options.authorizeMainPush = true
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

function assertPersistentBranch(repoRoot, branch, label) {
  if (branch === MAIN_BRANCH || parseTaskBranch(branch)) {
    throw new UsageError(`${label} 必须是持久 Issue 分支，不能是 ${branch}`)
  }
  if (!branchExists(repoRoot, branch)) {
    throw new UsageError(`${label} ${branch} 不存在`)
  }
}

function resolveBranches(repoRoot, options) {
  let merge = options.merge
  if (!merge) {
    if (options.bases.length === 1) {
      merge = options.bases[0]
    } else if (options.bases.length === 0) {
      merge = currentBranch(repoRoot)
    }
  }
  if (!merge) {
    throw new UsageError('无法确定待合并分支，请用 --merge 指定')
  }

  const bases = options.bases.length > 0 ? options.bases : [merge]
  assertPersistentBranch(repoRoot, merge, '--merge')
  for (const base of bases) {
    assertPersistentBranch(repoRoot, base, '--base')
  }

  return { bases: [...new Set(bases)], merge }
}

function runCleanup(repoRoot, base, dryRun) {
  const args = [
    join(import.meta.dirname, 'cleanup-task-branches.mjs'),
    '--base',
    base,
    '--keep-current',
  ]
  if (dryRun) {
    args.push('--dry-run')
  }

  const result = spawnSync(process.execPath, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }
  if (result.status !== 0) {
    throw new Error(`清理 ${base} 下的 task 分支失败`)
  }
}

function mainCheckout(repoRoot) {
  const worktrees = worktreesForBranch(repoRoot, MAIN_BRANCH)
  if (worktrees.length > 1) {
    throw new Error(`main 同时被多个工作树占用：${worktrees.map((item) => item.path).join(', ')}`)
  }
  return worktrees[0] ?? null
}

function refExists(repoRoot, ref) {
  return gitStatus(repoRoot, ['show-ref', '--verify', '--quiet', ref]).status === 0
}

function preflight(repoRoot, options, branches) {
  mustGit(repoRoot, ['remote', 'get-url', options.remote])

  if (!existsSync(join(repoRoot, PAGES_WORKFLOW))) {
    throw new Error(`缺少 GitHub Pages workflow：${PAGES_WORKFLOW}`)
  }

  if (!options.dryRun) {
    console.log(`[issue-complete] 正在获取 ${options.remote}/${MAIN_BRANCH}...`)
    mustGit(repoRoot, ['fetch', '--prune', options.remote, MAIN_BRANCH])
  }

  const remoteMain = `refs/remotes/${options.remote}/${MAIN_BRANCH}`
  if (!refExists(repoRoot, remoteMain)) {
    throw new Error(`找不到 ${options.remote}/${MAIN_BRANCH}；请先完成 fetch`)
  }

  const remoteMainTip = revParse(repoRoot, remoteMain)
  const mergeTip = revParse(repoRoot, branches.merge)
  if (!isAncestor(repoRoot, remoteMainTip, mergeTip)) {
    throw new Error(
      `${branches.merge} 尚未包含最新 ${options.remote}/${MAIN_BRANCH}；请先同步 main 到该分支并重新验证`,
    )
  }

  if (!branchExists(repoRoot, MAIN_BRANCH)) {
    throw new Error(`本地 ${MAIN_BRANCH} 不存在`)
  }
  const localMainTip = revParse(repoRoot, `refs/heads/${MAIN_BRANCH}`)
  if (!isAncestor(repoRoot, localMainTip, remoteMainTip)) {
    throw new Error(
      `本地 ${MAIN_BRANCH} 与 ${options.remote}/${MAIN_BRANCH} 已分叉或含未发布提交；先人工同步`,
    )
  }

  const mainWorktree = mainCheckout(repoRoot)
  if (mainWorktree) {
    assertWorktreeSafe(mainWorktree, `${MAIN_BRANCH} `)
  }

  const primary = listWorktrees(repoRoot)[0]
  if (!mainWorktree && primary?.branch !== MAIN_BRANCH) {
    if (!primary) {
      throw new Error('找不到可更新的本地主检出')
    }
    if (resolve(primary.path) === resolve(repoRoot)) {
      throw new Error('当前工作树没有独立的主检出可切换到 main')
    }
    assertWorktreeSafe(primary, '主检出 ')
  }

  if (!options.dryRun && !options.authorizeMainPush) {
    throw new UsageError(
      '更新远端 main 需要 --authorize-main-push；仅在用户明确回复“issue完成”后使用',
    )
  }

  return { remoteMainTip, mergeTip, localMainTip, mainWorktree, primary }
}

function updateLocalMain(repoRoot, remoteMainTip, mergeTip) {
  const mainWorktree = mainCheckout(repoRoot)
  if (mainWorktree) {
    let current = revParse(mainWorktree.path, 'HEAD')
    if (current !== remoteMainTip) {
      mustGit(mainWorktree.path, ['merge', '--ff-only', remoteMainTip])
      current = revParse(mainWorktree.path, 'HEAD')
    }
    if (current !== mergeTip) {
      mustGit(mainWorktree.path, ['merge', '--ff-only', mergeTip])
    }
    return mainWorktree.path
  }

  let current = revParse(repoRoot, `refs/heads/${MAIN_BRANCH}`)
  if (current !== remoteMainTip) {
    mustGit(repoRoot, ['update-ref', `refs/heads/${MAIN_BRANCH}`, remoteMainTip, current])
    current = remoteMainTip
  }
  if (current !== mergeTip) {
    mustGit(repoRoot, ['update-ref', `refs/heads/${MAIN_BRANCH}`, mergeTip, current])
  }
  return ''
}

function pushMain(repoRoot, remote, mergeTip) {
  const result = spawnSync('git', ['push', remote, `${mergeTip}:refs/heads/${MAIN_BRANCH}`], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: {
      ...gitEnvironment(),
      ALLOW_MAIN_GIT_UPDATE: '1',
      MAIN_GIT_UPDATE_REASON: MAIN_UPDATE_REASON,
    },
  })
  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.stderr.trim()) {
    console.error(result.stderr.trim())
  }
  if (result.status !== 0) {
    throw new Error(`推送 ${MAIN_BRANCH} 到 ${remote} 失败`)
  }
}

function switchPrimaryToMain(repoRoot) {
  const mainWorktree = mainCheckout(repoRoot)
  if (mainWorktree) {
    return mainWorktree.path
  }

  const primary = listWorktrees(repoRoot)[0]
  if (!primary || !primary.branch) {
    throw new Error('找不到可切换的本地主检出')
  }
  assertWorktreeSafe(primary, '主检出 ')
  mustGit(primary.path, ['switch', MAIN_BRANCH])
  return primary.path
}

function remoteUrl(repoRoot, remote) {
  return mustGit(repoRoot, ['remote', 'get-url', remote])
}

function pagesUrl(url) {
  const match = /github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/i.exec(url)
  if (!match) {
    return ''
  }
  return `https://${match[1].toLowerCase()}.github.io/${match[2]}/`
}

function complete(options) {
  const repoRoot = mustGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  const branches = resolveBranches(repoRoot, options)
  const state = preflight(repoRoot, options, branches)

  for (const base of branches.bases) {
    runCleanup(repoRoot, base, options.dryRun)
  }

  if (options.dryRun) {
    console.log(
      `[issue-complete] dry-run：将把 ${branches.merge}（${state.mergeTip}）推送到 ${options.remote}/${MAIN_BRANCH}`,
    )
    console.log('[issue-complete] dry-run：将更新本地 main 并把主检出切换到 main')
    console.log(`[issue-complete] dry-run：推送后将触发 ${PAGES_WORKFLOW}`)
    return
  }

  pushMain(repoRoot, options.remote, state.mergeTip)
  const localMainPath = updateLocalMain(repoRoot, state.remoteMainTip, state.mergeTip)
  if (localMainPath) {
    console.log(`[issue-complete] 本地 main 已在 ${localMainPath} 更新到 ${state.mergeTip}`)
  } else {
    const mainPath = switchPrimaryToMain(repoRoot)
    console.log(`[issue-complete] 主检出 ${mainPath} 已切换到最新 main（${state.mergeTip}）`)
  }

  const url = pagesUrl(remoteUrl(repoRoot, options.remote))
  console.log(
    `[issue-complete] 已触发 GitHub Pages workflow（${PAGES_WORKFLOW}）；部署状态以 GitHub Actions 为准。${url ? `站点：${url}` : ''}`,
  )
  console.log('[issue-complete] Git 操作完成；确认成功后把 Issue 状态改为 done。')
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }
    complete(options)
  } catch (error) {
    console.error(`[issue-complete] 失败：${error.message}`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}

main()
