import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import gifenc from 'gifenc'

const { GIFEncoder, applyPalette } = gifenc

const outputDirectory = resolve('src/assets/vector-covers')

const demos = [
  ['entity-point.svg', '1.3.1', 'entity点', 'points'],
  ['entity-line.svg', '1.3.2', 'entity线', 'lines'],
  ['entity-polygon.svg', '1.3.3', 'entity面', 'polygons'],
  ['billboard.svg', '1.3.4', '图标', 'billboards'],
  ['billboard-collection.svg', '1.3.5', '海量图标', 'collection'],
  ['popup.svg', '1.3.6', 'popup', 'overlay'],
  ['geojson.svg', '1.3.7', 'geojson', 'polygons'],
  ['primitive.svg', '1.3.8', 'Primitive', 'primitives'],
  ['all-primitive.svg', '1.3.9', 'AllPrimitive', 'primitives'],
  ['entity-collection.svg', '1.3.10', 'entityCollection', 'collection'],
  ['entity-operation.svg', '1.3.11', 'entity操作', 'points'],
  ['html-overlay.svg', '1.3.12', '气泡窗口', 'overlay'],
  ['click-popup.svg', '1.3.13', '气泡弹窗', 'overlay'],
  ['road.svg', '1.3.14', '道路', 'lines'],
  ['svg.svg', '1.3.15', 'svg', 'billboards'],
  ['gif.svg', '1.3.16', 'gif', 'billboards'],
]

const palettes = [
  ['#0d3557', '#18a8c9', '#f3c64f'],
  ['#163a2d', '#46b87b', '#f3e06d'],
  ['#4a1f31', '#d9567c', '#ffd096'],
  ['#18284e', '#547de0', '#8ee7ff'],
]

function escapeXml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function renderMotif(kind, accent, secondary) {
  if (kind === 'points') {
    return `
      <g fill="${accent}">
        <circle cx="170" cy="220" r="18" />
        <circle cx="280" cy="155" r="12" />
        <circle cx="350" cy="270" r="26" />
        <circle cx="465" cy="190" r="16" />
        <circle cx="510" cy="305" r="10" />
      </g>
      <g stroke="${secondary}" stroke-width="4" stroke-dasharray="10 12" opacity=".8">
        <path d="M170 220 L280 155 L350 270 L465 190 L510 305" fill="none" />
      </g>`
  }

  if (kind === 'lines') {
    return `
      <g fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="M110 320 C190 100 300 380 520 150" stroke="${accent}" stroke-width="18" />
        <path d="M125 350 C230 190 350 330 530 250" stroke="${secondary}" stroke-width="7" />
        <path d="M150 265 C245 120 390 350 500 210" stroke="#ffffff" stroke-width="3" opacity=".75" />
      </g>`
  }

  if (kind === 'polygons') {
    return `
      <path d="M125 320 L190 145 L365 125 L505 225 L455 360 L250 385 Z"
        fill="${accent}" fill-opacity=".62" stroke="${secondary}" stroke-width="6" />
      <path d="M205 300 L245 210 L355 195 L410 265 L360 335 L255 340 Z"
        fill="none" stroke="#ffffff" stroke-width="3" opacity=".75" />`
  }

  if (kind === 'billboards') {
    return `
      <g transform="translate(315 235)">
        <path d="M0 -95 C55 -95 92 -58 92 -5 C92 55 0 128 0 128 C0 128 -92 55 -92 -5 C-92 -58 -55 -95 0 -95 Z"
          fill="${accent}" stroke="${secondary}" stroke-width="7" />
        <circle cx="0" cy="-10" r="30" fill="#0d1b2a" fill-opacity=".8" />
        <circle cx="0" cy="-10" r="10" fill="${secondary}" />
      </g>`
  }

  if (kind === 'collection') {
    const dots = []
    for (let row = 0; row < 5; row += 1) {
      for (let column = 0; column < 8; column += 1) {
        dots.push(
          `<circle cx="${155 + column * 48}" cy="${150 + row * 45}" r="${7 + ((row + column) % 3) * 3}" fill="${(row + column) % 2 ? accent : secondary}" />`,
        )
      }
    }
    return `<g opacity=".9">${dots.join('')}</g>`
  }

  if (kind === 'overlay') {
    return `
      <g>
        <circle cx="290" cy="230" r="22" fill="${secondary}" />
        <path d="M290 252 L290 340" stroke="${secondary}" stroke-width="5" stroke-dasharray="12 10" />
        <rect x="325" y="165" width="225" height="118" rx="18" fill="#ffffff" fill-opacity=".94" />
        <path d="M340 285 L315 315 L365 285 Z" fill="#ffffff" fill-opacity=".94" />
        <rect x="348" y="192" width="155" height="12" rx="6" fill="${accent}" />
        <rect x="348" y="220" width="125" height="9" rx="4.5" fill="#9aa6b2" />
        <rect x="348" y="242" width="96" height="9" rx="4.5" fill="#c1c8d0" />
      </g>`
  }

  return `
    <g fill="none" stroke-width="7">
      <rect x="155" y="155" width="255" height="175" rx="12" stroke="${accent}" />
      <polygon points="455,145 540,205 455,270" stroke="${secondary}" fill="${secondary}" fill-opacity=".22" />
      <path d="M190 180 L350 310 M350 180 L190 310" stroke="#ffffff" stroke-width="4" opacity=".55" />
    </g>`
}

