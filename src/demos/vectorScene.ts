import * as Cesium from 'cesium'

import markerIconUrl from '@/assets/vector-marker.svg'
import hurricaneGifUrl from '@/assets/vector-demo-hurricane.gif'
import { districtGeoJson, roadGeoJson } from '@/data/demoGeoJson'
import type { VectorSceneId } from '@/data/layers'

export interface VectorAction {
  id: string
  label: string
  run: () => void | Promise<void>
}

export interface VectorScene {
  actions: VectorAction[]
  dispose: () => void
}

type StatusReporter = (message: string) => void

const CENTER = { longitude: 113.33, latitude: 23.16 }

function requestRender(viewer: Cesium.Viewer) {
  viewer.scene.requestRender()
}

async function loadBillboardImage(url: string) {
  if (typeof Image === 'undefined' || navigator.userAgent.includes('jsdom')) {
    return url
  }

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => resolve(image)
      image.onerror = () => reject(new Error(`图标加载失败：${url}`))
      image.src = url
    })
    await image.decode?.().catch(() => undefined)
    return image
  } catch (error) {
    console.error('图标资源加载失败，降级为直接使用资源地址', error)
    return url
  }
}

interface CameraFrameOptions {
  heading?: number
  pitch?: number
  minimumRange?: number
  rangeFactor?: number
}

const CAMERA_PRESETS = {
  entityPoint: { heading: 12, pitch: -48, minimumRange: 3_600, rangeFactor: 2.95 },
  entityLine: { heading: 8, pitch: -50, minimumRange: 5_200, rangeFactor: 2.7 },
  entityPolygon: { heading: 8, pitch: -50, minimumRange: 5_600, rangeFactor: 2.5 },
  marker: { heading: 0, pitch: -42, minimumRange: 2_200, rangeFactor: 2.5 },
  markerClose: { heading: 0, pitch: -42, minimumRange: 2_000, rangeFactor: 2.5 },
  billboardCollection: { heading: 0, pitch: -55, minimumRange: 80_000, rangeFactor: 2.05 },
  billboardCollectionFocus: {
    heading: 0,
    pitch: -60,
    minimumRange: 65_000,
    rangeFactor: 1.75,
  },
  popup: { heading: 8, pitch: -50, minimumRange: 5_000, rangeFactor: 2.4 },
  primitive: { heading: 10, pitch: -48, minimumRange: 5_500, rangeFactor: 2.7 },
  allPrimitive: { heading: 8, pitch: -48, minimumRange: 8_500, rangeFactor: 2.7 },
  entityCollection: { heading: 8, pitch: -45, minimumRange: 4_200, rangeFactor: 2.8 },
  entityOperation: { heading: 8, pitch: -45, minimumRange: 3_000, rangeFactor: 2.8 },
  htmlOverlay: { heading: 12, pitch: -45, minimumRange: 1_800, rangeFactor: 2.5 },
  clickPopup: { heading: 8, pitch: -48, minimumRange: 5_000, rangeFactor: 2.9 },
  road: { heading: 8, pitch: -50, minimumRange: 5_500, rangeFactor: 2.45 },
} as const satisfies Record<string, CameraFrameOptions>

function frameCamera(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  options: CameraFrameOptions = {},
) {
  if (positions.length === 0) {
    return
  }

  const { heading = 10, pitch = -48, minimumRange = 2_500, rangeFactor = 2.5 } = options
  const sphere = Cesium.BoundingSphere.fromPoints(positions)
  sphere.radius = Math.max(sphere.radius, minimumRange / rangeFactor)
  const range = Math.max(minimumRange, sphere.radius * rangeFactor)

  viewer.camera.viewBoundingSphere(
    sphere,
    new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(heading),
      Cesium.Math.toRadians(pitch),
      range,
    ),
  )
}

function resetCameraView(
  viewer: Cesium.Viewer,
  positions: Cesium.Cartesian3[],
  preset: CameraFrameOptions,
) {
  frameCamera(viewer, positions, preset)
  requestRender(viewer)
}

function removeEntities(viewer: Cesium.Viewer, entities: readonly Cesium.Entity[]) {
  entities.forEach((entity) => viewer.entities.remove(entity))
}

function createHtmlOverlay(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  position: Cesium.Cartesian3,
  content: string,
  options: { closable?: boolean; offsetY?: number; visible?: boolean } = {},
) {
  const element = document.createElement('div')
  element.className = 'vector-demo-overlay'
  element.dataset.demoOverlay = 'true'
  element.innerHTML = content
  element.style.position = 'absolute'
  element.style.top = '0'
  element.style.left = '0'
  element.style.zIndex = '4'
  element.style.maxWidth = '280px'
  element.style.pointerEvents = options.closable ? 'auto' : 'none'
  element.style.filter = 'drop-shadow(0 10px 22px rgb(0 0 0 / 28%))'
  host.append(element)

  let currentPosition = position
  let visible = options.visible ?? true

  const updatePosition = () => {
    if (!visible) {
      element.style.display = 'none'
      return
    }

    const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(
      viewer.scene,
      currentPosition,
    )
    if (
      !windowPosition ||
      !Number.isFinite(windowPosition.x) ||
      !Number.isFinite(windowPosition.y)
    ) {
      element.style.display = 'none'
      return
    }

    const hostWidth = host.clientWidth
    const hostHeight = host.clientHeight
    const horizontalMargin = hostWidth > 0 ? Math.min(150, hostWidth / 2) : 0
    const verticalMargin = hostHeight > 0 ? Math.min(100, hostHeight / 2) : 0
    const x =
      hostWidth > 0
        ? Math.min(Math.max(windowPosition.x, horizontalMargin), hostWidth - horizontalMargin)
        : windowPosition.x
    const y =
      hostHeight > 0
        ? Math.min(Math.max(windowPosition.y, verticalMargin), hostHeight - 12)
        : windowPosition.y

    element.style.display = 'block'
    element.style.transform = `translate(${x}px, ${y}px) translate(-50%, calc(-100% - ${options.offsetY ?? 14}px))`
  }

  viewer.scene.preRender.addEventListener(updatePosition)
  updatePosition()

  return {
    element,
    setContent(nextContent: string) {
      element.innerHTML = nextContent
      updatePosition()
    },
    setPosition(nextPosition: Cesium.Cartesian3) {
      currentPosition = nextPosition
      updatePosition()
    },
    show() {
      visible = true
      updatePosition()
    },
    hide() {
      visible = false
      element.style.display = 'none'
    },
    refresh: updatePosition,
    destroy: () => {
      viewer.scene.preRender.removeEventListener(updatePosition)
      element.remove()
    },
  }
}

