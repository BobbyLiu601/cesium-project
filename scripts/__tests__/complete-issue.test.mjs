import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const scriptPath = join(projectRoot, 'scripts/complete-issue.mjs')
const temporaryDirectories = []
const servers = []

function git(directory, args) {
  return execFileSync('git', args, {
    cwd: directory,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function commitFile(directory, name, content, message) {
  writeFileSync(join(directory, name), content)
  git(directory, ['add', '.'])
  git(directory, ['commit', '-m', message])
}

function branchExists(directory, branch) {
  return (
    spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], {
      cwd: directory,
    }).status === 0
  )
}

function currentBranch(directory) {
  return git(directory, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
}

function createRepository({ mergeActive = true } = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'cesium-complete-issue-'))
  temporaryDirectories.push(directory)

  const remote = join(directory, 'remote.git')
  const primary = join(directory, 'primary')
  const active = join(directory, 'active')
  const persistent = 'agent/deepseek-pro/alcy-55'
  const previousTask = 'agent/deepseek-pro/alcy-55-111111111111'
  const activeTask = 'agent/deepseek-pro/alcy-55-222222222222'

  git(directory, ['init', '--bare', remote])
  git(directory, ['init', '-b', 'main', primary])
  git(primary, ['config', 'user.name', 'Complete Issue Test'])
  git(primary, ['config', 'user.email', 'complete@example.test'])
  mkdirSync(join(primary, '.github/workflows'), { recursive: true })
  writeFileSync(join(primary, '.github/workflows/pages.yml'), 'name: Deploy GitHub Pages\n')
  commitFile(primary, 'story.txt', 'base\n', 'initial')
  git(primary, ['remote', 'add', 'origin', remote])
  git(primary, ['push', '-u', 'origin', 'main'])

  const hooksDirectory = join(primary, 'hooks')
  mkdirSync(hooksDirectory)
  const prePushHook = join(hooksDirectory, 'pre-push')
  writeFileSync(
    prePushHook,
    `#!/bin/sh\nexec node "${join(projectRoot, 'scripts/check-git-branch.mjs').replaceAll('\\', '/')}" pre-push\n`,
  )
  chmodSync(prePushHook, 0o755)
  git(primary, ['config', 'core.hooksPath', 'hooks'])

  git(primary, ['switch', '-c', persistent])
  commitFile(primary, 'persistent.txt', 'persistent\n', 'persistent change')

  git(primary, ['switch', '-c', previousTask])
  commitFile(primary, 'previous.txt', 'previous\n', 'previous task')
  git(primary, ['switch', persistent])
  git(primary, ['merge', '--ff-only', previousTask])

  git(primary, ['switch', '-c', activeTask])
  commitFile(primary, 'active.txt', 'active\n', 'active task')
  git(primary, ['switch', persistent])
  if (mergeActive) {
    git(primary, ['merge', '--ff-only', activeTask])
  }
  git(primary, ['worktree', 'add', active, activeTask])

  return {
    active,
    activeTask,
    directory,
    persistent,
    previousTask,
    primary,
    remote,
  }
}

async function createDeploymentServer({ targetSha, workflow = 'success', site = 'match' }) {
  const requests = {
    site: 0,
    workflow: 0,
  }
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    response.setHeader('Content-Type', 'application/json')

    if (url.pathname === '/repos/test-owner/test-repo/actions/workflows/pages.yml/runs') {
      requests.workflow += 1
      const requestedSha = url.searchParams.get('head_sha') ?? targetSha
      if (workflow === 'timeout') {
        response.writeHead(200)
        response.end(JSON.stringify({ workflow_runs: [] }))
        return
      }

      const conclusion = workflow === 'failure' ? 'failure' : 'success'
      response.writeHead(200)
      response.end(
        JSON.stringify({
          workflow_runs: [
            {
              conclusion,
              event: 'push',
              head_branch: 'main',
              head_sha: requestedSha,
              html_url: 'https://github.com/test-owner/test-repo/actions/runs/123',
              id: 123,
              status: 'completed',
            },
          ],
        }),
      )
      return
    }

    if (url.pathname === '/version.json') {
      requests.site += 1
      response.writeHead(200, { 'Cache-Control': 'no-store' })
      response.end(
        JSON.stringify({
          builtAt: '2026-11-19T00:00:00.000Z',
          commit: site === 'mismatch' ? '0000000000000000000000000000000000000000' : targetSha,
        }),
      )
      return
    }

    response.writeHead(404)
    response.end(JSON.stringify({ message: 'not found' }))
  })

  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen)
    server.listen(0, '127.0.0.1', resolveListen)
  })
  servers.push(server)

  const address = server.address()
  const origin = `http://127.0.0.1:${address.port}`
  return { origin, requests }
}

async function runComplete(directory, args, environment = {}) {
  const processEnvironment = { ...process.env }
  for (const name of [
    'ALLOW_MAIN_GIT_UPDATE',
    'MAIN_GIT_UPDATE_REASON',
    'GITHUB_API_URL',
    'GITHUB_REPOSITORY',
    'GITHUB_TOKEN',
    'GH_TOKEN',
    'PAGES_SITE_URL',
  ]) {
    delete processEnvironment[name]
  }

  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: directory,
      env: {
        ...processEnvironment,
        COMPLETE_ISSUE_POLL_INTERVAL_MS: '10',
        COMPLETE_ISSUE_SITE_TIMEOUT_MS: '3000',
        COMPLETE_ISSUE_WORKFLOW_TIMEOUT_MS: '3000',
        ...environment,
      },
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    child.once('error', rejectRun)
    child.once('close', (status) => {
      resolveRun({
        output: `${stdout}\n${stderr}`,
        status,
      })
    })
  })
}

