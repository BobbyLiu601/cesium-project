#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runSecretLint } from 'secretlint'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDir, '..')
const allowlistPath = join(scriptDir, 'secret-allowlist.json')

const SKIP_DIRECTORIES = new Set([
  '.cache',
  '.git',
  'blob-report',
  'coverage',
  'dist',
  'dist-ssr',
  'node_modules',
  'playwright-report',
  'test-results',
])

const BINARY_EXTENSIONS = new Set([
  '.avif',
  '.bin',
  '.bmp',
  '.class',
  '.dll',
  '.dylib',
  '.eot',
  '.exe',
  '.gif',
  '.gz',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.mp3',
  '.mp4',
  '.ogg',
  '.otf',
  '.pdf',
  '.png',
  '.so',
  '.ttf',
  '.wasm',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.zip',
  '.7z',
])

const MAX_SCAN_BYTES = 2 * 1024 * 1024

const PLACEHOLDER_PATTERNS = [
  /^$/,
  /^your[-_].*/i,
  /^<.*>$/,
  /^change[-_]?me$/i,
  /^replace[-_]?me$/i,
  /^example([-_].*)?$/i,
  /^placeholder([-_].*)?$/i,
  /^x{4,}$/i,
  /^\$\{.*\}$/,
  /^\$[A-Za-z_][A-Za-z0-9_]*$/,
  /^todo$/i,
]

const TIANDITU_ENV_PATTERN = /\bVITE_TIANDITU_TOKEN\s*=\s*([^\s#]+)/g
const TIANDITU_URL_TOKEN_PATTERN = /[?&]tk=([A-Za-z0-9]{16,})/g

function printHelp() {
  console.log(`用法：node scripts/check-secrets.mjs [选项]

扫描工作区或暂存区中的常见凭据，以及非空、非占位的天地图 token 配置。

选项：
  --staged       只扫描本次暂存的文件（pre-commit 使用）
  --root <目录>  指定扫描根目录，默认为当前工作目录
  --walk         强制遍历文件系统，不依赖 git 文件列表
  --help         显示帮助

退出码：
  0  未发现问题
  1  发现疑似凭据
  2  扫描过程出错
`)
}

function parseArgs(argv) {
  const options = {
    staged: false,
    walk: false,
    root: process.cwd(),
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--staged') {
      options.staged = true
    } else if (argument === '--walk') {
      options.walk = true
    } else if (argument === '--root') {
      const value = argv[index + 1]
      if (!value) {
        throw new Error('--root 需要一个目录参数')
      }
      options.root = value
      index += 1
    } else if (argument === '--help') {
      options.help = true
    } else {
      throw new Error(`未知参数：${argument}`)
    }
  }

  return options
}

async function readAllowlist() {
  if (!existsSync(allowlistPath)) {
    return new Set()
  }

  const parsed = JSON.parse(await readFile(allowlistPath, 'utf8'))
  const values = Array.isArray(parsed.tiandituTokens) ? parsed.tiandituTokens : []
  return new Set(values.filter((value) => typeof value === 'string'))
}

function toDisplayPath(root, filePath) {
  return relative(root, filePath).split(sep).join('/')
}

function normalizeValue(rawValue) {
  return rawValue.replace(/^['"]/, '').replace(/['"]$/, '').trim()
}

function isAllowedTiandituValue(value, allowlist) {
  return (
    value.length === 0 ||
    allowlist.has(value) ||
    PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(value))
  )
}

function scanTiandituTokens(filePath, content, allowlist) {
  const findings = []
  const lines = content.split(/\r?\n/)

  for (const [index, line] of lines.entries()) {
    for (const match of line.matchAll(TIANDITU_ENV_PATTERN)) {
      const value = normalizeValue(match[1] ?? '')
      if (isAllowedTiandituValue(value, allowlist)) {
        continue
      }

      findings.push({
        file: filePath,
        line: index + 1,
        rule: 'tianditu-token',
        fix: '移除真实天地图 token，改用空白占位符、GitHub Environment Secret 或显式 allowlist 中的测试假值。',
      })
    }

    for (const match of line.matchAll(TIANDITU_URL_TOKEN_PATTERN)) {
      const value = normalizeValue(match[1] ?? '')
      if (isAllowedTiandituValue(value, allowlist)) {
        continue
      }

      findings.push({
        file: filePath,
        line: index + 1,
        rule: 'tianditu-url-token',
        fix: '不要在 URL 或文档中硬编码天地图 token；请使用环境变量注入，并轮换已经暴露的值。',
      })
    }
  }

  return findings
}

async function scanCommonSecrets(files, root) {
  if (files.length === 0) {
    return []
  }

  const result = await runSecretLint({
    cliOptions: {
      cwd: projectRoot,
      filePathOrGlobList: files,
      noGlob: true,
      respectGitignore: false,
    },
    engineOptions: {
      cwd: projectRoot,
      formatter: 'json',
      color: false,
      maskSecrets: true,
      configFileJSON: {
        rules: [{ id: '@secretlint/secretlint-rule-preset-recommend' }],
      },
    },
  })

  if (result.stderr) {
    throw result.stderr
  }

  if (!result.stdout) {
    return []
  }

  let parsed
  try {
    parsed = JSON.parse(result.stdout)
  } catch {
    throw new Error('secretlint 输出无法解析，已停止扫描以避免泄露原文')
  }

  const findings = []
  for (const fileResult of parsed) {
    const filePath = resolve(fileResult.filePath ?? '')
    for (const message of fileResult.messages ?? []) {
      if (message.severity !== 'error') {
        continue
      }

      findings.push({
        file: toDisplayPath(root, filePath),
        line: message.loc?.start?.line ?? 1,
        rule: message.ruleId ?? 'secretlint',
        fix: '移除该凭据并轮换泄露值，改用环境变量或 GitHub Environment Secret 注入。',
      })
    }
  }

  return findings
}

function isScannableFile(filePath) {
  if (BINARY_EXTENSIONS.has(extname(filePath).toLowerCase())) {
    return false
  }

  try {
    const stats = statSync(filePath)
    return stats.isFile() && stats.size <= MAX_SCAN_BYTES
  } catch {
    return false
  }
}

function listGitFiles(root, staged) {
  const args = staged
    ? ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']
    : ['ls-files', '-z', '-co', '--exclude-standard']

  const output = execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })

  return output.split('\0').filter(Boolean)
}

