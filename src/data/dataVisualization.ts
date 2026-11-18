export interface FlowRegion {
  east: number
  north: number
  south: number
  west: number
}

export interface FlowVector {
  eastward: number
  northward: number
  speed: number
}

export interface FlowParticleSeed {
  latitude: number
  longitude: number
  phase: number
}

export interface HeatCell {
  column: number
  height: number
  latitude: number
  longitude: number
  row: number
  value: number
}

export interface HeatSample {
  latitude: number
  longitude: number
  value: number
}

export const oceanFlowRegion: FlowRegion = {
  east: 145,
  north: 40,
  south: 4,
  west: 104,
}

export const windFlowRegion: FlowRegion = {
  east: 136,
  north: 55,
  south: 15,
  west: 72,
}

export const OCEAN_PARTICLE_COUNT = 260
export const WIND_PARTICLE_COUNT = 2000
export const OCEAN_FLOW_TRAIL_LENGTH = 42
export const WIND_FLOW_TRAIL_LENGTH = 42
export const WIND_PARTICLE_MAX_AGE = 140
export const WIND_TRAIL_FADE_STEPS = 4
export const OCEAN_FLOW_SEED = 0x4_2_1
export const WIND_FLOW_SEED = 0x4_2_3

export const oceanCurrentColors = [
  '#1647d8',
  '#0ea5e9',
  '#5eead4',
  '#bef264',
  '#facc15',
  '#fb923c',
  '#dc2626',
] as const
export const windFieldColors = [
  '#2468b4',
  '#3c9dc2',
  '#80cdc1',
  '#97daa8',
  '#c6e7b5',
  '#eef7d9',
  '#ffee9f',
  '#fcd97d',
  '#ffb664',
  '#fc964b',
  '#fa7034',
  '#f54020',
  '#ed2d1c',
  '#dc1820',
  '#b40023',
] as const

export interface HeatColorStop {
  offset: number
  rgb: readonly [number, number, number]
}

export const heatColorStops: readonly HeatColorStop[] = [
  { offset: 0, rgb: [12, 34, 150] },
  { offset: 0.3, rgb: [0, 86, 255] },
  { offset: 0.5, rgb: [0, 201, 126] },
  { offset: 0.7, rgb: [246, 221, 42] },
  { offset: 0.86, rgb: [249, 115, 22] },
  { offset: 1, rgb: [220, 24, 32] },
]

