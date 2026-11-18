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
  height: number
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

export const OCEAN_PARTICLE_COUNT = 96
export const WIND_PARTICLE_COUNT = 112
export const FLOW_TRAIL_LENGTH = 5
export const OCEAN_FLOW_SEED = 0x4_2_1
export const WIND_FLOW_SEED = 0x4_2_3

export const oceanCurrentColors = ['#1d4ed8', '#0891b2', '#22d3ee', '#a5f3fc'] as const
export const windFieldColors = ['#0f766e', '#16a34a', '#84cc16', '#facc15', '#f97316'] as const
export const heatmap3dColors = [
  '#172554',
  '#1d4ed8',
  '#0891b2',
  '#22c55e',
  '#facc15',
  '#f97316',
  '#dc2626',
] as const
export const honeycombColors = [
  '#052e16',
  '#166534',
  '#65a30d',
  '#facc15',
  '#f97316',
  '#b91c1c',
] as const

export const heatmap3dRegion = {
  east: 125,
  north: 36,
  south: 21,
  west: 107,
}

export const honeycombRegion = {
  east: 123,
  north: 37,
  south: 27,
  west: 110,
}

export const HEATMAP_3D_COLUMNS = 24
export const HEATMAP_3D_ROWS = 16
export const HONEYCOMB_COLUMNS = 15
export const HONEYCOMB_ROWS = 10

export function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

export function sampleOceanCurrent(longitude: number, latitude: number): FlowVector {
  const eastward =
    0.52 + 0.26 * Math.sin((latitude - 8) * 0.21) + 0.12 * Math.cos((longitude - 112) * 0.13)
  const northward =
    0.18 * Math.cos((longitude - 120) * 0.17) + 0.14 * Math.sin((latitude - 20) * 0.23)

  return {
    eastward,
    northward,
    speed: Math.hypot(eastward, northward),
  }
}

export function sampleWindField(longitude: number, latitude: number): FlowVector {
  const eastward =
    0.42 + 0.38 * Math.cos((latitude - 30) * 0.16) - 0.18 * Math.sin((longitude - 85) * 0.11)
  const northward =
    0.32 * Math.sin((longitude - 100) * 0.15) + 0.2 * Math.cos((latitude - 24) * 0.12)

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
  const normalized = Math.min(0.999_999, Math.max(0, value))
  return colors[Math.floor(normalized * colors.length)] ?? colors[0] ?? '#ffffff'
}

function gaussian(
  longitude: number,
  latitude: number,
  centerLongitude: number,
  centerLatitude: number,
  longitudeScale: number,
  latitudeScale: number,
) {
  return Math.exp(
    -(
      ((longitude - centerLongitude) / longitudeScale) ** 2 +
      ((latitude - centerLatitude) / latitudeScale) ** 2
    ),
  )
}

function buildHeatmap3dCells(): HeatCell[] {
  const cells: Array<Omit<HeatCell, 'height'>> = []

  for (let row = 0; row < HEATMAP_3D_ROWS; row += 1) {
    const latitude =
      heatmap3dRegion.south +
      ((row + 0.5) / HEATMAP_3D_ROWS) * (heatmap3dRegion.north - heatmap3dRegion.south)

    for (let column = 0; column < HEATMAP_3D_COLUMNS; column += 1) {
      const longitude =
        heatmap3dRegion.west +
        ((column + 0.5) / HEATMAP_3D_COLUMNS) * (heatmap3dRegion.east - heatmap3dRegion.west)
      const centralPeak = gaussian(longitude, latitude, 115.2, 30.1, 3.8, 2.8)
      const coastalPeak = gaussian(longitude, latitude, 121.1, 32.3, 2.7, 2.2)
      const southernPeak = gaussian(longitude, latitude, 110.2, 23.4, 2.4, 2.1)
      const wave =
        0.09 * Math.sin((longitude - 107) * 1.15) * Math.cos((latitude - 21) * 1.05) + 0.1
      const raw = centralPeak + coastalPeak * 0.82 + southernPeak * 0.55 + wave

      cells.push({ latitude, longitude, value: raw })
    }
  }

  const minimum = Math.min(...cells.map((cell) => cell.value))
  const maximum = Math.max(...cells.map((cell) => cell.value))
  const range = Math.max(0.0001, maximum - minimum)

  return cells.map((cell) => {
    const value = (cell.value - minimum) / range
    return {
      ...cell,
      height: 500 + value ** 1.35 * 7_500,
      value,
    }
  })
}

function buildHoneycombCells(): HeatCell[] {
  const cells: Array<Omit<HeatCell, 'height'>> = []

  for (let row = 0; row < HONEYCOMB_ROWS; row += 1) {
    const latitude =
      honeycombRegion.south +
      ((row + 0.5) / HONEYCOMB_ROWS) * (honeycombRegion.north - honeycombRegion.south)

    for (let column = 0; column < HONEYCOMB_COLUMNS; column += 1) {
      const longitude =
        honeycombRegion.west +
        ((column + 0.5) / HONEYCOMB_COLUMNS) * (honeycombRegion.east - honeycombRegion.west)
      const easternPeak = gaussian(longitude, latitude, 118.6, 32.2, 2.2, 1.7)
      const inlandPeak = gaussian(longitude, latitude, 113.2, 30.2, 2.4, 2.1)
      const northernRidge = gaussian(longitude, latitude, 116.2, 35.1, 3.4, 1.2)
      const texture =
        0.06 * Math.cos((longitude - 110) * 1.8) * Math.sin((latitude - 27) * 1.35) + 0.04
      const raw = easternPeak + inlandPeak * 0.72 + northernRidge * 0.48 + texture

      cells.push({ latitude, longitude, value: raw })
    }
  }

  const minimum = Math.min(...cells.map((cell) => cell.value))
  const maximum = Math.max(...cells.map((cell) => cell.value))
  const range = Math.max(0.0001, maximum - minimum)

  return cells.map((cell) => {
    const value = (cell.value - minimum) / range
    return {
      ...cell,
      height: 700 + value ** 1.5 * 9_000,
      value,
    }
  })
}

export const heatmap3dCells = buildHeatmap3dCells()
export const honeycombCells = buildHoneycombCells()
