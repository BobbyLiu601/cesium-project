import { execFileSync, spawnSync } from 'node:child_process'

const TASK_BRANCH_PATTERN = /^agent\/([^/]+)\/(.+)-([0-9a-fA-F]{12})$/

export const MAIN_BRANCH = 'main'

// Git hooks export worktree-specific paths; never leak them into another worktree.
function gitEnvironment() {
  const environment = { ...process.env }
  for (const variable of [
    'GIT_ALTERNATE_OBJECT_DIRECTORIES',
    'GIT_COMMON_DIR',
    'GIT_DIR',
    'GIT_INDEX_FILE',
    'GIT_NAMESPACE',
    'GIT_OBJECT_DIRECTORY',
    'GIT_PREFIX',
    'GIT_WORK_TREE',
  ]) {
    delete environment[variable]
  }
  return environment
}

function runGit(cwd, args) {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: gitEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

export function gitStatus(cwd, args) {
  return spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: gitEnvironment(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

export function revParse(cwd, revision) {
  return runGit(cwd, ['rev-parse', '--verify', `${revision}^{commit}`])
}

export function branchExists(cwd, branch) {
  return gitStatus(cwd, ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`]).status === 0
}

export function listLocalBranches(cwd) {
  const output = runGit(cwd, ['for-each-ref', '--format=%(refname:short)', 'refs/heads'])
  return output ? output.split(/\r?\n/) : []
}

export function isTaskBranch(branch) {
  return TASK_BRANCH_PATTERN.test(branch)
}

export function parseTaskBranch(branch) {
  const match = TASK_BRANCH_PATTERN.exec(branch)
  if (!match) {
    return null
  }

  return {
    agent: match[1],
    issueKey: match[2],
    taskSuffix: match[3],
    baseBranch: `agent/${match[1]}/${match[2]}`,
  }
}

export function isFallbackBranch(branch) {
  return isTaskBranch(branch)
}

export function parseFallbackBranch(branch) {
  return parseTaskBranch(branch)
}

export function taskBranchBase(branch) {
  return parseTaskBranch(branch)?.baseBranch ?? ''
}

export function listTaskBranchesForBase(cwd, baseBranch) {
  return listLocalBranches(cwd).filter((branch) => taskBranchBase(branch) === baseBranch)
}

export function isAncestor(cwd, ancestor, descendant) {
  const result = gitStatus(cwd, ['merge-base', '--is-ancestor', ancestor, descendant])
  if (result.status === 0) {
    return true
  }
  if (result.status === 1) {
    return false
  }

  throw new Error(`无法判断祖先关系：${result.stderr.trim() || 'git merge-base 执行失败'}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Resolve the persistent task branch for a transient fallback branch.
 *
 * The explicit target always wins. Otherwise branches named
 * agent/<agent>/<issue-key> are candidates; when more than one exists, only a
 * candidate that already contains the fallback tip is considered unambiguous.
 */
export function resolvePersistentBranch({ cwd, fallbackBranch, fallbackTip, target }) {
  const fallback = parseTaskBranch(fallbackBranch)
  if (!fallback) {
    throw new Error(`分支 ${fallbackBranch} 不是带 task id 后缀的 task 分支`)
  }

  const branches = listLocalBranches(cwd)
  const candidatePattern = new RegExp(`^agent/[^/]+/${escapeRegExp(fallback.issueKey)}$`)
  const candidates = branches.filter((branch) => candidatePattern.test(branch))

  if (target) {
    if (target === fallbackBranch) {
      throw new Error('目标分支不能与 fallback 相同')
    }
    if (target === MAIN_BRANCH) {
      throw new Error('禁止把 fallback 自动合并到 main')
    }
    if (isFallbackBranch(target)) {
      throw new Error('目标分支不能是 task 分支')
    }
    if (!branches.includes(target)) {
      throw new Error(`目标分支 ${target} 不存在`)
    }

    return { target, candidates, source: 'explicit' }
  }

  if (candidates.length === 0) {
    throw new Error(
      `无法确定 ${fallbackBranch} 的持久分支：没有找到 agent/*/${fallback.issueKey}；请用 --target 显式指定`,
    )
  }
  if (candidates.includes(fallback.baseBranch)) {
    return { target: fallback.baseBranch, candidates, source: 'name' }
  }
  if (candidates.length === 1) {
    return { target: candidates[0], candidates, source: 'name' }
  }

  const tip = fallbackTip ?? revParse(cwd, fallbackBranch)
  const containing = candidates.filter((branch) => isAncestor(cwd, tip, revParse(cwd, branch)))
  if (containing.length === 1) {
    return { target: containing[0], candidates, source: 'contains' }
  }

  throw new Error(
    `无法唯一确定 ${fallbackBranch} 的持久分支，候选为 ${candidates.join(', ')}；请用 --target 显式指定`,
  )
}
