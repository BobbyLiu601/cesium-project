#!/usr/bin/env node

import { resolve } from 'node:path'

import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = resolve(import.meta.dirname, '..')
const scenes = [
  {
    holdKey: 'w',
    id: 'vehicle-motion',
    route: '/effects/physics-engine/3-4-1-vehicle-motion',
  },
  {
    holdKey: 'q',
    id: 'flag-rotation',
    route: '/effects/physics-engine/3-4-2-flag-rotation',
  },
  {
    holdKey: 'q',
    id: 'ball-rotation',
    route: '/effects/physics-engine/3-4-3-ball-rotation',
  },
  {
    fire: true,
    id: 'soft-body-collision',
    route: '/effects/physics-engine/3-4-4-soft-body-collision',
  },
  {
    fire: true,
    id: 'fracture-collision',
    route: '/effects/physics-engine/3-4-5-fracture-collision',
  },
]

function printHelp() {
  console.log(`Usage: node scripts/benchmark-physics.mjs [options]

Runs the five 3.4 physics demos in Chromium at 1920x1080 and reports frame pacing.
The browser is headful by default so Chromium can use the hardware GPU.

Options:
  --scene <id>       Benchmark one scene (repeatable)
  --seconds <n>      Measured duration per scene, default 10
  --settle <ms>      Warm-up before measuring, default 6000
  --port <n>         Vite port, default 4175
  --headless         Run headless (useful for smoke checks, not FPS validation)
  --json             Print only the JSON summary
  --help             Show this help

Scene ids: ${scenes.map((scene) => scene.id).join(', ')}

This command is a local benchmark, not a CI FPS gate. It exits successfully
after collecting results even when a scene misses the 30 FPS target.`)
}

function parseNumber(value, option) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) {
    throw new Error(`${option} expects a positive number`)
  }
  return number
}

function parseArgs(argv) {
  const options = {
    headless: false,
    help: false,
    json: false,
    port: 4175,
    sceneIds: [],
    seconds: 10,
    settleMs: 6_000,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (argument === '--headless') {
      options.headless = true
    } else if (argument === '--json') {
      options.json = true
    } else if (argument === '--help') {
      options.help = true
    } else if (argument === '--scene') {
      const sceneId = argv[index + 1]
      if (!scenes.some((scene) => scene.id === sceneId)) {
        throw new Error(`Unknown scene: ${sceneId ?? '(missing)'}`)
      }
      options.sceneIds.push(sceneId)
      index += 1
    } else if (argument === '--seconds') {
      options.seconds = parseNumber(argv[index + 1], argument)
      index += 1
    } else if (argument === '--settle') {
      options.settleMs = parseNumber(argv[index + 1], argument)
      index += 1
    } else if (argument === '--port') {
      options.port = parseNumber(argv[index + 1], argument)
      index += 1
    } else {
      throw new Error(`Unknown option: ${argument}`)
    }
  }

  return options
}

function percentile(values, ratio) {
  if (values.length === 0) {
    return 0
  }
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))]
}

function summarize(sceneId, frameTimes, performanceMetrics) {
  const intervals = frameTimes.slice(1).map((time, index) => time - frameTimes[index])
  const duration = frameTimes.at(-1) - frameTimes[0]
  const meanFrameMs = intervals.reduce((total, value) => total + value, 0) / intervals.length
  const averageFps = 1_000 / meanFrameMs
  const p95FrameMs = percentile(intervals, 0.95)

  return {
    averageFps: Number(averageFps.toFixed(1)),
    durationSeconds: Number((duration / 1_000).toFixed(2)),
    framesOver50ms: intervals.filter((value) => value > 50).length,
    id: sceneId,
    maxFrameMs: Number(Math.max(...intervals).toFixed(1)),
    meanFrameMs: Number(meanFrameMs.toFixed(1)),
    p95FrameMs: Number(p95FrameMs.toFixed(1)),
    scriptDurationSeconds: Number(performanceMetrics.scriptDurationSeconds.toFixed(2)),
    targetMet: averageFps >= 30 && p95FrameMs <= 50,
    taskDurationSeconds: Number(performanceMetrics.taskDurationSeconds.toFixed(2)),
  }
}

function metricDelta(before, after, name) {
  return (after.get(name) ?? 0) - (before.get(name) ?? 0)
}

