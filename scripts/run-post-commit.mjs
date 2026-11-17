#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

const finalizeScript = join(import.meta.dirname, 'finalize-task-branch.mjs')
const result = spawnSync(process.execPath, [finalizeScript, '--after-commit'], {
  cwd: process.cwd(),
  stdio: 'inherit',
})

if (result.error) {
  console.error(`[branch-sync] 无法启动同步命令：${result.error.message}`)
  process.exitCode = 1
} else {
  process.exitCode = result.status ?? 1
}
