#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import {
  deploymentTiming,
  resolveGitHubContext,
  resolveGitHubToken,
  waitForPagesWorkflow,
  waitForPublishedCommit,
} from './lib/pages-deployment.mjs'
import {
  MAIN_BRANCH,
  branchExists,
  gitEnvironment,
  gitStatus,
  isAncestor,
  parseTaskBranch,
  resolvePersistentBranch,
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
  console.log(`用法：node scripts/complete-issue.mjs [--base <持久分支>]... [--merge <完成分支>]
       [--remote origin] [--dry-run] [--authorize-main-push]

仅在用户明确回复“issue完成”后执行：
  1. 自动解析当前 Issue 的持久分支，并收敛当前 task 分支；
  2. 删除该持久分支下已合并且已释放的 task 分支；
  3. 把完成分支 fast-forward 到本地和远端 main；
  4. 等待对应提交的 GitHub Pages workflow 成功；
  5. 读取线上 version.json，确认实际发布提交与目标一致。

参数：
  --base <分支>          可重复；默认使用完成分支
  --merge <分支>         默认从当前持久分支或当前 task 分支自动解析
  --remote <名称>        默认 origin
  --dry-run             只检查和打印计划，不删除分支、不更新 ref、不推送、不访问网络
  --authorize-main-push 确认本命令由“issue完成”评论明确授权，可更新远端 main

仅当 workflow 成功且线上 version.json 的 commit 与目标 SHA 一致时，命令才返回成功。
随后可把 Issue 标为 done；任一步失败都应标为 blocked 并报告可操作结果。`)
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
  const current = currentBranch(repoRoot)
  let currentTask = ''
  let merge = options.merge

  if (!merge) {
    if (!current) {
      throw new UsageError('当前 HEAD 不在命名分支上，请用 --merge 指定完成分支')
    }

    const taskMeta = parseTaskBranch(current)
    if (taskMeta) {
      currentTask = current
      const resolution = resolvePersistentBranch({
        cwd: repoRoot,
        fallbackBranch: current,
        fallbackTip: revParse(repoRoot, current),
      })
      merge = resolution.target
      console.log(
        `[issue-complete] 已从 task 分支 ${current} 解析持久分支 ${merge}（${resolution.source}）`,
      )
    } else {
      merge = current
    }
  } else if (current && parseTaskBranch(current)) {
    currentTask = current
    const taskMeta = parseTaskBranch(current)
    if (taskMeta.baseBranch !== merge) {
      throw new UsageError(
        `当前 task 分支 ${current} 属于 ${taskMeta.baseBranch}，不能完成 ${merge}`,
      )
    }
  }

  if (!merge) {
    throw new UsageError('无法确定完成分支，请用 --merge 指定')
  }

  assertPersistentBranch(repoRoot, merge, '--merge')
  const bases = options.bases.length > 0 ? options.bases : [merge]
  for (const base of bases) {
    assertPersistentBranch(repoRoot, base, '--base')
  }

  return { bases: [...new Set(bases)], currentTask, merge }
}

function runFinalize(repoRoot, taskBranch, targetBranch, dryRun) {
  const args = [
    join(import.meta.dirname, 'finalize-task-branch.mjs'),
    '--fallback',
    taskBranch,
    '--target',
    targetBranch,
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
    throw new Error(`收敛 task 分支 ${taskBranch} 到 ${targetBranch} 失败`)
  }
}

