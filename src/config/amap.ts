import {
  Cartesian2,
  Cartesian3,
  Cartographic,
  Math as CesiumMath,
  Rectangle,
  UrlTemplateImageryProvider,
  WebMercatorProjection,
  WebMercatorTilingScheme,
} from 'cesium'

const AMAP_ELECTRIC_TILE_URL =
  'https://webrd{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}'
const AMAP_SUBDOMAINS = ['01', '02', '03', '04']

const AXIS_SEMI_MAJOR = 6_378_245
const EE = 0.006_693_416_229_659_43
const DEGREE_TO_RADIAN = Math.PI / 180

interface LngLat {
  longitude: number
  latitude: number
}

function outOfChina(longitude: number, latitude: number) {
  return longitude < 73.66 || longitude > 135.05 || latitude < 3.86 || latitude > 53.55
}

function transformLatitude(longitude: number, latitude: number) {
  let value =
    -100 +
    2 * longitude +
    3 * latitude +
    0.2 * latitude * latitude +
    0.1 * longitude * latitude +
    0.2 * Math.sqrt(Math.abs(longitude))
  value +=
    ((20 * Math.sin(6 * longitude * DEGREE_TO_RADIAN) +
      20 * Math.sin(2 * longitude * DEGREE_TO_RADIAN)) *
      2) /
    3
  value +=
    ((20 * Math.sin(latitude * DEGREE_TO_RADIAN) +
      40 * Math.sin((latitude / 3) * DEGREE_TO_RADIAN)) *
      2) /
    3
  value +=
    ((160 * Math.sin((latitude / 12) * DEGREE_TO_RADIAN) +
      320 * Math.sin((latitude / 30) * DEGREE_TO_RADIAN)) *
      2) /
    3
  return value
}

function transformLongitude(longitude: number, latitude: number) {
  let value =
    300 +
    longitude +
    2 * latitude +
    0.1 * longitude * longitude +
    0.1 * longitude * latitude +
    0.1 * Math.sqrt(Math.abs(longitude))
  value +=
    ((20 * Math.sin(6 * longitude * DEGREE_TO_RADIAN) +
      20 * Math.sin(2 * longitude * DEGREE_TO_RADIAN)) *
      2) /
    3
  value +=
    ((20 * Math.sin(longitude * DEGREE_TO_RADIAN) +
      40 * Math.sin((longitude / 3) * DEGREE_TO_RADIAN)) *
      2) /
    3
  value +=
    ((150 * Math.sin((longitude / 12) * DEGREE_TO_RADIAN) +
      300 * Math.sin((longitude / 30) * DEGREE_TO_RADIAN)) *
      2) /
    3
  return value
}

export function wgs84ToGcj02(longitude: number, latitude: number): LngLat {
  if (outOfChina(longitude, latitude)) {
    return { longitude, latitude }
  }

  const deltaLatitude = transformLatitude(longitude - 105, latitude - 35)
  const deltaLongitude = transformLongitude(longitude - 105, latitude - 35)
  const radianLatitude = latitude * DEGREE_TO_RADIAN
  const magic = 1 - EE * Math.sin(radianLatitude) ** 2
  const sqrtMagic = Math.sqrt(magic)
  const adjustedLatitude =
    (deltaLatitude * 180) / (((AXIS_SEMI_MAJOR * (1 - EE)) / (magic * sqrtMagic)) * Math.PI)
  const adjustedLongitude =
    (deltaLongitude * 180) / ((AXIS_SEMI_MAJOR / sqrtMagic) * Math.cos(radianLatitude) * Math.PI)

  return {
    longitude: longitude + adjustedLongitude,
    latitude: latitude + adjustedLatitude,
  }
}

export function gcj02ToWgs84(longitude: number, latitude: number): LngLat {
  if (outOfChina(longitude, latitude)) {
    return { longitude, latitude }
  }

  let wgs84Longitude = longitude
  let wgs84Latitude = latitude
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const converted = wgs84ToGcj02(wgs84Longitude, wgs84Latitude)
    wgs84Longitude += longitude - converted.longitude
    wgs84Latitude += latitude - converted.latitude
  }

  return { longitude: wgs84Longitude, latitude: wgs84Latitude }
}

/**
 * AMap serves GCJ-02 Web Mercator tiles. Overriding the two public tile conversion
 * methods keeps Cesium's WGS84 positions aligned without mutating Cesium internals.
 */
export class AmapTilingScheme extends WebMercatorTilingScheme {
  private readonly amapProjection = new WebMercatorProjection(this.ellipsoid)

  positionToTileXY(position: Cartographic, level: number, result?: Cartesian2): Cartesian2 {
    const rectangle = this.rectangle
    if (!Rectangle.contains(rectangle, position)) {
      return undefined as unknown as Cartesian2
    }

    const converted = wgs84ToGcj02(
      CesiumMath.toDegrees(position.longitude),
      CesiumMath.toDegrees(position.latitude),
    )
    const projected = this.amapProjection.project(
      Cartographic.fromRadians(
        CesiumMath.toRadians(converted.longitude),
        CesiumMath.toRadians(converted.latitude),
        position.height,
      ),
    )
    const nativeRectangle = super.rectangleToNativeRectangle(rectangle, new Rectangle())
    const tilesX = this.getNumberOfXTilesAtLevel(level)
    const tilesY = this.getNumberOfYTilesAtLevel(level)
    const tile = result ?? new Cartesian2()

    tile.x = Math.floor(
      ((projected.x - nativeRectangle.west) / (nativeRectangle.east - nativeRectangle.west)) *
        tilesX,
    )
    tile.y = Math.floor(
      ((nativeRectangle.north - projected.y) / (nativeRectangle.north - nativeRectangle.south)) *
        tilesY,
    )
    tile.x = Math.max(0, Math.min(tilesX - 1, tile.x))
    tile.y = Math.max(0, Math.min(tilesY - 1, tile.y))
    return tile
  }

  tileXYToRectangle(x: number, y: number, level: number, result?: Rectangle): Rectangle {
    const nativeRectangle = super.tileXYToNativeRectangle(x, y, level, new Rectangle())
    const southwest = this.amapProjection.unproject(
      new Cartesian3(nativeRectangle.west, nativeRectangle.south, 0),
      new Cartographic(),
    )
    const northeast = this.amapProjection.unproject(
      new Cartesian3(nativeRectangle.east, nativeRectangle.north, 0),
      new Cartographic(),
    )
    const wgs84Southwest = gcj02ToWgs84(
      CesiumMath.toDegrees(southwest.longitude),
      CesiumMath.toDegrees(southwest.latitude),
    )
    const wgs84Northeast = gcj02ToWgs84(
      CesiumMath.toDegrees(northeast.longitude),
      CesiumMath.toDegrees(northeast.latitude),
    )
    const rectangle = result ?? new Rectangle()

    rectangle.west = CesiumMath.toRadians(wgs84Southwest.longitude)
    rectangle.south = CesiumMath.toRadians(wgs84Southwest.latitude)
    rectangle.east = CesiumMath.toRadians(wgs84Northeast.longitude)
    rectangle.north = CesiumMath.toRadians(wgs84Northeast.latitude)
    return rectangle
  }
}

export function createAmapImageryProvider() {
  return new UrlTemplateImageryProvider({
    url: AMAP_ELECTRIC_TILE_URL,
    subdomains: AMAP_SUBDOMAINS,
    maximumLevel: 18,
    tilingScheme: new AmapTilingScheme(),
    credit: '高德地图',
    enablePickFeatures: false,
  })
}
