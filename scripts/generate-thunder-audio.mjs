import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const sampleRate = 22_050
const durationSeconds = 12
const sampleCount = sampleRate * durationSeconds
const outputPath = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../src/assets/audio/thunder.wav',
)

let seed = 0x5eed1234

function random() {
  seed = (1664525 * seed + 1013904223) >>> 0
  return seed / 0x1_0000_0000
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

function thunderBurst(seconds, start) {
  if (seconds < start) {
    return 0
  }

  const elapsed = seconds - start
  if (elapsed > 5.2) {
    return 0
  }

  const crack = Math.exp(-elapsed * 13) * smoothstep(0, 0.025, elapsed)
  const rumble = Math.exp(-elapsed * 0.72) * smoothstep(0, 0.18, elapsed)
  const roll = 0.68 + 0.32 * Math.sin(elapsed * 8.7) * Math.sin(elapsed * 2.3)
  return crack * 0.8 + rumble * roll
}

let lowNoise = 0
let rumbleNoise = 0
const samples = new Int16Array(sampleCount)

for (let index = 0; index < sampleCount; index += 1) {
  const seconds = index / sampleRate
  const white = random() * 2 - 1

  lowNoise += (white - lowNoise) * 0.018
  rumbleNoise += (white - rumbleNoise) * 0.0025

  const envelope =
    thunderBurst(seconds, 0.12) +
    thunderBurst(seconds, 3.65) * 0.78 +
    thunderBurst(seconds, 7.85) * 0.9
  const lowTone =
    Math.sin(2 * Math.PI * 46 * seconds) * 0.22 + Math.sin(2 * Math.PI * 73 * seconds + 0.7) * 0.12
  const tail = 0.004 * Math.sin(2 * Math.PI * 0.18 * seconds)
  const signal =
    (lowNoise * 1.8 + rumbleNoise * 8.5 + lowTone) * envelope * 0.62 + tail * (1 - envelope)
  const shaped = Math.tanh(signal * 1.6) * 0.88

  samples[index] = Math.round(Math.min(1, Math.max(-1, shaped)) * 32767)
}

const dataSize = samples.length * 2
const wav = Buffer.alloc(44 + dataSize)
wav.write('RIFF', 0)
wav.writeUInt32LE(36 + dataSize, 4)
wav.write('WAVE', 8)
wav.write('fmt ', 12)
wav.writeUInt32LE(16, 16)
wav.writeUInt16LE(1, 20)
wav.writeUInt16LE(1, 22)
wav.writeUInt32LE(sampleRate, 24)
wav.writeUInt32LE(sampleRate * 2, 28)
wav.writeUInt16LE(2, 32)
wav.writeUInt16LE(16, 34)
wav.write('data', 36)
wav.writeUInt32LE(dataSize, 40)

for (let index = 0; index < samples.length; index += 1) {
  wav.writeInt16LE(samples[index], 44 + index * 2)
}

await mkdir(dirname(outputPath), { recursive: true })
await writeFile(outputPath, wav)
console.log(`Generated ${outputPath}`)
