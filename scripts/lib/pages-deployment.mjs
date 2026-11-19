import { spawnSync } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'

import { gitEnvironment } from './task-branches.mjs'

const SHA_PATTERN = /^[0-9a-f]{40}$/i
const DEFAULT_API_URL = 'https://api.github.com'
const REQUEST_TIMEOUT_MS = 30_000

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, '')
}

function ensureTrailingSlash(value) {
  return value.endsWith('/') ? value : `${value}/`
}

function parsePositiveInteger(value, fallback, name) {
  if (value === undefined || value === '') {
    return fallback
  }

  const parsed = Number(value)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} 必须是正整数，当前值为 ${value}`)
  }
  return parsed
}

export function deploymentTiming(environment = process.env) {
  return {
    pollIntervalMs: parsePositiveInteger(
      environment.COMPLETE_ISSUE_POLL_INTERVAL_MS,
      5_000,
      'COMPLETE_ISSUE_POLL_INTERVAL_MS',
    ),
    workflowTimeoutMs: parsePositiveInteger(
      environment.COMPLETE_ISSUE_WORKFLOW_TIMEOUT_MS,
      20 * 60_000,
      'COMPLETE_ISSUE_WORKFLOW_TIMEOUT_MS',
    ),
    siteTimeoutMs: parsePositiveInteger(
      environment.COMPLETE_ISSUE_SITE_TIMEOUT_MS,
      8 * 60_000,
      'COMPLETE_ISSUE_SITE_TIMEOUT_MS',
    ),
  }
}

export function parseGitHubRepository(remoteUrl) {
  const value = remoteUrl.trim()
  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^git@github\.com:([^/]+)\/([^/]+?)(?:\.git)?$/i,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
    /^github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?\/?$/i,
  ]

  for (const pattern of patterns) {
    const match = pattern.exec(value)
    if (match) {
      return {
        owner: decodeURIComponent(match[1]),
        repo: decodeURIComponent(match[2]),
      }
    }
  }

  throw new Error(`无法从远端地址解析 GitHub 仓库：${value}`)
}

export function resolveGitHubContext({ remoteUrl, environment = process.env }) {
  const repositoryValue = environment.GITHUB_REPOSITORY?.trim()
  let repository
  if (repositoryValue) {
    const match = /^([^/]+)\/([^/]+)$/.exec(repositoryValue)
    if (!match) {
      throw new Error(`GITHUB_REPOSITORY 格式无效：${repositoryValue}`)
    }
    repository = { owner: match[1], repo: match[2] }
  } else {
    repository = parseGitHubRepository(remoteUrl)
  }

  const apiUrl = trimTrailingSlash(environment.GITHUB_API_URL?.trim() || DEFAULT_API_URL)
  const siteUrl = ensureTrailingSlash(
    environment.PAGES_SITE_URL?.trim() ||
      `https://${repository.owner.toLowerCase()}.github.io/${encodeURIComponent(repository.repo)}/`,
  )

  return {
    apiUrl,
    owner: repository.owner,
    repo: repository.repo,
    siteUrl,
  }
}

export function resolveGitHubToken(repoRoot, environment = process.env) {
  const configuredToken = environment.GITHUB_TOKEN?.trim() || environment.GH_TOKEN?.trim()
  if (configuredToken) {
    return configuredToken
  }

  const result = spawnSync('git', ['credential', 'fill'], {
    cwd: repoRoot,
    encoding: 'utf8',
    env: gitEnvironment(),
    input: 'protocol=https\nhost=github.com\n\n',
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  if (result.status !== 0) {
    return ''
  }

  const passwordLine = result.stdout.split(/\r?\n/).find((line) => line.startsWith('password='))
  return passwordLine ? passwordLine.slice('password='.length) : ''
}

function githubHeaders(token) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'cesium-complete-issue',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }
  return headers
}

