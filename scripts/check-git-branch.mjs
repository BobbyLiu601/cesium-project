#!/usr/bin/env node

import { execFileSync } from 'node:child_process'

const MAIN_BRANCH = 'main'
const BYPASS_VARIABLE = 'ALLOW_MAIN_GIT_UPDATE'
const REASON_VARIABLE = 'MAIN_GIT_UPDATE_REASON'

function printHelp() {
  console.log(`用法：node scripts/check-git-branch.mjs <pre-commit|pre-push>

pre-commit  阻止在 main 或 detached HEAD 上创建提交。
pre-push    从标准输入读取待推送引用，阻止更新远端 main。

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
  }
}

async function checkPrePush() {
  const refs = blockedRemoteRefs(await readStdin())
  if (refs.length === 0) {
    return
  }

  if (!allowExplicitMainUpdate('向远端 main 推送')) {
    reject(
      '向远端 main 推送',
      `待推送引用包含 ${refs.join(', ')}`,
      `默认只推送任务分支；合并 main 必须取得用户明确授权后，再使用 ${BYPASS_VARIABLE} 放行。`,
    )
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
