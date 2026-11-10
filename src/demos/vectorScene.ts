import * as Cesium from 'cesium'

import pulseGifUrl from '@/assets/vector-demo-pulse.gif'
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
const markerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="128" viewBox="0 0 96 128">
  <path d="M48 4C25 4 7 22 7 45c0 31 41 79 41 79s41-48 41-79C89 22 71 4 48 4Z" fill="#d63c46" stroke="#fff" stroke-width="5"/>
  <circle cx="48" cy="44" r="18" fill="#fff"/>
  <circle cx="48" cy="44" r="8" fill="#17283e"/>
</svg>`
const markerDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markerSvg)}`

function requestRender(viewer: Cesium.Viewer) {
  viewer.scene.requestRender()
}

function focusCamera(viewer: Cesium.Viewer) {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 9_000),
    orientation: {
      heading: Cesium.Math.toRadians(10),
      pitch: Cesium.Math.toRadians(-52),
      roll: 0,
    },
  })
}

function createHtmlOverlay(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  position: Cesium.Cartesian3,
  content: string,
  options: { closable?: boolean; offsetY?: number } = {},
) {
  const element = document.createElement('div')
  element.className = 'vector-demo-overlay'
  element.dataset.demoOverlay = 'true'
  element.innerHTML = content
  element.style.position = 'absolute'
  element.style.zIndex = '4'
  element.style.maxWidth = '280px'
  element.style.pointerEvents = options.closable ? 'auto' : 'none'
  element.style.filter = 'drop-shadow(0 10px 22px rgb(0 0 0 / 28%))'
  host.append(element)

  const updatePosition = () => {
    const windowPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position)
    if (
      !windowPosition ||
      !Number.isFinite(windowPosition.x) ||
      !Number.isFinite(windowPosition.y)
    ) {
      element.style.display = 'none'
      return
    }

    element.style.display = 'block'
    element.style.transform = `translate(${windowPosition.x}px, ${windowPosition.y}px) translate(-50%, calc(-100% - ${options.offsetY ?? 14}px))`
  }

  viewer.scene.preRender.addEventListener(updatePosition)
  updatePosition()

  return {
    element,
    destroy: () => {
      viewer.scene.preRender.removeEventListener(updatePosition)
      element.remove()
    },
  }
}

function createEntityPointScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const positions = [
    Cesium.Cartesian3.fromDegrees(113.28, 23.12, 0),
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
        heightReference: index === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : undefined,
      },
      label: {
        text: ['贴地点', '空中点', '高远点'][index],
        font: '14px sans-serif',
        fillColor: Cesium.Color.WHITE,
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString('#17283ecc'),
        pixelOffset: new Cesium.Cartesian2(0, -28),
        heightReference: index === 0 ? Cesium.HeightReference.CLAMP_TO_GROUND : undefined,
      },
    }),
  )

  focusCamera(viewer)
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
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createEntityLineScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const lines = [
    viewer.entities.add({
      id: 'ground-line',
      name: '贴地红线',
      polyline: {
        positions: Cesium.Cartesian3.fromDegreesArray([
          113.22, 23.1, 113.29, 23.16, 113.37, 23.12, 113.45, 23.2,
        ]),
        width: 8,
        material: Cesium.Color.RED,
        clampToGround: true,
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

  focusCamera(viewer)
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
      lines.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createEntityPolygonScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const positions = Cesium.Cartesian3.fromDegreesArray([
    113.24, 23.11, 113.31, 23.1, 113.34, 23.16, 113.29, 23.21, 113.23, 23.18,
  ])
  const entities = [
    viewer.entities.add({
      id: 'clamped-polygon',
      name: '贴地面',
      polygon: {
        hierarchy: positions,
        material: Cesium.Color.fromCssColorString('#41c7a5aa'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    }),
    viewer.entities.add({
      id: 'extruded-polygon',
      name: '拉伸墙',
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          113.36, 23.13, 113.43, 23.11, 113.46, 23.18, 113.4, 23.22, 113.35, 23.19,
        ]),
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
        hierarchy: Cesium.Cartesian3.fromDegreesArray([
          113.29, 23.24, 113.37, 23.22, 113.41, 23.28, 113.33, 23.31,
        ]),
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
        hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights([
          113.44, 23.24, 420, 113.52, 23.22, 860, 113.55, 23.29, 620, 113.47, 23.32, 1_100,
        ]),
        perPositionHeight: true,
        material: Cesium.Color.fromCssColorString('#4f8df7cc'),
        outline: true,
        outlineColor: Cesium.Color.WHITE,
      },
    }),
  ]

  focusCamera(viewer)
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
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createBillboardScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const billboard = viewer.entities.add({
    id: 'billboard-demo',
    name: '距离缩放图标',
    position: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80),
    billboard: {
      image: markerDataUrl,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      scaleByDistance: new Cesium.ConstantProperty(
        new Cesium.NearFarScalar(500, 1.8, 20_000, 0.32),
      ),
    },
  })

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 2_500),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-55),
      roll: 0,
    },
  })
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

function createBillboardCollectionScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): VectorScene {
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
      image: markerDataUrl,
      scale: 0.06 + random() * 0.08,
      scaleByDistance: new Cesium.NearFarScalar(2_000, 1, 160_000, 0.18),
    })
  }

  viewer.scene.primitives.add(collection)
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.4, 23.2, 42_000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-60),
      roll: 0,
    },
  })
  setStatus('BillboardCollection 已加载 50,000 个固定种子图标')

  return {
    actions: [
      {
        id: 'zoom-collection',
        label: '缩放到图标范围',
        run() {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(113.4, 23.2, 24_000),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-68),
              roll: 0,
            },
          })
          requestRender(viewer)
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
      overlays[0]?.element.remove()
      setStatus('已关闭第一个 HTML 弹窗')
    })

  focusCamera(viewer)
  setStatus('三个 HTML 弹窗跟随固定世界坐标，可关闭第一个弹窗')

  return {
    actions: [
      {
        id: 'recenter-popups',
        label: '重新定位弹窗',
        run() {
          focusCamera(viewer)
          requestRender(viewer)
          setStatus('相机已回到弹窗展示视角')
        },
      },
    ],
    dispose() {
      overlays.forEach((overlay) => overlay.destroy())
      entities.forEach((entity) => viewer.entities.remove(entity))
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
        positions: Cesium.Cartesian3.fromDegreesArrayHeights([
          113.25, 23.23, 1_200, 113.32, 23.26, 1_700, 113.4, 23.23, 1_300,
        ]),
        width: 8,
      }),
    }),
    appearance: new Cesium.PolylineColorAppearance(),
    asynchronous: false,
  })
  const glowPrimitive = new Cesium.Primitive({
    geometryInstances: new Cesium.GeometryInstance({
      geometry: new Cesium.PolylineGeometry({
        positions: Cesium.Cartesian3.fromDegreesArray([
          113.23, 23.12, 113.3, 23.08, 113.39, 23.14, 113.47, 23.21,
        ]),
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
  focusCamera(viewer)

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
          focusCamera(viewer)
          requestRender(viewer)
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
    Cesium.Cartesian3.fromDegrees(113.39, 23.24, 1_200),
  )
  const boxMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(113.24, 23.16, 500),
  )
  const cylinderMatrix = Cesium.Transforms.eastNorthUpToFixedFrame(
    Cesium.Cartesian3.fromDegrees(113.36, 23.05, 600),
  )

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
        radii: new Cesium.Cartesian3(500, 320, 240),
      }),
      modelMatrix: ellipsoidMatrix,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.YELLOW),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.BoxGeometry({
        minimum: new Cesium.Cartesian3(-400, -300, -450),
        maximum: new Cesium.Cartesian3(400, 300, 450),
      }),
      modelMatrix: boxMatrix,
      attributes: {
        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.DODGERBLUE),
      },
    }),
    new Cesium.GeometryInstance({
      geometry: new Cesium.CylinderGeometry({
        length: 1_200,
        topRadius: 240,
        bottomRadius: 480,
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
  focusCamera(viewer)
  setStatus('已创建矩形、多边形、椭圆、圆、椭球、盒体、圆柱、墙、走廊和折线体')

  return {
    actions: [
      {
        id: 'focus-all',
        label: '回到几何体总览',
        run() {
          focusCamera(viewer)
          requestRender(viewer)
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

  const addEntity = () => {
    sequence += 1
    const offset = (sequence % 5) * 0.012
    dataSource.entities.add({
      id: `collection-entity-${sequence}`,
      name: `集合实体 ${sequence}`,
      position: Cesium.Cartesian3.fromDegrees(113.28 + offset, 23.12 + offset, 600),
      point: {
        color: Cesium.Color.fromCssColorString('#44d7b6'),
        pixelSize: 13,
        outlineColor: Cesium.Color.WHITE,
        outlineWidth: 2,
      },
    })
    setStatus(`EntityCollection 当前包含 ${dataSource.entities.values.length} 个实体`)
    requestRender(viewer)
  }

  addEntity()
  focusCamera(viewer)

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
        pixelSize: 14,
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
  focusCamera(viewer)

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
      entities.forEach((entity) => viewer.entities.remove(entity))
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
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 3_800),
    orientation: {
      heading: Cesium.Math.toRadians(25),
      pitch: Cesium.Math.toRadians(-48),
      roll: 0,
    },
  })
  setStatus('HTML 气泡正在跟随固定地面点')

  return {
    actions: [
      {
        id: 'recenter',
        label: '重新定位气泡',
        run() {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 3_800),
            orientation: {
              heading: Cesium.Math.toRadians(25),
              pitch: Cesium.Math.toRadians(-48),
              roll: 0,
            },
          })
          requestRender(viewer)
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

function createClickPopupScene(
  viewer: Cesium.Viewer,
  host: HTMLElement,
  setStatus: StatusReporter,
): VectorScene {
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
        image: markerDataUrl,
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
    { closable: true, offsetY: 4 },
  )
  overlay.element.style.display = 'none'

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
  handler.setInputAction((movement: Cesium.ScreenSpaceEventHandler.PositionedEvent) => {
    const picked = viewer.scene.pick(movement.position)
    const entity = picked?.id as Cesium.Entity | undefined
    if (!entity?.position) {
      return
    }

    const position = entity.position.getValue(viewer.clock.currentTime)
    if (!position) {
      return
    }
    overlay.element.innerHTML = popupMarkup(
      entity.name ?? '未命名实体',
      `温度 ${entity.properties?.temperature?.getValue() ?? '-'}°C · ${entity.properties?.status?.getValue() ?? '-'}`,
      true,
    )
    overlay.element.style.display = 'block'
    const screenPosition = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, position)
    if (screenPosition) {
      overlay.element.style.transform = `translate(${screenPosition.x}px, ${screenPosition.y}px) translate(-50%, calc(-100% - 4px))`
    }
    setStatus(`已打开 ${entity.name} 的数据气泡`)
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.34, 23.16, 5_500),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-55),
      roll: 0,
    },
  })
  setStatus('点击任意图标，在该位置打开包含数据的气泡')

  return {
    actions: [
      {
        id: 'show-first-popup',
        label: '打开设备 A 气泡',
        run() {
          setStatus('设备 A 气泡已显示在地图锚点上方')
          overlay.element.style.display = 'block'
          requestRender(viewer)
        },
      },
    ],
    dispose() {
      handler.destroy()
      overlay.destroy()
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createRoadScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
  const entities: Cesium.Entity[] = []
  const highlightEntities: Cesium.Entity[] = []
  let alternate = false

  for (const [index, feature] of roadGeoJson.features.entries()) {
    const positions = Cesium.Cartesian3.fromDegreesArray(
      feature.geometry.coordinates.flatMap(([longitude, latitude]) => [longitude, latitude]),
    )
    const roadWidth = Math.max(12, feature.properties.width / 7)
    const common = {
      positions,
      clampToGround: true,
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

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(113.35, 23.17, 24_000),
    orientation: {
      heading: Cesium.Math.toRadians(8),
      pitch: Cesium.Math.toRadians(-62),
      roll: 0,
    },
  })
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
      entities.forEach((entity) => viewer.entities.remove(entity))
    },
  }
}

function createSvgScene(viewer: Cesium.Viewer, setStatus: StatusReporter): VectorScene {
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
  const entity = viewer.entities.add({
    id: 'svg-billboard',
    position: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80),
    billboard: {
      image: objectUrl,
      scale: 1,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 2_200),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-58),
      roll: 0,
    },
  })
  setStatus('自制 SVG 已转为本地 Blob URL 并用作 Billboard')

  return {
    actions: [
      {
        id: 'reset-svg',
        label: '重置 SVG 视角',
        run() {
          viewer.camera.setView({
            destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 2_200),
            orientation: {
              heading: 0,
              pitch: Cesium.Math.toRadians(-58),
              roll: 0,
            },
          })
          requestRender(viewer)
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
  setStatus: StatusReporter,
): Promise<VectorScene> {
  let frameTimer: ReturnType<typeof setInterval> | undefined
  let decoder: ImageDecoder | undefined
  let canvas: HTMLCanvasElement | undefined
  let drawFrame: (() => Promise<void>) | undefined

  const entity = viewer.entities.add({
    id: 'gif-billboard',
    position: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 80),
    billboard: {
      image: new Cesium.CallbackProperty(() => canvas ?? pulseGifUrl, false),
      scale: 1.5,
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
    },
  })

  const ImageDecoderClass =
    typeof globalThis.ImageDecoder === 'function' ? globalThis.ImageDecoder : undefined

  if (ImageDecoderClass) {
    try {
      const response = await fetch(pulseGifUrl)
      const data = await response.arrayBuffer()
      decoder = new ImageDecoderClass({ data, type: 'image/gif' })
      await decoder.tracks.ready
      const frameCount = decoder.tracks.selectedTrack?.frameCount ?? 2
      canvas = document.createElement('canvas')
      const context = canvas.getContext('2d')

      if (context && frameCount > 1) {
        let frameIndex = 0
        drawFrame = async () => {
          const { image } = await decoder!.decode({ frameIndex })
          canvas!.width = Math.max(1, image.displayWidth ?? 96)
          canvas!.height = Math.max(1, image.displayHeight ?? 96)
          context.clearRect(0, 0, canvas!.width, canvas!.height)
          context.drawImage(image, 0, 0, canvas!.width, canvas!.height)
          image.close()
          requestRender(viewer)
          frameIndex = (frameIndex + 1) % frameCount
        }
        await drawFrame()
        frameTimer = setInterval(() => {
          void drawFrame?.()
        }, 120)
        setStatus('GIF 已通过 ImageDecoder 解码为动画帧')
      } else {
        canvas = undefined
        setStatus('GIF 仅包含静态帧，已显示静态画面')
      }
    } catch (error) {
      canvas = undefined
      console.error('GIF 动画解码失败，降级为静态帧', error)
      setStatus('GIF 动画解码失败，已显示静态帧')
    }
  } else {
    setStatus('当前浏览器不支持 GIF 帧解码，已显示静态帧')
  }

  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(CENTER.longitude, CENTER.latitude, 2_200),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-58),
      roll: 0,
    },
  })

  return {
    actions: [
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
          } else {
            setStatus('当前为静态帧，无法继续动画')
          }
        },
      },
    ],
    dispose() {
      if (frameTimer) {
        clearInterval(frameTimer)
      }
      decoder?.close()
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
      return createGifScene(viewer, setStatus)
  }
}