async function readGpuRenderer(page) {
  return page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') ?? canvas.getContext('webgl')
    if (!context) {
      return 'WebGL unavailable'
    }
    const extension = context.getExtension('WEBGL_debug_renderer_info')
    return extension
      ? String(context.getParameter(extension.UNMASKED_RENDERER_WEBGL))
      : String(context.getParameter(context.RENDERER))
  })
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    printHelp()
    return
  }

  const selectedScenes =
    options.sceneIds.length > 0
      ? scenes.filter((scene) => options.sceneIds.includes(scene.id))
      : scenes
  const server = await createServer({
    root,
    configFile: resolve(root, 'vite.config.ts'),
    cacheDir: resolve(root, '.cache/vite-physics-benchmark'),
    configLoader: 'native',
    logLevel: 'warn',
    server: {
      host: '127.0.0.1',
      port: options.port,
      strictPort: true,
    },
  })

  let browser
  try {
    await server.listen()
    browser = await chromium.launch({
      args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
      headless: options.headless,
    })
    const context = await browser.newContext({
      deviceScaleFactor: 1,
      viewport: { height: 1_080, width: 1_920 },
    })
    const page = await context.newPage()
    await page.route(/https:\/\/(?:t\d|api)\.tianditu\.gov\.cn\//, (route) => route.abort())
    await page.route(/https:\/\/elevation3d\.arcgis\.com\//, (route) => route.abort())

    const cdp = await context.newCDPSession(page)
    await cdp.send('Performance.enable')
    const results = []
    let gpuRenderer

    for (const scene of selectedScenes) {
      await page.goto(`http://127.0.0.1:${options.port}${scene.route}`)
      await page.bringToFront()
      const globe = page.getByTestId('physics-engine-demo-globe')
      await globe.waitFor({ state: 'visible' })
      await page
        .locator('[data-testid="physics-engine-demo-globe"][data-cesium-state="ready"]')
        .waitFor({ state: 'visible', timeout: 30_000 })
      await page.waitForTimeout(options.settleMs)
      gpuRenderer ??= await readGpuRenderer(page)

      const metricsBefore = new Map(
        (await cdp.send('Performance.getMetrics')).metrics.map((metric) => [
          metric.name,
          metric.value,
        ]),
      )
      if (scene.holdKey) {
        await page.keyboard.down(scene.holdKey)
      }

      const measurement = page.evaluate(
        (durationMs) =>
          new Promise((resolveFrameTimes) => {
            const times = []
            let startedAt
            const sample = (time) => {
              startedAt ??= time
              times.push(time)
              if (time - startedAt < durationMs) {
                requestAnimationFrame(sample)
                return
              }
              resolveFrameTimes(times)
            }
            requestAnimationFrame(sample)
          }),
        options.seconds * 1_000,
      )

      if (scene.fire) {
        const canvas = globe.locator('canvas')
        const box = await canvas.boundingBox()
        const firePosition = {
          x: (box?.width ?? 0) * 0.72,
          y: (box?.height ?? 0) * 0.62,
        }
        await canvas.click({ position: firePosition })
        for (let elapsed = 3_000; elapsed < options.seconds * 1_000; elapsed += 3_000) {
          await page.waitForTimeout(3_000)
          await canvas.click({ position: firePosition })
        }
      }

      const frameTimes = await measurement
      if (scene.holdKey) {
        await page.keyboard.up(scene.holdKey)
      }
      const metricsAfter = new Map(
        (await cdp.send('Performance.getMetrics')).metrics.map((metric) => [
          metric.name,
          metric.value,
        ]),
      )
      results.push(
        summarize(scene.id, frameTimes, {
          scriptDurationSeconds: metricDelta(metricsBefore, metricsAfter, 'ScriptDuration'),
          taskDurationSeconds: metricDelta(metricsBefore, metricsAfter, 'TaskDuration'),
        }),
      )
    }

    const summary = {
      durationSeconds: options.seconds,
      gpuRenderer,
      headless: options.headless,
      results,
      settleMs: options.settleMs,
      viewport: { height: 1_080, width: 1_920 },
    }

    if (options.json) {
      console.log(JSON.stringify(summary, null, 2))
    } else {
      console.table(results)
      console.log(JSON.stringify(summary, null, 2))
      if (results.some((result) => !result.targetMet)) {
        console.log(
          'At least one scene missed the 30 FPS / p95 50 ms local target; inspect the result above.',
        )
      }
    }
  } finally {
    await browser?.close()
    await server.close()
  }
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