function createNativeGifOverlay(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  position: Cesium.Cartesian3,
  url: string,
  scale: number,
) {
  const image = document.createElement('img')
  image.dataset.demoGif = 'true'
  image.alt = '动态飓风 GIF'
  image.decoding = 'async'
  image.src = url
  image.style.position = 'absolute'
  image.style.top = '0'
  image.style.left = '0'
  image.style.zIndex = '4'
  image.style.pointerEvents = 'none'
  image.style.display = 'none'
  image.style.filter = 'none'
  host.append(image)

  const updatePosition = () => {
    if (!image.complete || image.naturalWidth === 0) {
      return
    }

    const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position)
    if (
      !windowPosition ||
      !Number.isFinite(windowPosition.x) ||
      !Number.isFinite(windowPosition.y)
    ) {
      image.style.display = 'none'
      return
    }

    const width = Math.max(1, Math.round(image.naturalWidth * scale))
    const height = Math.max(1, Math.round(image.naturalHeight * scale))
    const hostWidth = host.clientWidth
    const hostHeight = host.clientHeight
    const x =
      hostWidth > 0
        ? Math.min(Math.max(windowPosition.x, width / 2), hostWidth - width / 2)
        : windowPosition.x
    const y =
      hostHeight > 0
        ? Math.min(Math.max(windowPosition.y, height), hostHeight - 8)
        : windowPosition.y

    image.style.width = `${width}px`
    image.style.height = `${height}px`
    image.style.display = 'block'
    image.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`
  }

  image.addEventListener('load', updatePosition)
  viewer.scene.preRender.addEventListener(updatePosition)
  updatePosition()

  return {
    replay() {
      image.src = `${url}?replay=${Date.now()}`
    },
    destroy() {
      image.removeEventListener('load', updatePosition)
      viewer.scene.preRender.removeEventListener(updatePosition)
      image.remove()
    },
  }
}

function createEntityPointScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const positions = [
    Cesium.Cartesian3.fromDegrees(113.28, 23.12, 2),
    Cesium.Cartesian3.fromDegrees(113.33, 23.17, 1_200),
    Cesium.Cartesian3.fromDegrees(113.39, 23.13, 2_400),
  ]
  const entities = positions.map((position, index) =>
    viewer.entities.add({
      id: `entity-point-${index + 1}`,
      name: ['贴地点', '空中点', '高远点'][index],
      position,
      point: {
        color: [Cesium.Color.YELLOW, Cesium.Color.CYAN, Cesium.Color.ORANGE][index],
        pixelSize: 14,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
      label: {
        text: ['贴地点', '空中点', '高远点'][index],
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#17283ecc'),
        pixelOffset: new Cesium.Cartesian2(0, -28),
      },
    }),
  )

  frameCamera(viewer, positions, CAMERA_PRESETS.entityPoint)
  setStatus('已展示贴地、空中和高远三种 Entity 点')

  return {
    actions: [
      {
        id: 'add-auto-height',
        label: '添加自动高度点',
        async run() {
          const cartographic = Cesium.Cartographic.fromDegrees(113.35, 23.2)
          let height = 80

          try {
            const [sampled] = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, [
              cartographic,
            ])
            height = (sampled?.height ?? 0) + 120
          } catch (error) {
            console.error('自动高度采样失败，使用默认高度', error)
          }

          const entity = viewer.entities.add({
            id: `auto-height-${Date.now()}`,
            name: '自动高度点',
            position: Cesium.Cartesian3.fromDegrees(113.35, 23.2, height),
            point: {
              color: Cesium.Color.LIME,
              pixelSize: 16,
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 2,
            },
          })
          entities.push(entity)
          setStatus(`已按地形高度 ${height.toFixed(1)} 米添加点位`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      removeEntities(viewer, entities)
    },
  }
}

function createEntityLineScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const lines = [
    viewer.entities.add({
      id: 'ground-line',
      name: '贴地红线',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          113.22, 23.1, 2, 113.29, 23.16, 2, 113.37, 23.12, 2, 113.45, 23.2, 2,
        ]),
        width: 8,
        material: Cesium.Color.RED,
        clampToGround: false,
      },
    }),
    viewer.entities.add({
      id: 'air-line',
      name: '空中蓝线',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          113.22, 23.1, 900, 113.29, 23.16, 1_400, 113.37, 23.12, 1_000, 113.45, 23.2, 1_800,
        ]),
        width: 5,
        material: Cesium.Color.DODGERBLUE,
        depthFailMaterial: Cesium.Color.ORANGE,
      },
    }),
    viewer.entities.add({
      id: 'high-line',
      name: '高空白线',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          113.24, 23.24, 3_500, 113.31, 23.2, 3_900, 113.4, 23.24, 3_600,
        ]),
        width: 3,
        material: Cesium.Color.WHITE,
      },
    }),
  ]

  frameCamera(
    viewer,
    [
      ...Cesium.Cartesian3.fromDegreesArrayHeights([
        113.22, 23.1, 2, 113.29, 23.16, 2, 113.37, 23.12, 2, 113.45, 23.2, 2,
      ]),
      ...Cesium.Cartesian3.fromDegreesArrayHeights([
        113.22, 23.1, 900, 113.29, 23.16, 1_400, 113.37, 23.12, 1_000, 113.45, 23.2, 1_800,
      ]),
      ...Cesium.Cartesian3.fromDegreesArrayHeights([
        113.24, 23.24, 3_500, 113.31, 23.2, 3_900, 113.4, 23.24, 3_600,
      ]),
    ],
    CAMERA_PRESETS.entityLine,
  )
  setStatus('红色贴地线启用深度检测，蓝色空中线显示被地形遮挡的段落')

  return {
    actions: [
      {
        id: 'toggle-depth',
        label: '切换地形深测',
        run() {
          viewer.scene.globe.depthTestAgainstTerrain = !viewer.scene.globe.depthTestAgainstTerrain
          setStatus(`地形深度检测已${viewer.scene.globe.depthTestAgainstTerrain ? '开启' : '关闭'}`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      removeEntities(viewer, lines)
    },
  }
}

function createEntityPolygonScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const positions = Cesium.Cartesian3.fromDegreesArray([
    113.24, 23.11, 113.31, 23.1, 113.34, 23.16, 113.29, 23.21, 113.23, 23.18,
  ])
  const extrudedPositions = Cesium.Cartesian3.fromDegreesArray([
    113.36, 23.13, 113.43, 23.11, 113.46, 23.18, 113.4, 23.22, 113.35, 23.19,
  ])
  const floatingPositions = Cesium.Cartesian3.fromDegreesArray([
    113.29, 23.24, 113.37, 23.22, 113.41, 23.28, 113.33, 23.31,
  ])
  const slantedPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
    113.44, 23.24, 420, 113.52, 23.22, 860, 113.55, 23.29, 620, 113.47, 23.32, 1_100,
  ])
  const entities = [
    viewer.entities.add({
      id: 'clamped-polygon',
      name: '贴地面',
      polygon: {
        hierarchy: positions,
        height: 0,
        material: Cesium.Color.fromCssColorString('#41c7a5aa'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    }),
    viewer.entities.add({
      id: 'extruded-polygon',
      name: '拉伸墙',
      polygon: {
        hierarchy: extrudedPositions,
        extrudedHeight: 280,
        material: Cesium.Color.fromCssColorString('#d63c46aa'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    }),
    viewer.entities.add({
      id: 'floating-polygon',
      name: '悬浮面',
      polygon: {
        hierarchy: floatingPositions,
        height: 820,
        material: Cesium.Color.fromCssColorString('#f3c64fbb'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    }),
    viewer.entities.add({
      id: 'slanted-polygon',
      name: '按点高度面',
      polygon: {
        hierarchy: slantedPositions,
        perPositionHeight: true,
        material: Cesium.Color.fromCssColorString('#4f8df7cc'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    }),
  ]

  frameCamera(
    viewer,
    [...positions, ...extrudedPositions, ...floatingPositions, ...slantedPositions],
    CAMERA_PRESETS.entityPolygon,
  )
  setStatus('已展示贴地面、拉伸墙、按点高度面和悬浮面，可缩放查看公共 API 配置效果')

  return {
    actions: [
      {
        id: 'zoom-all',
        label: '缩放到全部面',
        async run() {
          await viewer.flyTo(entities)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      removeEntities(viewer, entities)
    },
  }
}

async function createBillboardScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const markerImage = await loadBillboardImage(markerIconUrl)
  const billboard = viewer.entities.add({
    id: 'billboard-demo',
    name: '距离缩放图标',
    position: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80),
    billboard: {
      image: markerImage,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance: new Cesium.ConstantProperty(
        new Cesium.NearFarScalar(500, 1.8, 20_000, 0.32),
      ),
    },
  })

  frameCamera(
    viewer,
    [Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80)],
    CAMERA_PRESETS.marker,
  )
  setStatus('滚轮缩放相机可观察 Billboard 按距离自动缩放')

  return {
    actions: [
      {
        id: 'toggle-scale',
        label: '切换距离缩放',
        run() {
          billboard.billboard!.scaleByDistance =
            billboard.billboard!.scaleByDistance === undefined
              ? new Cesium.ConstantProperty(new Cesium.NearFarScalar(500, 1.8, 20_000, 0.32))
              : undefined
          setStatus(
            billboard.billboard!.scaleByDistance
              ? '已启用 NearFarScalar 距离缩放'
              : '已关闭距离缩放',
          )
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.entities.remove(billboard)
    },
  }
}

async function createBillboardCollectionScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const markerImage = await loadBillboardImage(markerIconUrl)
  const collection = new Cesium.BillboardCollection({ scene: viewer.scene })
  let seed = 20261110
  const random = () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296
    return seed / 4_294_967_296
  }

  for (let index = 0; index < 50_000; index += 1) {
    collection.add({
      position: Cesium.Cartesian3.fromDegrees(
        112.9 + random() * 1.2,
        22.8 + random() * 0.9,
        30 + random() * 4_500,
      ),
      image: markerImage,
      scale: 0.06 + random() * 0.08,
      scaleByDistance: new Cesium.NearFarScalar(2_000, 1, 160_000, 0.18),
    })
  }

  viewer.scene.primitives.add(collection)
  const framingPositions = [
    Cesium.Cartesian3.fromDegrees(112.9, 22.8, 30),
    Cesium.Cartesian3.fromDegrees(114.1, 22.8, 30),
    Cesium.Cartesian3.fromDegrees(112.9, 23.7, 30),
    Cesium.Cartesian3.fromDegrees(114.1, 23.7, 30),
    Cesium.Cartesian3.fromDegrees(113.5, 23.25, 4_500),
  ]
  frameCamera(viewer, framingPositions, CAMERA_PRESETS.billboardCollection)
  setStatus('BillboardCollection 已加载 50,000 个固定种子图标')

  return {
    actions: [
      {
        id: 'zoom-collection',
        label: '缩放到图标范围',
        run() {
          resetCameraView(viewer, framingPositions, CAMERA_PRESETS.billboardCollectionFocus)
        },
      },
    ],
    dispose() {
      viewer.scene.primitives.remove(collection)
    },
  }
}

function popupMarkup(title: string, detail: string, closable = false) {
  return `<div style="position:relative;min-width:190px;padding:14px 16px;color:#17283e;background:#fff;border:1px solid #d9e0e7;border-top:4px solid #d63c46;border-radius:10px;">
    <strong style="display:block;margin-bottom:5px;font-size:14px;">${title}</strong>
    <span style="font-size:12px;line-height:1.55;color:#617080;">${detail}</span>
    ${
      closable
        ? '<button type="button" data-popup-close style="position:absolute;top:6px;right:8px;padding:2px 5px;color:#6b7785;cursor:pointer;background:transparent;border:0;font-size:16px;" aria-label="关闭弹窗">×</button>'
        : ''
    }
  </div>`
}

function createPopupScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  setStatus: StatusReporter,
): VectorScene {
  const positions = [
    Cesium.Cartesian3.fromDegrees(113.27, 23.12, 50),
    Cesium.Cartesian3.fromDegrees(113.34, 23.17, 50),
    Cesium.Cartesian3.fromDegrees(113.42, 23.13, 50),
  ]
  const entities = positions.map((position, index) =>
    viewer.entities.add({
      id: `popup-anchor-${index + 1}`,
      position,
      point: { color: Cesium.Color.RED, pixelSize: 10 },
    }),
  )
  const overlays = [
    createHtmlOverlay(
      viewer,
      host,
      positions[0]!,
      popupMarkup('跟随世界坐标', '相机移动时通过 preRender 更新屏幕位置。', true),
      { closable: true },
    ),
    createHtmlOverlay(
      viewer,
      host,
      positions[1]!,
      popupMarkup('自定义 HTML', '标题、描述和样式都由项目内 HTML 控制。'),
    ),
    createHtmlOverlay(
      viewer,
      host,
      positions[2]!,
      popupMarkup('第三个弹窗', '所有覆盖层都会在场景销毁时移除监听器。'),
    ),
  ]

  overlays[0]?.element
    .querySelector<HTMLElement>('[data-popup-close]')
    ?.addEventListener('click', () => {
      overlays[0]?.hide()
      setStatus('已关闭第一个 HTML 弹窗')
    })

  const frameOverview = () => frameCamera(viewer, positions, CAMERA_PRESETS.popup)
  frameOverview()
  overlays.forEach((overlay) => overlay.refresh())
  setStatus('三个 HTML 弹窗跟随固定世界坐标，可关闭第一个弹窗')

  return {
    actions: [
      {
        id: 'recenter-popups',
        label: '重新定位弹窗',
        run() {
          frameOverview()
          overlays.forEach((overlay) => {
            overlay.show()
            overlay.refresh()
          })
          requestRender(viewer)
          setStatus('相机已回到弹窗展示视角')
        },
      },
    ],
    dispose() {
      overlays.forEach((overlay) => overlay.destroy())
      removeEntities(viewer, entities)
    },
  }
}

async function createGeoJsonScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const dataSource = await Cesium.GeoJsonDataSource.load(districtGeoJson as unknown as object, {
    clampToGround: true,
    stroke: Cesium.Color.WHITE,
    strokeWidth: 3,
    fill: Cesium.Color.fromCssColorString('#e667a1aa'),
  })

  for (const entity of dataSource.entities.values) {
    if (!entity.polygon) {
      continue
    }

    const height = Number(entity.properties?.height?.getValue() ?? 100)
    entity.polygon.material = new Cesium.ColorMaterialProperty(
      Cesium.Color.fromCssColorString('#e667a1bb'),
    )
    entity.polygon.extrudedHeight = new Cesium.ConstantProperty(height)
    entity.polygon.outline = new Cesium.ConstantProperty(true)
    entity.polygon.outlineColor = new Cesium.ConstantProperty(Cesium.Color.WHITE)
  }

  viewer.dataSources.add(dataSource)
  await viewer.flyTo(dataSource)
  setStatus('本地 GeoJSON 已加载，并按要素属性设置拉伸高度')

  return {
    actions: [
      {
        id: 'zoom-geojson',
        label: '缩放到数据范围',
        async run() {
          await viewer.flyTo(dataSource)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.dataSources.remove(dataSource)
    },
  }
}

function createPrimitiveScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const positions = Cesium.Cartesian3.fromDegreesArray([
    113.27, 23.11, 113.34, 23.1, 113.37, 23.17, 113.31, 23.21, 113.25, 23.17,
  ])
  const linePositions = Cesium.Cartesian3.fromDegreesArrayHeights([
    113.25, 23.23, 1_200, 113.32, 23.26, 1_700, 113.4, 23.23, 1_300,
  ])
  const glowPositions = Cesium.Cartesian3.fromDegreesArray([
    113.23, 23.12, 113.3, 23.08, 113.39, 23.14, 113.47, 23.21,
  ])
  const polygonPrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: Cesium.PolygonGeometry.fromPositions({ positions }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString('#43c6accc'),
        ),
      },
    }),
    appearance: new Cesium.PerInstanceColorAppearance({
      translucent: true,
      closed: false,
    }),
    asynchronous: false,
  })
  const linePrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: linePositions,
        width: 8,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.DODGERBLUE),
      },
    }),
    appearance: new Cesium.PolylineColorAppearance(),
    asynchronous: false,
  })
  const glowPrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: glowPositions,
        width: 10,
      }),
    }),
    appearance: new Cesium.PolylineMaterialAppearance({
      material: Cesium.Material.fromType('PolylineGlow', {
        color: Cesium.Color.ORANGE,
        glowPower: 0.24,
      }),
    }),
    asynchronous: false,
  })
  const primitives = [polygonPrimitive, linePrimitive, glowPrimitive]
  primitives.forEach((primitive) => viewer.scene.primitives.add(primitive))
  const framingPositions = [...positions, ...linePositions, ...glowPositions]
  const frameOverview = () => frameCamera(viewer, framingPositions, CAMERA_PRESETS.primitive)
  frameOverview()

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = viewer.scene.pick(movement.position)
    if (picked?.primitive) {
      setStatus('已选中一个 Primitive 图元')
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  setStatus('已创建多边形、线和发光线 Primitive，点击图元可查看选中反馈')

  return {
    actions: [
      {
        id: 'focus-primitive',
        label: '回到总览',
        run() {
          resetCameraView(viewer, framingPositions, CAMERA_PRESETS.primitive)
        },
      },
    ],
    dispose() {
      handler.destroy()
      primitives.forEach((primitive) => viewer.scene.primitives.remove(primitive))
    },
  }
}

function createAllPrimitiveScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const rectangle = Cesium.Rectangle.fromDegrees(113.21, 23.07, 113.27, 23.12)
  const polygonPositions = Cesium.Cartesian3.fromDegreesArray([
    113.29, 23.08, 113.35, 23.09, 113.37, 23.15, 113.31, 23.17,
  ])
  const wallPositions = Cesium.Cartesian3.fromDegreesArrayHeights([
    113.4, 23.1, 300, 113.44, 23.1, 300, 113.47, 23.15, 300, 113.43, 23.18, 300,
  ])
  const corridorPositions = Cesium.Cartesian3.fromDegreesArray([
    113.25, 23.21, 113.31, 23.23, 113.36, 23.2, 113.42, 23.24,
  ])
  const volumePositions = Cesium.Cartesian3.fromDegreesArrayHeights([
    113.26, 23.26, 800, 113.32, 23.28, 900, 113.38, 23.26, 850,
  ])
  const ellipsoidMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(113.39, 23.24, 1_500),
  )
  const boxMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(113.24, 23.16, 1_700),
  )
  const cylinderMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(113.36, 23.08, 2_600),
  )
  const framingPositions = [
    ...Cesium.Cartesian3.fromDegreesArray([
      113.21, 23.07, 113.27, 23.07, 113.21, 23.12, 113.27, 23.12,
    ]),
    ...polygonPositions,
    ...wallPositions,
    ...corridorPositions,
    ...volumePositions,
    Cesium.Cartesian3.fromDegrees(113.39, 23.24, 1_000),
    Cesium.Cartesian3.fromDegrees(113.39, 23.24, 2_000),
    Cesium.Cartesian3.fromDegrees(113.24, 23.16, 700),
    Cesium.Cartesian3.fromDegrees(113.24, 23.16, 2_700),
    Cesium.Cartesian3.fromDegrees(113.36, 23.08, 1_400),
    Cesium.Cartesian3.fromDegrees(113.36, 23.08, 3_800),
    Cesium.Cartesian3.fromDegrees(113.3, 23.17, 300),
    Cesium.Cartesian3.fromDegrees(113.32, 23.19, 300),
    Cesium.Cartesian3.fromDegrees(113.41, 23.12, 300),
    Cesium.Cartesian3.fromDegrees(113.43, 23.14, 300),
    Cesium.Cartesian3.fromDegrees(113.24, 23.16, 950),
    Cesium.Cartesian3.fromDegrees(113.36, 23.05, 1_100),
    Cesium.Cartesian3.fromDegrees(113.4, 23.1, 900),
    Cesium.Cartesian3.fromDegrees(113.47, 23.18, 900),
  ]

  const geometries = [
    new Cesium.GeometryInstance({
      geometry: new Cesium.RectangleGeometry({ rectangle }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.CYAN),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: Cesium.PolygonGeometry.fromPositions({ positions: polygonPositions }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.LIME),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.EllipseGeometry({
        center: Cesium.Cartesian3.fromDegrees(113.31, 23.18),
        semiMajorAxis: 900,
        semiMinorAxis: 600,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.ORANGE),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.CircleGeometry({
        center: Cesium.Cartesian3.fromDegrees(113.42, 23.13),
        radius: 680,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.MAGENTA),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.EllipsoidGeometry({
        radii: new Cesium.Cartesian3(900, 600, 500),
      }),
      modelMatrix: ellipsoidMatrix,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.YELLOW),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.BoxGeometry({
        minimum: new Cesium.Cartesian3(-800, -600, -1_000),
        maximum: new Cesium.Cartesian3(800, 600, 1_000),
      }),
      modelMatrix: boxMatrix,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.DODGERBLUE),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.CylinderGeometry({
        length: 2_400,
        topRadius: 500,
        bottomRadius: 900,
      }),
      modelMatrix: cylinderMatrix,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.WHITE),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.WallGeometry({
        positions: wallPositions,
        maximumHeights: [900, 900, 900, 900],
        minimumHeights: [0, 0, 0, 0],
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
          Cesium.Color.fromCssColorString('#8fe7ffcc'),
        ),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.CorridorGeometry({
        positions: corridorPositions,
        width: 240,
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineVolumeGeometry({
        polylinePositions: volumePositions,
        shapePositions: [
          new Cesium.Cartesian2(-80, -80),
          new Cesium.Cartesian2(80, -80),
          new Cesium.Cartesian2(80, 80),
          new Cesium.Cartesian2(-80, 80),
        ],
      }),
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.ORANGE),
      },
    }),
  ]

  const primitive = new Cesium.Primitive({
    geometryInstances: geometries,
    appearance: new Cesium.PerInstanceColorAppearance({
      flat: true,
      translucent: true,
    }),
    asynchronous: false,
  })
  viewer.scene.primitives.add(primitive)
  frameCamera(viewer, framingPositions, CAMERA_PRESETS.allPrimitive)
  setStatus('已创建矩形、多边形、椭圆、圆、椭球、盒体、圆柱、墙、走廊和折线体')

  return {
    actions: [
      {
        id: 'focus-all',
        label: '回到几何体总览',
        run() {
          resetCameraView(viewer, framingPositions, CAMERA_PRESETS.allPrimitive)
        },
      },
    ],
    dispose() {
      viewer.scene.primitives.remove(primitive)
    },
  }
}

function createEntityCollectionScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): VectorScene {
  const dataSource = new Cesium.CustomDataSource('entity-collection-demo')
  viewer.dataSources.add(dataSource)
  let sequence = 0
  const initialPositions: Cesium.Cartesian3[] = []

  const addEntity = () => {
    sequence += 1
    const offset = (sequence % 5) * 0.012
    const position = Cesium.Cartesian3.fromDegrees(113.28 + offset, 23.12 + offset, 600)
    dataSource.entities.add({
      id: `collection-entity-${sequence}`,
      name: `集合实体 ${sequence}`,
      position,
      point: {
        color: Cesium.Color.fromCssColorString('#44d7b6'),
        pixelSize: 18,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    })
    initialPositions.push(position)
    setStatus(`EntityCollection 当前包含 ${dataSource.entities.values.length} 个实体`)
    requestRender(viewer)
  }

  addEntity()
  addEntity()
  addEntity()
  frameCamera(
    viewer,
    [
      ...initialPositions,
      ...Cesium.Cartesian3.fromDegreesArray([
        113.28, 23.12, 113.328, 23.168, 113.28, 23.168, 113.328, 23.12,
      ]),
    ],
    CAMERA_PRESETS.entityCollection,
  )

  return {
    actions: [
      { id: 'add', label: '添加实体', run: addEntity },
      {
        id: 'remove-first',
        label: '移除首个实体',
        run() {
          const first = dataSource.entities.values[0]
          if (first) {
            dataSource.entities.remove(first)
          }
          setStatus(`已移除首个实体，剩余 ${dataSource.entities.values.length} 个`)
          requestRender(viewer)
        },
      },
      {
        id: 'query-count',
        label: '查询数量',
        run() {
          setStatus(`EntityCollection 共 ${dataSource.entities.values.length} 个实体`)
        },
      },
      {
        id: 'query-first',
        label: '按 ID 查询',
        run() {
          const entity = dataSource.entities.getById('collection-entity-1')
          const index = dataSource.entities.values.findIndex(
            (item) => item.id === 'collection-entity-1',
          )
          setStatus(
            entity
              ? `已按 ID 找到 collection-entity-1，当前位于第 ${index + 1} 位`
              : '未找到 collection-entity-1',
          )
        },
      },
      {
        id: 'promote-first',
        label: '置顶首个实体',
        run() {
          const first = dataSource.entities.values[0]
          if (first && dataSource.entities.values.length > 1) {
            dataSource.entities.remove(first)
            dataSource.entities.add(first)
          }
          const order = dataSource.entities.values.map((entity) => entity.id).join('、')
          setStatus(`实体顺序已更新：${order || '空'}`)
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      viewer.dataSources.remove(dataSource)
    },
  }
}

function createEntityOperationScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  let sequence = 0
  const entities: Cesium.Entity[] = []
  const addEntity = () => {
    sequence += 1
    const id = `operation-entity-${sequence}`
    const offset = (sequence % 4) * 0.014
    const entity = viewer.entities.add({
      id,
      name: `操作实体 ${sequence}`,
      position: Cesium.Cartesian3.fromDegrees(113.25 + offset, 23.1 + offset, 500),
      point: {
        color: Cesium.Color.fromCssColorString('#f3c64f'),
        pixelSize: 18,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    })
    entities.push(entity)
    setStatus(`已添加 ${id}，当前共 ${viewer.entities.values.length} 个 Entity`)
    requestRender(viewer)
  }
  addEntity()
  addEntity()
  frameCamera(
    viewer,
    [
      Cesium.Cartesian3.fromDegrees(113.25, 23.1, 500),
      Cesium.Cartesian3.fromDegrees(113.292, 23.142, 500),
    ],
    CAMERA_PRESETS.entityOperation,
  )

  return {
    actions: [
      { id: 'add', label: '添加 Entity', run: addEntity },
      {
        id: 'query',
        label: '按 ID 查询',
        run() {
          const entity = viewer.entities.getById('operation-entity-1')
          setStatus(entity ? '已按 ID 找到 operation-entity-1' : '未找到 operation-entity-1')
        },
      },
      {
        id: 'remove-object',
        label: '按对象移除',
        run() {
          const entity = entities.pop()
          if (entity) {
            viewer.entities.remove(entity)
          }
          setStatus(`已按对象移除，剩余 ${viewer.entities.values.length} 个 Entity`)
          requestRender(viewer)
        },
      },
      {
        id: 'remove-id',
        label: '按 ID 移除',
        run() {
          viewer.entities.removeById('operation-entity-1')
          const index = entities.findIndex((entity) => entity.id === 'operation-entity-1')
          if (index >= 0) {
            entities.splice(index, 1)
          }
          setStatus(`已按 ID 移除，剩余 ${viewer.entities.values.length} 个 Entity`)
          requestRender(viewer)
        },
      },
      {
        id: 'remove-all',
        label: '全部移除',
        run() {
          viewer.entities.removeAll()
          entities.length = 0
          setStatus('已移除 Viewer 中的全部 Entity')
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      removeEntities(viewer, entities)
      entities.length = 0
    },
  }
}

function createHtmlOverlayScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  setStatus: StatusReporter,
): VectorScene {
  const position = Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 30)
  const entity = viewer.entities.add({
    id: 'html-overlay-anchor',
    position,
    point: { color: Cesium.Color.RED, pixelSize: 12 },
  })
  const overlay = createHtmlOverlay(
    viewer,
    host,
    position,
    popupMarkup('气泡窗口', '覆盖层跟随地面点，并在相机移动时持续更新。'),
    { offsetY: 18 },
  )
  frameCamera(viewer, [position], CAMERA_PRESETS.htmlOverlay)
  overlay.show()
  overlay.refresh()
  setStatus('HTML 气泡正在跟随固定地面点')

  return {
    actions: [
      {
        id: 'recenter',
        label: '重新定位气泡',
        run() {
          resetCameraView(viewer, [position], CAMERA_PRESETS.htmlOverlay)
          overlay.show()
          overlay.refresh()
          setStatus('气泡窗口已跟随到新的相机视角')
        },
      },
    ],
    dispose() {
      overlay.destroy()
      viewer.entities.remove(entity)
    },
  }
}

async function createClickPopupScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const markerImage = await loadBillboardImage(markerIconUrl)
  const positions = [
    Cesium.Cartesian3.fromDegrees(113.3, 23.14, 30),
    Cesium.Cartesian3.fromDegrees(113.38, 23.18, 30),
  ]
  const entities = positions.map((position, index) =>
    viewer.entities.add({
      id: `click-icon-${index + 1}`,
      name: index === 0 ? '设备 A' : '设备 B',
      position,
      properties: {
        temperature: index === 0 ? 26 : 31,
        status: index === 0 ? '在线' : '待巡检',
      },
      billboard: {
        image: markerImage,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        scale: 0.72,
      },
    }),
  )
  const overlay = createHtmlOverlay(
    viewer,
    host,
    positions[0]!,
    popupMarkup('设备 A', '温度 26°C · 在线'),
    { closable: true, offsetY: 4, visible: false },
  )

  const openEntityPopup = (entity: Cesium.Entity) => {
    const entityPosition = entity.position?.getValue(viewer.clock.currentTime)
    if (!entityPosition) {
      return
    }

    overlay.setContent(
      popupMarkup(
        entity.name ?? '未命名实体',
        `温度 ${entity.properties?.temperature?.getValue() ?? '-'}°C · ${entity.properties?.status?.getValue() ?? '-'}`,
        true,
      ),
    )
    overlay.setPosition(entityPosition)
    overlay.show()
    setStatus(`已打开 ${entity.name} 的数据气泡`)
  }

  overlay.element.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof Element && target.closest('[data-popup-close]')) {
      overlay.hide()
      setStatus('数据气泡已关闭')
    }
  })

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = viewer.scene.pick(movement.position)
    const entity = picked?.id as Cesium.Entity | undefined
    if (!entity?.position) {
      return
    }
    openEntityPopup(entity)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  frameCamera(viewer, positions, CAMERA_PRESETS.clickPopup)
  overlay.hide()
  setStatus('点击任意图标，在该位置打开包含数据的气泡')

  return {
    actions: [
      {
        id: 'show-first-popup',
        label: '打开设备 A 气泡',
        run() {
          const entity = entities[0]
          if (entity) {
            openEntityPopup(entity)
          }
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      handler.destroy()
      overlay.destroy()
      removeEntities(viewer, entities)
    },
  }
}

function createRoadScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const entities: Cesium.Entity[] = []
  const highlightEntities: Cesium.Entity[] = []
  const framingPositions: Cesium.Cartesian3[] = []
  let alternate = false

  for (const [index, feature] of roadGeoJson.features.entries()) {
    const positions = Cesium.Cartesian3.fromDegreesArrayHeights(
      feature.geometry.coordinates.flatMap(([longitude, latitude]) => [longitude, latitude, 24]),
    )
    framingPositions.push(...positions)
    const roadWidth = Math.max(12, feature.properties.width / 7)
    const common = {
      positions,
      clampToGround: false,
    }

    entities.push(
      viewer.entities.add({
        id: `road-underlay-${index}`,
        name: `${feature.properties.name}路基`,
        polyline: {
          ...common,
          width: roadWidth + 8,
          material: Cesium.Color.fromCssColorString('#242b33'),
        },
      }),
      viewer.entities.add({
        id: `road-shoulder-${index}`,
        name: `${feature.properties.name}边线`,
        polyline: {
          ...common,
          width: roadWidth + 4,
          material: Cesium.Color.fromCssColorString('#f2f4f5'),
        },
      }),
    )

    const highlight = viewer.entities.add({
      id: `road-highlight-${index}`,
      name: `${feature.properties.name}黄色路面`,
      polyline: {
        ...common,
        width: roadWidth,
        material: Cesium.Color.fromCssColorString('#f3c64f'),
      },
    })
    entities.push(highlight)
    highlightEntities.push(highlight)

    entities.push(
      viewer.entities.add({
        id: `road-centerline-${index}`,
        name: `${feature.properties.name}黑白虚线`,
        polyline: {
          ...common,
          width: 3,
          material: new Cesium.PolylineDashMaterialProperty({
            color: Cesium.Color.WHITE,
            gapColor: Cesium.Color.fromCssColorString('#20262d'),
            dashLength: 28,
          }),
        },
      }),
    )
  }

  frameCamera(viewer, framingPositions, CAMERA_PRESETS.road)
  setStatus('本地道路数据已生成路基、边线、黑色虚线和黄色路面')

  return {
    actions: [
      {
        id: 'toggle-road-material',
        label: '切换道路材质',
        run() {
          alternate = !alternate
          for (const entity of highlightEntities) {
            entity.polyline!.material = new Cesium.ColorMaterialProperty(
              alternate
                ? Cesium.Color.fromCssColorString('#d63c46')
                : Cesium.Color.fromCssColorString('#f3c64f'),
            )
          }
          requestRender(viewer)
          setStatus(`道路材质已切换为${alternate ? '红色中心线' : '黄色道路'}`)
        },
      },
    ],
    dispose() {
      removeEntities(viewer, entities)
    },
  }
}

async function createSvgScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="160" viewBox="0 0 240 160">
    <defs><linearGradient id="g" x1="0" x2="1"><stop stop-color="#44d7b6"/><stop offset="1" stop-color="#2d7ff9"/></linearGradient></defs>
    <rect x="10" y="10" width="220" height="140" rx="24" fill="url(#g)"/>
    <path d="M62 112 L102 56 L138 96 L178 42" fill="none" stroke="#fff" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="178" cy="42" r="18" fill="#fff"/>
  </svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  let objectUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  if (typeof URL.createObjectURL === 'function') {
    try {
      objectUrl = URL.createObjectURL(blob)
    } catch (error) {
      console.error('SVG Blob URL 创建失败，使用 Data URL', error)
    }
  }
  const svgImage = await loadBillboardImage(objectUrl)
  const entity = viewer.entities.add({
    id: 'svg-billboard',
    position: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80),
    billboard: {
      image: svgImage,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })
  frameCamera(
    viewer,
    [Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80)],
    CAMERA_PRESETS.markerClose,
  )
  setStatus('自制 SVG 已转为本地 Blob URL 并用作 Billboard')

  return {
    actions: [
      {
        id: 'reset-svg',
        label: '重置 SVG 视角',
        run() {
          resetCameraView(
            viewer,
            [Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80)],
            CAMERA_PRESETS.markerClose,
          )
          setStatus('已重置 SVG Billboard 视角')
        },
      },
    ],
    dispose() {
      viewer.entities.remove(entity)
      if (objectUrl.startsWith('blob:')) {
        URL.revokeObjectURL(objectUrl)
      }
    },
  }
}

async function createGifScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  const position = Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80)
  const gifFallbackImage = await loadBillboardImage(hurricaneGifUrl)
  let frameTimer: ReturnType<typeof setInterval> | undefined
  let decoder: ImageDecoder | undefined
  let drawFrame: (() => Promise<void>) | undefined
  let activeFrame: string | HTMLCanvasElement | HTMLImageElement = gifFallbackImage
  let nativeGifOverlay: ReturnType<typeof createNativeGifOverlay> | undefined
  let usesNativeGif = false

  const entity = viewer.entities.add({
    id: 'gif-billboard',
    position,
    billboard: {
      image: new Cesium.CallbackProperty(() => activeFrame, false),
      scale: 0.55,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })

  const useNativeGif = () => {
    usesNativeGif = true
    entity.show = false
    nativeGifOverlay = createNativeGifOverlay(viewer, host, position, hurricaneGifUrl, 0.55)
    setStatus('当前浏览器使用原生 GIF 动画播放')
  }

  const ImageDecoderClass =
    typeof globalThis.ImageDecoder === 'function' ? globalThis.ImageDecoder : undefined

  if (ImageDecoderClass) {
    try {
      const response = await fetch(hurricaneGifUrl)
      const data = await response.arrayBuffer()
      decoder = new ImageDecoderClass({ data, type: 'image/gif' })
      await decoder.tracks.ready
      const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 2
      const probeCanvas = document.createElement('canvas')
      const context = probeCanvas.getContext('2d')

      if (context && frameCount > 1) {
        let frameIndex = 0
        drawFrame = async () => {
          const { image } = await decoder!.decode({ frameIndex })
          const frameCanvas = document.createElement('canvas')
          frameCanvas.width = Math.max(1, image.displayWidth ?? 96)
          frameCanvas.height = Math.max(1, image.displayHeight ?? 96)
          const frameContext = frameCanvas.getContext('2d')
          frameContext?.clearRect(0, 0, frameCanvas.width, frameCanvas.height)
          frameContext?.drawImage(image, 0, 0, frameCanvas.width, frameCanvas.height)
          image.close()
          activeFrame = frameCanvas
          requestRender(viewer)
          frameIndex = (frameIndex + 1) % frameCount
        }
        await drawFrame()
        frameTimer = setInterval(() => {
          void drawFrame?.()
        }, 120)
        setStatus('GIF 已通过 ImageDecoder 解码为动画帧')
      } else {
        useNativeGif()
      }
    } catch (error) {
      decoder?.close()
      decoder = undefined
      console.error('GIF 动画解码失败，降级为浏览器原生动画', error)
      useNativeGif()
    }
  } else {
    useNativeGif()
  }

  frameCamera(viewer, [position], CAMERA_PRESETS.markerClose)

  return {
    actions: usesNativeGif
      ? [
          {
            id: 'replay-gif',
            label: '重新播放 GIF',
            run() {
              nativeGifOverlay?.replay()
              setStatus('GIF 动画已重新开始播放')
            },
          },
        ]
      : [
          {
            id: 'toggle-gif',
            label: '暂停/继续动画',
            run() {
              if (frameTimer) {
                clearInterval(frameTimer)
                frameTimer = undefined
                setStatus('GIF 动画已暂停')
              } else if (drawFrame) {
                frameTimer = setInterval(() => {
                  void drawFrame?.()
                }, 120)
                setStatus('GIF 动画已继续播放')
              }
            },
          },
        ],
    dispose() {
      if (frameTimer) {
        clearInterval(frameTimer)
      }
      decoder?.close()
      nativeGifOverlay?.destroy()
      viewer.entities.remove(entity)
    },
  }
}

export async function createVectorScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  sceneId: VectorSceneId,
  setStatus: StatusReporter,
): Promise<VectorScene> {
  viewer.scene.globe.enableLighting = false
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#07111f')

  switch (sceneId) {
    case 'entity-point':
      return createEntityPointScene(viewer, setStatus)
    case 'entity-line':
      return createEntityLineScene(viewer, setStatus)
    case 'entity-polygon':
      return createEntityPolygonScene(viewer, setStatus)
    case 'billboard':
      return createBillboardScene(viewer, setStatus)
    case 'billboard-collection':
      return createBillboardCollectionScene(viewer, setStatus)
    case 'popup':
      return createPopupScene(viewer, host, setStatus)
    case 'geojson':
      return createGeoJsonScene(viewer, setStatus)
    case 'primitive':
      return createPrimitiveScene(viewer, setStatus)
    case 'all-primitive':
      return createAllPrimitiveScene(viewer, setStatus)
    case 'entity-collection':
      return createEntityCollectionScene(viewer, setStatus)
    case 'entity-operation':
      return createEntityOperationScene(viewer, setStatus)
    case 'html-overlay':
      return createHtmlOverlayScene(viewer, host, setStatus)
    case 'click-popup':
      return createClickPopupScene(viewer, host, setStatus)
    case 'road':
      return createRoadScene(viewer, setStatus)
    case 'svg':
      return createSvgScene(viewer, setStatus)
    case 'gif':
      return createGifScene(viewer, host, setStatus)
  }
}
