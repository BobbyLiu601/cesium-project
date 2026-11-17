#!/usr/bin/env node

import { execFileSync, spawnSync } from 'node:child_process'
import { join, resolve } from 'node:path'
import {
  branchExists,
  isAncestor,
  isFallbackBranch,
  parseTaskBranch,
  resolvePersistentBranch,
  revParse,
} from './lib/task-branches.mjs'
import { listWorktrees } from './lib/task-worktrees.mjs'

const MAIN_BRANCH = 'main'
const BYPASS_VARIABLE = 'ALLOW_MAIN_GIT_UPDATE'
const REASON_VARIABLE = 'MAIN_GIT_UPDATE_REASON'

function printHelp() {
  console.log(`用法：node scripts/check-git-branch.mjs <pre-commit|pre-push>

pre-commit  阻止在 main 或 detached HEAD 上创建提交。
pre-push    从标准输入读取待推送引用，阻止更新远端 main，并拒绝推送
            尚未合并到持久任务分支的 task 分支。

绕过变量（仅限用户明确授权合并时使用）：
  ${BYPASS_VARIABLE}=1
  ${REASON_VARIABLE}=<授权原因>
`)
}

function currentBranch() {
  try {
    return execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function blockedRemoteRefs(input) {
  const refs = []

  for (const line of input.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    const remoteRef = fields[2]
    if (remoteRef === `refs/heads/${MAIN_BRANCH}`) {
      refs.push(remoteRef)
    }
  }

  return refs
}

function unmergedFallbackPushes(input) {
  const pushes = []

  for (const line of input.split(/\r?\n/)) {
    const fields = line.trim().split(/\s+/)
    if (fields.length < 4) {
      continue
    }

    const [localRef, localSha] = fields
    if (!localRef.startsWith('refs/heads/') || /^0+$/.test(localSha)) {
      continue
    }

    const branch = localRef.slice('refs/heads/'.length)
    if (isFallbackBranch(branch)) {
      pushes.push({ branch, sha: localSha })
    }
  }

  return pushes
}

function fallbackBlocker({ branch, sha }) {
  try {
    const { target } = resolvePersistentBranch({
      cwd: process.cwd(),
      fallbackBranch: branch,
      fallbackTip: sha,
    })
    const targetTip = revParse(process.cwd(), target)
    if (isAncestor(process.cwd(), sha, targetTip)) {
      return ''
    }

    return `task 分支 ${branch} 尚未合并到持久分支 ${target}。请先执行 node scripts/finalize-task-branch.mjs --fallback ${branch} --target ${target}`
  } catch (error) {
    return `task 分支 ${branch} 的目标持久分支无法确认：${error.message}。请先执行 finalize 并显式指定 --target`
  }
}

function allowExplicitMainUpdate(action) {
  if (process.env[BYPASS_VARIABLE] !== '1') {
    return false
  }

  const reason = process.env[REASON_VARIABLE]?.trim()
  if (!reason) {
    console.error(
      `[main-branch-guard] 拒绝放行${action}：已设置 ${BYPASS_VARIABLE}=1，但缺少非空 ${REASON_VARIABLE}。`,
    )
    process.exitCode = 2
    return true
  }

  console.warn(`[main-branch-guard] 显式授权放行${action}。原因：${reason}`)
  return true
}

function syncPrimaryTaskBranch() {
  const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
  }).trim()
  const primary = listWorktrees(repoRoot)[0]
  if (!primary?.branch || resolve(primary.path) === resolve(repoRoot)) {
    return ''
  }

  const task = parseTaskBranch(primary.branch)
  if (!task || !branchExists(repoRoot, task.baseBranch)) {
    return ''
  }

  const result = spawnSync(
    process.execPath,
    [
      join(import.meta.dirname, 'finalize-task-branch.mjs'),
      '--fallback',
      primary.branch,
      '--target',
      task.baseBranch,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  )

  if (result.stdout.trim()) {
    console.log(result.stdout.trim())
  }
  if (result.status !== 0) {
    return result.stderr.trim() || `git 分支同步退出码 ${result.status}`
  }

  return ''
}

function reject(action, detail, nextStep) {
  console.error(`[main-branch-guard] 拒绝${action}：${detail}`)
  console.error(`[main-branch-guard] ${nextStep}`)
  process.exitCode = 1
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return ''
  }

  let input = ''
  for await (const chunk of process.stdin) {
    input += chunk
  }
  return input
}

async function checkPreCommit() {
  const branch = currentBranch()

  if (branch === MAIN_BRANCH) {
    if (!allowExplicitMainUpdate('在 main 上创建提交')) {
      reject(
        '在 main 上创建提交',
        `当前分支是 ${MAIN_BRANCH}`,
        '请切回该 Issue 的任务分支后再提交。',
      )
    }
    return
  }

  if (!branch) {
    if (!allowExplicitMainUpdate('在 detached HEAD 上创建提交')) {
      reject(
        '在 detached HEAD 上创建提交',
        '当前 HEAD 未指向命名分支',
        '请切回该 Issue 的任务分支后再提交。',
      )
    }
    return
  }

  const syncProblem = syncPrimaryTaskBranch()
  if (syncProblem) {
    reject(
      '提交前同步主检出中的 task 分支',
      syncProblem,
      '先确认旧 task 分支已合并到持久分支，再重新提交。',
    )
  }
}

async function checkPrePush() {
  const input = await readStdin()
  const refs = blockedRemoteRefs(input)
  if (refs.length > 0 && !allowExplicitMainUpdate('向远端 main 推送')) {
    reject(
      '向远端 main 推送',
      `待推送引用包含 ${refs.join(', ')}`,
      `默认只推送任务分支；合并 main 必须取得用户明确授权后，再使用 ${BYPASS_VARIABLE} 放行。`,
    )
  }

  const fallbackProblems = unmergedFallbackPushes(input).map(fallbackBlocker).filter(Boolean)
  for (const problem of fallbackProblems) {
    reject('推送未合并的 task 分支', problem, '先运行 finalize 合并 task 分支后再推送。')
  }
}

async function main() {
  const [hookType] = process.argv.slice(2)

  if (hookType === '--help' || hookType === '-h') {
    printHelp()
    return
  }

  if (hookType === 'pre-commit') {
    await checkPreCommit()
    return
  }

  if (hookType === 'pre-push') {
    await checkPrePush()
    return
  }

  printHelp()
  process.exitCode = 2
}

await main()