export const heatmap3dColors = heatColorStops.map(
  ({ rgb }) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
)
export const honeycombColorStops: readonly HeatColorStop[] = [
  { offset: 0, rgb: [0, 100, 0] },
  { offset: 0.1, rgb: [34, 139, 34] },
  { offset: 0.2, rgb: [152, 251, 152] },
  { offset: 0.3, rgb: [240, 230, 140] },
  { offset: 0.4, rgb: [255, 215, 0] },
  { offset: 0.5, rgb: [255, 165, 0] },
  { offset: 0.6, rgb: [255, 140, 0] },
  { offset: 0.7, rgb: [255, 99, 71] },
  { offset: 0.8, rgb: [255, 69, 0] },
  { offset: 0.9, rgb: [255, 0, 0] },
  { offset: 1, rgb: [128, 0, 0] },
]
export const honeycombColors = honeycombColorStops.map(
  ({ rgb }) => `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
)

export const heatmap3dRegion = {
  east: 116.56,
  north: 40.02,
  south: 39.82,
  west: 116.36,
}

export const honeycombRegion = {
  east: 110.1,
  north: 30.1,
  south: 30,
  west: 110,
}

export const HEATMAP_3D_GRID_SIZE = 192
export const HEATMAP_3D_TEXTURE_SIZE = 384
export const HEATMAP_3D_MAX_HEIGHT = 1500
export const HONEYCOMB_COLUMNS = 50
export const HONEYCOMB_ROWS = 50
export const HONEYCOMB_MAX_HEIGHT = 800

const OCEAN_EDDIES = [
  { amplitude: 0.58, latitude: 9, latitudeScale: 2.4, longitude: 113, longitudeScale: 3.1 },
  { amplitude: 0.44, latitude: 15, latitudeScale: 2.1, longitude: 121, longitudeScale: 3.5 },
  { amplitude: 0.68, latitude: 23, latitudeScale: 2.5, longitude: 127, longitudeScale: 3.2 },
  { amplitude: 0.5, latitude: 30, latitudeScale: 2.2, longitude: 135, longitudeScale: 2.9 },
  { amplitude: 0.62, latitude: 35, latitudeScale: 2, longitude: 141, longitudeScale: 2.5 },
  { amplitude: 0.36, latitude: 31, latitudeScale: 2.4, longitude: 119, longitudeScale: 4 },
  { amplitude: 0.48, latitude: 12, latitudeScale: 2.2, longitude: 132, longitudeScale: 3 },
] as const

export function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

export function sampleOceanCurrent(longitude: number, latitude: number): FlowVector {
  const meander = 18 + 5.5 * Math.sin((longitude - 110) * 0.18)
  const jet = Math.exp(-((latitude - meander) ** 2) / 18)
  const eastward = 0.24 + 0.92 * jet + 0.11 * Math.cos((latitude - 8) * 0.21)
  const northward =
    0.16 * Math.cos((longitude - 120) * 0.17) + 0.1 * Math.sin((latitude - 20) * 0.23)

  return {
    eastward,
    northward,
    speed: Math.hypot(eastward, northward),
  }
}

export function sampleOceanCurrentHeat(longitude: number, latitude: number) {
  const vector = sampleOceanCurrent(longitude, latitude)
  const primaryMeander = 18 + 5.5 * Math.sin((longitude - 110) * 0.18)
  const secondaryMeander = 31 + 3.2 * Math.sin((longitude - 108) * 0.34)
  const primary = Math.exp(-((latitude - primaryMeander) ** 2) / 1.8)
  const secondary = Math.exp(-((latitude - secondaryMeander) ** 2) / 1.3)
  let eddy = 0
  for (const center of OCEAN_EDDIES) {
    eddy +=
      center.amplitude *
      Math.exp(
        -(((longitude - center.longitude) / center.longitudeScale) ** 2) -
          ((latitude - center.latitude) / center.latitudeScale) ** 2,
      )
  }
  const ripple =
    0.5 + 0.5 * Math.sin((longitude - 108) * 0.62 + Math.cos((latitude - 12) * 0.48) * 2.4)
  const turbulence =
    0.5 +
    0.5 *
      Math.sin((longitude - 106) * 1.35 + Math.sin((latitude - 8) * 0.72) * 2.6) *
      Math.cos((latitude - 6) * 1.18 - (longitude - 112) * 0.28)

  return clamp(
    0.04 +
      primary * 0.42 +
      secondary * 0.29 +
      eddy * 0.4 +
      vector.speed * 0.06 +
      ripple * 0.06 +
      turbulence * 0.16,
    0,
    1,
  )
}

export function sampleWindField(longitude: number, latitude: number): FlowVector {
  const swirl = Math.sin((longitude - 90) * 0.18 + Math.cos((latitude - 26) * 0.16) * 1.7)
  const eastward =
    0.3 +
    0.4 * Math.cos((latitude - 30) * 0.16) -
    0.13 * Math.sin((longitude - 85) * 0.11) +
    0.22 * swirl
  const northward =
    0.5 * Math.sin((longitude - 100) * 0.15) +
    0.25 * Math.cos((latitude - 24) * 0.14) -
    0.1 * Math.sin((longitude - 118) * 0.09)

  return {
    eastward,
    northward,
    speed: Math.hypot(eastward, northward),
  }
}

export function createFlowParticleSeeds(
  region: FlowRegion,
  count: number,
  seed: number,
): FlowParticleSeed[] {
  const random = createSeededRandom(seed)
  const longitudeRange = region.east - region.west
  const latitudeRange = region.north - region.south

  return Array.from({ length: count }, () => ({
    latitude: region.south + random() * latitudeRange,
    longitude: region.west + random() * longitudeRange,
    phase: random(),
  }))
}

export function pickStableColor(value: number, colors: readonly string[]) {
  return colors[pickStableColorIndex(value, colors.length)] ?? colors[0] ?? '#ffffff'
}

export function pickStableColorIndex(value: number, count: number) {
  if (count <= 0) {
    return 0
  }

  const normalized = Math.min(0.999_999, Math.max(0, value))
  return Math.floor(normalized * count)
}

export function sampleHeatColor(value: number): readonly [number, number, number] {
  return sampleColorFromStops(value, heatColorStops)
}

export function sampleHoneycombColor(value: number): readonly [number, number, number] {
  return sampleColorFromStops(value, honeycombColorStops)
}

function sampleColorFromStops(value: number, stops: readonly HeatColorStop[]) {
  const normalized = clamp(value, 0, 1)

  for (let index = 0; index < stops.length - 1; index += 1) {
    const current = stops[index]
    const next = stops[index + 1]
    if (!current || !next || normalized > next.offset) {
      continue
    }

    const ratio = (normalized - current.offset) / (next.offset - current.offset)
    return [
      Math.round(current.rgb[0] + (next.rgb[0] - current.rgb[0]) * ratio),
      Math.round(current.rgb[1] + (next.rgb[1] - current.rgb[1]) * ratio),
      Math.round(current.rgb[2] + (next.rgb[2] - current.rgb[2]) * ratio),
    ] as const
  }

  return stops[stops.length - 1]?.rgb ?? ([255, 255, 255] as const)
}

export function sampleHeatColorCss(value: number, alpha = 1) {
  const [red, green, blue] = sampleHeatColor(value)
  return `rgb(${red}, ${green}, ${blue}, ${alpha})`
}

export function sampleHoneycombColorCss(value: number, alpha = 1) {
  const [red, green, blue] = sampleHoneycombColor(value)
  return `rgb(${red}, ${green}, ${blue}, ${alpha})`
}

function createHeatSamples(seed: number, count: number, region: typeof heatmap3dRegion) {
  const random = createSeededRandom(seed)

  return Array.from({ length: count }, () => ({
    latitude: region.south + random() * (region.north - region.south),
    longitude: region.west + random() * (region.east - region.west),
    value: 0.18 + random() * 0.82,
  }))
}

export const heatmap3dSamples = createHeatSamples(0x4_2_2, 50, heatmap3dRegion)
export const honeycombSamples = createHeatSamples(0x4_2_4, 125, honeycombRegion)

export function sampleHeatmap3dField(longitude: number, latitude: number) {
  return sampleWeightedHeat(heatmap3dSamples, longitude, latitude, 0.025, 1.05)
}

export function sampleHoneycombField(longitude: number, latitude: number) {
  return sampleWeightedHeat(honeycombSamples, longitude, latitude, 0.011, 0.85)
}

function sampleWeightedHeat(
  samples: readonly HeatSample[],
  longitude: number,
  latitude: number,
  latitudeScale: number,
  scale: number,
) {
  let value = 0

  for (const sample of samples) {
    const longitudeScale = latitudeScale * Math.cos((latitude * Math.PI) / 180)
    const dx = (longitude - sample.longitude) / longitudeScale
    const dy = (latitude - sample.latitude) / latitudeScale
    value += sample.value * Math.exp(-(dx * dx + dy * dy) * 2.1)
  }

  return clamp(value * scale, 0, 1)
}

function buildHoneycombCells(): HeatCell[] {
  const rawCells: Array<Omit<HeatCell, 'height' | 'value'> & { rawValue: number }> = []

  for (let row = 0; row < HONEYCOMB_ROWS; row += 1) {
    const latitude =
      honeycombRegion.south +
      ((row + 0.5) / HONEYCOMB_ROWS) * (honeycombRegion.north - honeycombRegion.south)

    for (let column = 0; column < HONEYCOMB_COLUMNS; column += 1) {
      const longitude =
        honeycombRegion.west +
        ((column + 0.5) / HONEYCOMB_COLUMNS) * (honeycombRegion.east - honeycombRegion.west)
      rawCells.push({
        column,
        latitude,
        longitude,
        rawValue: sampleHoneycombField(longitude, latitude),
        row,
      })
    }
  }

  const minimum = Math.min(...rawCells.map((cell) => cell.rawValue))
  const maximum = Math.max(...rawCells.map((cell) => cell.rawValue))
  const range = Math.max(0.0001, maximum - minimum)

  return rawCells.map((cell) => {
    const value = (cell.rawValue - minimum) / range
    return {
      column: cell.column,
      height: value * HONEYCOMB_MAX_HEIGHT,
      latitude: cell.latitude,
      longitude: cell.longitude,
      row: cell.row,
      value,
    }
  })
}

export const honeycombCells = buildHoneycombCells()

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
