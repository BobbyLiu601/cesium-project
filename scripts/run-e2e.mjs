import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const server = await createServer({
  root,
  configFile: resolve(root, 'vite.config.ts'),
  cacheDir: resolve(root, '.cache/vite-e2e'),
  configLoader: 'native',
  logLevel: 'warn',
  server: {
    host: '127.0.0.1',
    port: 4173,
    strictPort: true,
  },
})

let exitCode = 1

try {
  await server.listen()

  // Keep E2E cache isolated from Vitest and pretransform the entry graph before
  // Playwright's per-test timeout starts.
  await server.warmupRequest('/src/main.ts')

  const warmupBrowser = await chromium.launch()
  try {
    const warmupPage = await warmupBrowser.newPage()
    await warmupPage.goto('http://127.0.0.1:4173/', {
      timeout: 180_000,
      waitUntil: 'domcontentloaded',
    })
  } finally {
    await warmupBrowser.close()
  }

  exitCode = await new Promise((resolveExit, reject) => {
    const playwright = spawn(
      process.execPath,
      [resolve(root, 'node_modules/@playwright/test/cli.js'), 'test'],
      {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
      },
    )

    playwright.once('error', reject)
    playwright.once('exit', (code) => resolveExit(code ?? 1))
  })
} finally {
  await server.close()
}

process.exitCode = exitCode
