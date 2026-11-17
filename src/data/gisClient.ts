export interface GisPointSample {
  longitude: number
  latitude: number
  value: number
}

export type LongitudeLatitude = [longitude: number, latitude: number]

export const overlayPolygonA: LongitudeLatitude[] = [
  [117.182288, 31.854164],
  [117.210254, 31.878324],
  [117.238229, 31.855796],
  [117.242307, 31.826109],
  [117.177277, 31.821475],
  [117.182288, 31.854164],
]

export const overlayPolygonB: LongitudeLatitude[] = [
  [117.267046, 31.842971],
  [117.20963, 31.840323],
  [117.230646, 31.787122],
  [117.28833, 31.799624],
  [117.267046, 31.842971],
]

export const thiessenBoundary: LongitudeLatitude[] = [
  [100, 20],
  [101, 20],
  [101, 21],
  [100, 21],
  [100, 20],
]

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function buildThiessenSamples(): GisPointSample[] {
  const random = createSeededRandom(0x4_1_2)
  const samples: GisPointSample[] = []

  for (let index = 0; index < 50; index += 1) {
    samples.push({
      longitude: 100 + random(),
      latitude: 20 + random(),
      value: 2 + ((index * 7 + 3) % 8),
    })
  }

  for (const [longitude, latitude] of thiessenBoundary.slice(0, -1)) {
    samples.push({
      longitude,
      latitude,
      value: 2 + (((longitude + latitude) * 10) % 8),
    })
  }

  return samples
}

function buildIsosurfaceGrid(): GisPointSample[] {
  const samples: GisPointSample[] = []

  for (let row = 0; row < 15; row += 1) {
    const latitude = 27.75 + row * 0.39

    for (let column = 0; column < 20; column += 1) {
      const longitude = 112.3 + column * 0.4
      const westernPeak = Math.exp(
        -(((longitude - 115.5) / 2.1) ** 2 + ((latitude - 30.5) / 1.5) ** 2),
      )
      const easternPeak = Math.exp(
        -(((longitude - 118.5) / 1.5) ** 2 + ((latitude - 32.2) / 1.1) ** 2),
      )
      const wave = 0.9 * Math.sin((longitude - 112.3) * 1.7) * Math.cos((latitude - 27.75) * 1.2)
      const value = 1.1 + westernPeak * 8.8 + easternPeak * 6.6 + wave

      samples.push({
        longitude,
        latitude,
        value: Number(value.toFixed(3)),
      })
    }
  }

  return samples
}

export const thiessenSamplePoints = buildThiessenSamples()
export const isosurfaceGrid = buildIsosurfaceGrid()
export const isosurfaceBreaks = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 99] as const
export const isosurfaceColors = [
  '#006837',
  '#1a9850',
  '#66bd63',
  '#a6d96a',
  '#d9ef8b',
  '#ffffbf',
  '#fee08b',
  '#fdae61',
  '#f46d43',
  '#d73027',
] as const