function renderCover(code, name, motif, index) {
  const [background, accent, secondary] = palettes[index % palettes.length]
  const gridLines = []
  for (let x = 0; x <= 640; x += 40) {
    gridLines.push(`M${x} 0 V480`)
  }
  for (let y = 0; y <= 480; y += 40) {
    gridLines.push(`M0 ${y} H640`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480" role="img" aria-label="${escapeXml(name)}示例封面">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${background}" />
      <stop offset="1" stop-color="#08131f" />
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".4" r=".7">
      <stop offset="0" stop-color="${accent}" stop-opacity=".38" />
      <stop offset="1" stop-color="${accent}" stop-opacity="0" />
    </radialGradient>
  </defs>
  <rect width="640" height="480" fill="url(#bg)" />
  <circle cx="360" cy="210" r="250" fill="url(#glow)" />
  <path d="${gridLines.join(' ')}" stroke="#ffffff" stroke-opacity=".07" stroke-width="1" />
  <text x="42" y="66" fill="${secondary}" font-family="monospace" font-size="26" letter-spacing="3">${escapeXml(code)}</text>
  <text x="42" y="112" fill="#f7fbff" font-family="sans-serif" font-size="38" font-weight="700">${escapeXml(name)}</text>
  ${renderMotif(motif, accent, secondary)}
  <text x="42" y="435" fill="#dbe9f3" fill-opacity=".72" font-family="sans-serif" font-size="18">CESIUM VECTOR DEMO</text>
</svg>
`
}

mkdirSync(outputDirectory, { recursive: true })
demos.forEach(([file, code, name, motif], index) => {
  writeFileSync(resolve(outputDirectory, file), renderCover(code, name, motif, index), 'utf8')
})

const gifWidth = 64
const gifHeight = 64
const gifPalette = [
  [7, 17, 31],
  [24, 168, 201],
  [214, 60, 70],
  [255, 255, 255],
]

function createPulseFrame(frameIndex) {
  const pixels = new Uint8Array(gifWidth * gifHeight * 4)
  const center = (gifWidth - 1) / 2
  const radius = 13 + frameIndex * 2

  for (let y = 0; y < gifHeight; y += 1) {
    for (let x = 0; x < gifWidth; x += 1) {
      const distance = Math.hypot(x - center, y - center)
      let paletteIndex = 0

      if (distance < radius - 4) {
        paletteIndex = 2
      } else if (distance < radius) {
        paletteIndex = 3
      } else if (distance < radius + 3 && frameIndex % 2 === 0) {
        paletteIndex = 1
      }

      const offset = (y * gifWidth + x) * 4
      pixels.set([...gifPalette[paletteIndex], 255], offset)
    }
  }

  return pixels
}

function createAnimatedGif() {
  const gif = GIFEncoder()

  for (let frameIndex = 0; frameIndex < 8; frameIndex += 1) {
    const rgba = createPulseFrame(frameIndex)
    const indexed = applyPalette(rgba, gifPalette)
    gif.writeFrame(indexed, gifWidth, gifHeight, {
      palette: gifPalette,
      delay: 100,
      repeat: 0,
    })
  }

  gif.finish()
  return Buffer.from(gif.bytes())
}

const animatedGif = createAnimatedGif()
writeFileSync(resolve('src/assets/vector-demo-pulse.gif'), animatedGif)
