export const districtGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '核心区', height: 180 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [113.24, 23.1],
            [113.31, 23.08],
            [113.37, 23.15],
            [113.34, 23.23],
            [113.26, 23.24],
            [113.21, 23.17],
            [113.24, 23.1],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '扩展区', height: 120 },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [113.39, 23.12],
            [113.46, 23.1],
            [113.5, 23.18],
            [113.46, 23.24],
            [113.4, 23.21],
            [113.39, 23.12],
          ],
        ],
      },
    },
  ],
} as const

export const roadGeoJson = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: '中央大道', width: 110 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [113.21, 23.08],
          [113.28, 23.12],
          [113.34, 23.17],
          [113.39, 23.13],
          [113.45, 23.2],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { name: '滨江路', width: 82 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [113.24, 23.26],
          [113.3, 23.21],
          [113.36, 23.22],
          [113.43, 23.27],
          [113.49, 23.24],
        ],
      },
    },
  ],
} as const
