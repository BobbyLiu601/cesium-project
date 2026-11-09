import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const projectRoot = resolve(import.meta.dirname, '../..')
const workflowPath = join(projectRoot, '.github/workflows/pages.yml')
const workflow = readFileSync(workflowPath, 'utf8')
const tokenMapping = 'VITE_TIANDITU_TOKEN: ${{ secrets.TIANDITU_TOKEN }}'

describe('pages workflow', () => {
  it('把 TIANDITU_TOKEN 显式映射到 VITE_TIANDITU_TOKEN', () => {
    const mappingCount = workflow.split(tokenMapping).length - 1

    expect(mappingCount).toBe(3)
    expect(workflow).not.toMatch(/secrets\.VITE_TIANDITU_TOKEN/)
  })

  it('在构建前检查映射值去空白后是否为空', () => {
    const checkStepStart = workflow.indexOf('name: Check Tianditu token mapping')
    const nextStepStart = workflow.indexOf('- name: Setup Node.js')
    const checkStep = workflow.slice(checkStepStart, nextStepStart)

    expect(checkStepStart).toBeGreaterThan(-1)
    expect(nextStepStart).toBeGreaterThan(checkStepStart)
    expect(checkStep).toContain(
      `normalized_token="$(printf '%s' "$VITE_TIANDITU_TOKEN" | tr -d '[:space:]')"`,
    )
    expect(checkStep).toContain('::warning::VITE_TIANDITU_TOKEN is missing or blank')
    expect(checkStep).toContain('exit 0')
  })
})