function deploymentEnvironment(origin) {
  return {
    GITHUB_API_URL: origin,
    GITHUB_REPOSITORY: 'test-owner/test-repo',
    GITHUB_TOKEN: 'test-token',
    PAGES_SITE_URL: `${origin}/`,
  }
}

function remoteMain(repository) {
  return git(repository.remote, ['rev-parse', 'refs/heads/main'])
}

afterEach(async () => {
  for (const server of servers.splice(0)) {
    await new Promise((resolveClose) => {
      server.close(resolveClose)
      server.closeAllConnections()
    })
  }
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

describe('complete-issue', { timeout: 90_000 }, () => {
  it('自动收敛 task 分支、发布 main，并验证 workflow 与线上版本', async () => {
    const repository = createRepository({ mergeActive: false })
    const targetSha = git(repository.active, ['rev-parse', 'HEAD'])
    const deployment = await createDeploymentServer({ targetSha })

    const result = await runComplete(
      repository.active,
      ['--authorize-main-push'],
      deploymentEnvironment(deployment.origin),
    )

    expect(result.status).toBe(0)
    expect(remoteMain(repository)).toBe(targetSha)
    expect(git(repository.primary, ['rev-parse', 'HEAD'])).toBe(targetSha)
    expect(currentBranch(repository.primary)).toBe('main')
    expect(git(repository.primary, ['rev-parse', repository.persistent])).toBe(targetSha)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(false)
    expect(branchExists(repository.primary, repository.activeTask)).toBe(true)
    expect(deployment.requests.workflow).toBeGreaterThan(0)
    expect(deployment.requests.site).toBeGreaterThan(0)
    expect(result.output).toContain('Pages workflow 成功')
    expect(result.output).toContain('Pages 线上版本已验证')
  })

  it('重复触发时保持幂等，并继续验证原提交的发布结果', async () => {
    const repository = createRepository()
    const targetSha = git(repository.primary, ['rev-parse', repository.persistent])
    const deployment = await createDeploymentServer({ targetSha })
    const environment = deploymentEnvironment(deployment.origin)

    const first = await runComplete(repository.active, ['--authorize-main-push'], environment)
    const second = await runComplete(repository.active, ['--authorize-main-push'], environment)

    expect(first.status).toBe(0)
    expect(second.status).toBe(0)
    expect(deployment.requests.workflow).toBeGreaterThanOrEqual(2)
    expect(deployment.requests.site).toBeGreaterThanOrEqual(2)
    expect(second.output).toContain('无需重复推送')
    expect(remoteMain(repository)).toBe(targetSha)
  })

  it('没有明确授权时不删除分支、不推送、不访问网络', async () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)

    const result = await runComplete(repository.active, [], {})

    expect(result.status).toBe(2)
    expect(result.output).toContain('--authorize-main-push')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
    expect(currentBranch(repository.primary)).toBe(repository.persistent)
  })

  it('dry-run 只报告收敛、清理、推送和发布验证计划', async () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)

    const result = await runComplete(repository.active, ['--dry-run'], {
      GITHUB_REPOSITORY: 'test-owner/test-repo',
      PAGES_SITE_URL: 'https://example.test/',
    })

    expect(result.status).toBe(0)
    expect(result.output).toContain('dry-run')
    expect(result.output).toContain('version.json')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
    expect(currentBranch(repository.primary)).toBe(repository.persistent)
  })

  it('主检出不干净时在清理和推送前拒绝', async () => {
    const repository = createRepository()
    const remoteBefore = remoteMain(repository)
    writeFileSync(join(repository.primary, 'dirty.txt'), 'dirty\n')

    const result = await runComplete(repository.active, ['--authorize-main-push'], {})

    expect(result.status).toBe(1)
    expect(result.output).toContain('存在未提交改动')
    expect(remoteMain(repository)).toBe(remoteBefore)
    expect(branchExists(repository.primary, repository.previousTask)).toBe(true)
  })

  it('workflow 失败时返回 Actions 链接且不检查线上版本', async () => {
    const repository = createRepository()
    const targetSha = git(repository.primary, ['rev-parse', repository.persistent])
    const deployment = await createDeploymentServer({ targetSha, workflow: 'failure' })

    const result = await runComplete(
      repository.active,
      ['--authorize-main-push'],
      deploymentEnvironment(deployment.origin),
    )

    expect(result.status).toBe(1)
    expect(result.output).toContain('actions/runs/123')
    expect(result.output).toContain('Pages workflow 失败')
    expect(deployment.requests.site).toBe(0)
    expect(remoteMain(repository)).toBe(targetSha)
  })

  it('workflow 始终未出现时超时失败', async () => {
    const repository = createRepository()
    const targetSha = git(repository.primary, ['rev-parse', repository.persistent])
    const deployment = await createDeploymentServer({ targetSha, workflow: 'timeout' })

    const result = await runComplete(repository.active, ['--authorize-main-push'], {
      ...deploymentEnvironment(deployment.origin),
      COMPLETE_ISSUE_WORKFLOW_TIMEOUT_MS: '120',
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('已超时')
  })

  it('workflow 成功但线上提交不匹配时超时失败', async () => {
    const repository = createRepository()
    const targetSha = git(repository.primary, ['rev-parse', repository.persistent])
    const deployment = await createDeploymentServer({ targetSha, site: 'mismatch' })

    const result = await runComplete(repository.active, ['--authorize-main-push'], {
      ...deploymentEnvironment(deployment.origin),
      COMPLETE_ISSUE_SITE_TIMEOUT_MS: '120',
    })

    expect(result.status).toBe(1)
    expect(result.output).toContain('线上版本')
    expect(result.output).toContain('未更新到')
  })
})