async function walkFiles(root) {
  const files = []
  const directories = [root]

  while (directories.length > 0) {
    const directory = directories.pop()
    const entries = await readdir(directory, { withFileTypes: true })

    for (const entry of entries) {
      if (entry.isSymbolicLink()) {
        continue
      }

      const entryPath = join(directory, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP_DIRECTORIES.has(entry.name)) {
          directories.push(entryPath)
        }
      } else if (entry.isFile()) {
        files.push(entryPath)
      }
    }
  }

  return files
}

function deduplicate(findings) {
  const seen = new Set()
  return findings.filter((finding) => {
    const key = `${finding.file}:${finding.line}:${finding.rule}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const root = resolve(options.root)
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new Error(`扫描根目录不存在或不是目录：${root}`)
  }

  const allowlist = await readAllowlist()
  let relativeFiles
  let scope

  if (options.staged) {
    relativeFiles = listGitFiles(root, true)
    scope = '暂存区'
  } else if (options.walk) {
    relativeFiles = await walkFiles(root)
    scope = '工作区（文件系统遍历）'
  } else {
    try {
      relativeFiles = listGitFiles(root, false)
      scope = '工作区（Git 跟踪与未忽略文件）'
    } catch {
      relativeFiles = await walkFiles(root)
      scope = '工作区（文件系统遍历）'
    }
  }

  const files = relativeFiles.map((filePath) => resolve(root, filePath)).filter(isScannableFile)
  const findings = []

  for (const filePath of files) {
    const content = await readFile(filePath, 'utf8')
    findings.push(...scanTiandituTokens(toDisplayPath(root, filePath), content, allowlist))
  }

  findings.push(...(await scanCommonSecrets(files, root)))

  const uniqueFindings = deduplicate(findings).sort((left, right) => {
    return (
      left.file.localeCompare(right.file) ||
      left.line - right.line ||
      left.rule.localeCompare(right.rule)
    )
  })

  if (uniqueFindings.length === 0) {
    console.log(`密钥扫描通过：已检查 ${scope} 的 ${files.length} 个文件。`)
    return
  }

  console.error(
    `密钥扫描失败：在 ${scope} 中发现 ${uniqueFindings.length} 个问题。命中的凭据均已遮罩。`,
  )
  for (const finding of uniqueFindings) {
    console.error(`- ${finding.file}:${finding.line} [${finding.rule}] ${finding.fix}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`密钥扫描出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
})
