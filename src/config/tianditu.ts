export interface TiandituLayer {
  id: 'img' | 'cia'
  name: string
}

export const tiandituLayers: TiandituLayer[] = [
  {
    id: 'img',
    name: '天地图影像底图',
  },
  {
    id: 'cia',
    name: '天地图中文注记',
  },
]

export function getTiandituToken() {
  const token = import.meta.env.VITE_TIANDITU_TOKEN
  return typeof token === 'string' ? token.trim() : ''
}

export function createTiandituTileUrl(layer: TiandituLayer['id'], token = getTiandituToken()) {
  const query = new URLSearchParams({
    SERVICE: 'WMTS',
    REQUEST: 'GetTile',
    VERSION: '1.0.0',
    LAYER: layer,
    STYLE: 'default',
    TILEMATRIXSET: 'w',
    FORMAT: 'tiles',
    TILEMATRIX: '{TileMatrix}',
    TILEROW: '{TileRow}',
    TILECOL: '{TileCol}',
    tk: token,
  })

  return `https://t{s}.tianditu.gov.cn/${layer}_w/wmts?${query.toString()}`
}
