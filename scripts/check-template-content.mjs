#!/usr/bin/env node

import { existsSync, statSync } from 'node:fs'
import { readFile, readdir } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'

import { parse } from '@vue/compiler-sfc'

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

const BUTTON_TAGS = new Set(['button', 'el-button', 'elbutton'])

const BLOCK_LEVEL_TAGS = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'dd',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hgroup',
  'hr',
  'li',
  'main',
  'menu',
  'nav',
  'ol',
  'p',
  'pre',
  'search',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])

const INTERACTIVE_TAGS = new Set([
  'area',
  'button',
  'details',
  'el-button',
  'elbutton',
  'embed',
  'iframe',
  'input',
  'label',
  'object',
  'select',
  'summary',
  'textarea',
])

function printHelp() {
  console.log(`用法：node scripts/check-template-content.mjs [选项]

校验 Vue 单文件组件模板中 button 的 HTML 内容模型。

选项：
  --root <目录>  指定扫描根目录，默认为当前工作目录
  --help         显示帮助

退出码：
  0  未发现问题
  1  发现无效内容模型
`)
}

function parseArgs(argv) {
  const options = {
    root: process.cwd(),
    help: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--root') {
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

function toDisplayPath(root, filePath) {
  return relative(root, filePath).split(sep).join('/')
}

async function collectVueFiles(root) {
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
      } else if (entry.isFile() && entry.name.endsWith('.vue')) {
        files.push(entryPath)
      }
    }
  }

  return files.sort()
}

function walk(node, visit, seen = new WeakSet()) {
  if (!node || typeof node !== 'object' || seen.has(node)) {
    return
  }

  seen.add(node)
  visit(node)

  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc' || key === 'parent') {
      continue
    }

    if (Array.isArray(value)) {
      for (const child of value) {
        walk(child, visit, seen)
      }
    } else if (value && typeof value === 'object') {
      walk(value, visit, seen)
    }
  }
}

function hasAttribute(node, name) {
  return (node.props ?? []).some((prop) => {
    return (prop.type === 6 && prop.name === name) || (prop.type === 7 && prop.name === name)
  })
}

function isInteractive(node, tag) {
  if (INTERACTIVE_TAGS.has(tag)) {
    return true
  }

  if (tag === 'a') {
    return hasAttribute(node, 'href')
  }

  if (tag === 'audio' || tag === 'video') {
    return hasAttribute(node, 'controls')
  }

  return false
}

function describeNode(node) {
  return `<${node.tag}>`
}

function checkTemplate(filePath, templateAst) {
  const findings = []

  walk(templateAst, (node) => {
    if (node.type !== 1 || typeof node.tag !== 'string') {
      return
    }

    const buttonTag = node.tag.toLowerCase()
    if (!BUTTON_TAGS.has(buttonTag)) {
      return
    }

    walk(node, (child) => {
      if (child === node || child.type !== 1 || typeof child.tag !== 'string') {
        return
      }

      const tag = child.tag.toLowerCase()
      if (BLOCK_LEVEL_TAGS.has(tag)) {
        findings.push({
          file: filePath,
          line: child.loc?.start?.line ?? 1,
          column: child.loc?.start?.column ?? 1,
          message: `${describeNode(node)} 内不能包含块级元素 ${describeNode(child)}。请改用行内元素，或把块级内容移到按钮外。`,
        })
      } else if (isInteractive(child, tag)) {
        findings.push({
          file: filePath,
          line: child.loc?.start?.line ?? 1,
          column: child.loc?.start?.column ?? 1,
          message: `${describeNode(node)} 内不能包含交互元素 ${describeNode(child)}。按钮内不能嵌套可聚焦或可点击控件。`,
        })
      }
    })
  })

  return findings
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

  const files = await collectVueFiles(root)
  const findings = []

  for (const filePath of files) {
    const displayPath = toDisplayPath(root, filePath)
    const source = await readFile(filePath, 'utf8')

    try {
      const { descriptor, errors } = parse(source, { filename: filePath })
      if (errors.length > 0) {
        findings.push({
          file: displayPath,
          line: errors[0].loc?.start?.line ?? 1,
          column: errors[0].loc?.start?.column ?? 1,
          message: `Vue 模板解析失败：${errors[0].message}`,
        })
        continue
      }

      if (descriptor.template?.ast) {
        findings.push(...checkTemplate(displayPath, descriptor.template.ast))
      }
    } catch (error) {
      findings.push({
        file: displayPath,
        line: 1,
        column: 1,
        message: `Vue 模板解析失败：${error instanceof Error ? error.message : String(error)}`,
      })
    }
  }

  if (findings.length === 0) {
    console.log(`模板内容模型校验通过：已检查 ${files.length} 个 Vue 文件。`)
    return
  }

  console.error(`模板内容模型校验失败：发现 ${findings.length} 个问题。`)
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line}:${finding.column} ${finding.message}`)
  }
  process.exitCode = 1
}

main().catch((error) => {
  console.error(`模板内容模型校验出错：${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 2
})