async function requestJson(url, { headers, timeoutMs = REQUEST_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      headers,
      signal: controller.signal,
    })
    const text = await response.text()
    let body = null

    if (text) {
      try {
        body = JSON.parse(text)
      } catch {
        body = null
      }
    }

    if (!response.ok) {
      const rateLimited =
        response.status === 429 ||
        (response.status === 403 && response.headers.get('x-ratelimit-remaining') === '0')
      const message = body?.message || text.trim() || response.statusText
      const error = new Error(
        `HTTP ${response.status}${message ? `：${message}` : ''}${
          rateLimited ? '；请设置 GITHUB_TOKEN，或确保 Git 凭据管理器可访问 GitHub。' : ''
        }`,
      )
      error.status = response.status
      error.retryable = response.status === 429 || response.status >= 500
      throw error
    }

    if (!body) {
      throw new Error('GitHub API 返回了无法解析的 JSON')
    }
    return body
  } catch (error) {
    if (error.name === 'AbortError') {
      const timeoutError = new Error(`请求超时：${url}`)
      timeoutError.retryable = true
      throw timeoutError
    }
    if (error.retryable === undefined) {
      error.retryable = true
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function workflowRunUrl(context, run) {
  return (
    run.html_url || `https://github.com/${context.owner}/${context.repo}/actions/runs/${run.id}`
  )
}

function workflowStatus(run) {
  return run.conclusion ? `${run.status}/${run.conclusion}` : run.status
}

export async function waitForPagesWorkflow({
  context,
  targetSha,
  token,
  pollIntervalMs,
  timeoutMs,
  log = console.log,
}) {
  if (!SHA_PATTERN.test(targetSha)) {
    throw new Error(`目标提交不是完整的 Git SHA：${targetSha}`)
  }

  const workflowId = 'pages.yml'
  const query = new URLSearchParams({
    event: 'push',
    head_sha: targetSha,
    per_page: '100',
  })
  const endpoint = `${context.apiUrl}/repos/${context.owner}/${context.repo}/actions/workflows/${workflowId}/runs?${query}`
  const deadline = Date.now() + timeoutMs
  let lastError = ''
  let lastStatus = 'waiting'
  let lastRun = null

  while (Date.now() <= deadline) {
    try {
      const body = await requestJson(endpoint, {
        headers: githubHeaders(token),
        timeoutMs: Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())),
      })
      const runs = Array.isArray(body.workflow_runs) ? body.workflow_runs : []
      const run = runs.find(
        (candidate) =>
          candidate.head_sha === targetSha &&
          candidate.event === 'push' &&
          candidate.head_branch === 'main',
      )

      if (run) {
        lastRun = run
        const status = workflowStatus(run)
        if (status !== lastStatus) {
          log(`[issue-complete] Pages workflow ${run.id}：${status}`)
          lastStatus = status
        }

        if (run.status === 'completed') {
          if (run.conclusion !== 'success') {
            throw new Error(
              `Pages workflow 失败（${run.conclusion ?? 'unknown'}）：${workflowRunUrl(context, run)}`,
            )
          }
          return run
        }
      } else {
        lastStatus = 'not-found'
      }
      lastError = ''
    } catch (error) {
      if (!error.retryable) {
        throw error
      }
      lastError = error.message
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      break
    }
    await delay(Math.min(pollIntervalMs, remaining))
  }

  const details = [
    `等待 ${targetSha} 对应的 Pages workflow`,
    lastRun
      ? `最后一次状态：${workflowStatus(lastRun)}（${workflowRunUrl(context, lastRun)}）`
      : '',
    lastError ? `最后一次错误：${lastError}` : '',
  ]
    .filter(Boolean)
    .join('；')
  throw new Error(`${details}；已超时 ${timeoutMs}ms`)
}

export async function waitForPublishedCommit({
  context,
  targetSha,
  pollIntervalMs,
  timeoutMs,
  log = console.log,
}) {
  const deadline = Date.now() + timeoutMs
  let lastStatus = 'waiting'
  let lastError = ''

  while (Date.now() <= deadline) {
    const url = new URL('version.json', context.siteUrl)
    url.searchParams.set('cacheBust', `${Date.now()}-${Math.random().toString(16).slice(2)}`)
    const controller = new AbortController()
    const timeout = setTimeout(
      () => controller.abort(),
      Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())),
    )

    try {
      const response = await fetch(url, {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'cesium-complete-issue',
        },
        signal: controller.signal,
      })
      if (!response.ok) {
        lastStatus = `HTTP ${response.status}`
      } else {
        const manifest = await response.json()
        if (manifest?.commit === targetSha) {
          log(`[issue-complete] Pages 线上版本已验证：${targetSha}`)
          return manifest
        }
        lastStatus = `manifest=${manifest?.commit ?? 'missing'}`
      }
      lastError = ''
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
    } finally {
      clearTimeout(timeout)
    }

    const remaining = deadline - Date.now()
    if (remaining <= 0) {
      break
    }
    await delay(Math.min(pollIntervalMs, remaining))
  }

  throw new Error(
    `Pages 线上版本在 ${timeoutMs}ms 内未更新到 ${targetSha}（最后状态：${lastStatus}${
      lastError ? `；最后一次错误：${lastError}` : ''
    }）`,
  )
}