function convergeCurrentTask(repoRoot, branches, options) {
  if (!branches.currentTask) {
    return revParse(repoRoot, branches.merge)
  }

  const taskTip = revParse(repoRoot, branches.currentTask)
  const targetTip = revParse(repoRoot, branches.merge)
  if (!isAncestor(repoRoot, taskTip, targetTip)) {
    assertWorktreeSafe({ path: repoRoot }, '当前工作树 ')
    if (options.dryRun) {
      console.log(
        `[issue-complete] dry-run：将把 ${branches.currentTask}（${taskTip}）合并到 ${branches.merge}`,
      )
      return taskTip
    }
    runFinalize(repoRoot, branches.currentTask, branches.merge, false)
    return revParse(repoRoot, branches.merge)
  }

  if (options.dryRun) {
    console.log(`[issue-complete] dry-run：${branches.currentTask} 已包含在 ${branches.merge}`)
  }
  return targetTip
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
  const remoteUrl = mustGit(repoRoot, ['remote', 'get-url', options.remote])

  if (!existsSync(join(repoRoot, PAGES_WORKFLOW))) {
    throw new Error(`缺少 GitHub Pages workflow：${PAGES_WORKFLOW}`)
  }

  assertWorktreeSafe({ path: repoRoot }, '当前工作树 ')

  if (!options.dryRun) {
    console.log(`[issue-complete] 正在获取 ${options.remote}/${MAIN_BRANCH}...`)
    mustGit(repoRoot, ['fetch', '--prune', options.remote, MAIN_BRANCH])
  }

  const remoteMain = `refs/remotes/${options.remote}/${MAIN_BRANCH}`
  if (!refExists(repoRoot, remoteMain)) {
    throw new Error(`找不到 ${options.remote}/${MAIN_BRANCH}；请先完成 fetch`)
  }

  const remoteMainTip = revParse(repoRoot, remoteMain)
  const mergeTip = branches.mergeTip || revParse(repoRoot, branches.merge)
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

  const deployment = resolveGitHubContext({
    remoteUrl,
    environment: process.env,
  })

  return {
    deployment,
    localMainTip,
    mainWorktree,
    mergeTip,
    primary,
    remoteMainTip,
  }
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

function verifyRemoteMain(repoRoot, remote, mergeTip) {
  const output = mustGit(repoRoot, ['ls-remote', '--heads', remote, `refs/heads/${MAIN_BRANCH}`])
  const remoteTip = output.split(/\s+/)[0] ?? ''
  if (remoteTip !== mergeTip) {
    throw new Error(
      `远端 ${MAIN_BRANCH} 校验失败：期望 ${mergeTip}，实际 ${remoteTip || 'missing'}`,
    )
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

async function complete(options) {
  const repoRoot = mustGit(process.cwd(), ['rev-parse', '--show-toplevel'])
  const branches = resolveBranches(repoRoot, options)
  const mergeTip = convergeCurrentTask(repoRoot, branches, options)
  const state = preflight(repoRoot, options, { ...branches, mergeTip })
  const timing = deploymentTiming()

  for (const base of branches.bases) {
    runCleanup(repoRoot, base, options.dryRun)
  }

  if (options.dryRun) {
    console.log(
      `[issue-complete] dry-run：将把 ${branches.merge}（${state.mergeTip}）推送到 ${options.remote}/${MAIN_BRANCH}`,
    )
    console.log('[issue-complete] dry-run：将更新本地 main 并把主检出切换到 main')
    console.log(
      `[issue-complete] dry-run：将等待 ${PAGES_WORKFLOW} 成功，并校验 ${state.deployment.siteUrl}version.json`,
    )
    return
  }

  const alreadyAtTarget = state.remoteMainTip === state.mergeTip
  if (alreadyAtTarget) {
    console.log(`[issue-complete] 远端 ${MAIN_BRANCH} 已指向 ${state.mergeTip}，无需重复推送`)
  } else {
    pushMain(repoRoot, options.remote, state.mergeTip)
  }
  verifyRemoteMain(repoRoot, options.remote, state.mergeTip)

  const localMainPath = updateLocalMain(repoRoot, state.remoteMainTip, state.mergeTip)
  if (localMainPath) {
    console.log(`[issue-complete] 本地 main 已在 ${localMainPath} 更新到 ${state.mergeTip}`)
  } else {
    const mainPath = switchPrimaryToMain(repoRoot)
    console.log(`[issue-complete] 主检出 ${mainPath} 已切换到最新 main（${state.mergeTip}）`)
  }

  const token = resolveGitHubToken(repoRoot)
  const workflowRun = await waitForPagesWorkflow({
    context: state.deployment,
    targetSha: state.mergeTip,
    token,
    pollIntervalMs: timing.pollIntervalMs,
    timeoutMs: timing.workflowTimeoutMs,
  })
  console.log(
    `[issue-complete] Pages workflow 成功：${
      workflowRun.html_url ||
      `https://github.com/${state.deployment.owner}/${state.deployment.repo}/actions/runs/${workflowRun.id}`
    }`,
  )

  const manifest = await waitForPublishedCommit({
    context: state.deployment,
    targetSha: state.mergeTip,
    pollIntervalMs: timing.pollIntervalMs,
    timeoutMs: timing.siteTimeoutMs,
  })
  console.log(
    `[issue-complete] 发布完成：提交 ${manifest.commit}，站点 ${state.deployment.siteUrl}`,
  )
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2))
    if (options.help) {
      printHelp()
      return
    }
    await complete(options)
  } catch (error) {
    console.error(`[issue-complete] 失败：${error.message}`)
    process.exitCode = error instanceof UsageError ? 2 : 1
  }
}

await main()
