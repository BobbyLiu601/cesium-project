import { Film, FolderOpened, Location, MagicStick, MapLocation } from '@element-plus/icons-vue'
import type { Component } from 'vue'

import elevationImage from '@/assets/elevation-cover.jpg'
import radarEffectCover from '@/assets/radar-effect-cover.jpg'
import tiandituImage from '@/assets/three-dimensional-earth.svg'
import allPrimitiveCover from '@/assets/vector-covers/all-primitive.svg'
import billboardCover from '@/assets/vector-covers/billboard.svg'
import billboardCollectionCover from '@/assets/vector-covers/billboard-collection.svg'
import clickPopupCover from '@/assets/vector-covers/click-popup.svg'
import entityCollectionCover from '@/assets/vector-covers/entity-collection.svg'
import entityLineCover from '@/assets/vector-covers/entity-line.svg'
import entityOperationCover from '@/assets/vector-covers/entity-operation.svg'
import entityPointCover from '@/assets/vector-covers/entity-point.svg'
import entityPolygonCover from '@/assets/vector-covers/entity-polygon.svg'
import geojsonCover from '@/assets/vector-covers/geojson.svg'
import gifCover from '@/assets/vector-covers/gif.svg'
import htmlOverlayCover from '@/assets/vector-covers/html-overlay.svg'
import popupCover from '@/assets/vector-covers/popup.svg'
import primitiveCover from '@/assets/vector-covers/primitive.svg'
import roadCover from '@/assets/vector-covers/road.svg'
import svgCover from '@/assets/vector-covers/svg.svg'

export type VectorSceneId =
  | 'entity-point'
  | 'entity-line'
  | 'entity-polygon'
  | 'billboard'
  | 'billboard-collection'
  | 'popup'
  | 'geojson'
  | 'primitive'
  | 'all-primitive'
  | 'entity-collection'
  | 'entity-operation'
  | 'html-overlay'
  | 'click-popup'
  | 'road'
  | 'svg'
  | 'gif'

export type FeatureKind = 'tianditu' | 'elevation' | 'vector' | 'radar'

export interface FeatureItem {
  id: string
  code: string
  name: string
  displayName: string
  imageSrc: string
  imageAlt: string
  kind: FeatureKind
  routeName: string
  routePath: string
  sceneId?: VectorSceneId
}

export interface FeatureSection {
  id: 'imagery' | 'terrain' | 'vector' | 'effects'
  code: string
  title: string
  icon: Component
  items: FeatureItem[]
}

export interface MenuGroup {
  id: 'layers' | 'effects'
  code: string
  title: string
  icon: Component
  sections: FeatureSection[]
}

function defineFeature(
  feature: Omit<FeatureItem, 'displayName'> & { displayName?: string },
): FeatureItem {
  return {
    ...feature,
    displayName:
      feature.displayName ?? (feature.code ? `${feature.code}、${feature.name}` : feature.name),
  }
}

export const layerSections: FeatureSection[] = [
  {
    id: 'imagery',
    code: '1.1',
    title: '影像',
    icon: Film,
    items: [
      defineFeature({
        id: 'tianditu',
        code: '1.1.1',
        name: '天地图',
        imageSrc: tiandituImage,
        imageAlt: '蓝色三维地球与环绕轨道示意图',
        kind: 'tianditu',
        routeName: 'layer-imagery-tianditu',
        routePath: '/layers/imagery/1-1-1-tianditu',
      }),
    ],
  },
  {
    id: 'terrain',
    code: '1.2',
    title: '地形',
    icon: MapLocation,
    items: [
      defineFeature({
        id: 'elevation',
        code: '1.2.1',
        name: '高程',
        imageSrc: elevationImage,
        imageAlt: '从化山地三维地形效果',
        kind: 'elevation',
        routeName: 'layer-terrain-elevation',
        routePath: '/layers/terrain/1-2-1-elevation',
      }),
    ],
  },
  {
    id: 'vector',
    code: '1.3',
    title: '矢量',
    icon: Location,
    items: [
      defineFeature({
        id: 'entity-point',
        code: '1.3.1',
        name: 'entity点',
        imageSrc: entityPointCover,
        imageAlt: 'Entity 点示例封面',
        kind: 'vector',
        sceneId: 'entity-point',
        routeName: 'layer-vector-entity-point',
        routePath: '/layers/vector/1-3-1-entity-point',
      }),
      defineFeature({
        id: 'entity-line',
        code: '1.3.2',
        name: 'entity线',
        imageSrc: entityLineCover,
        imageAlt: 'Entity 线示例封面',
        kind: 'vector',
        sceneId: 'entity-line',
        routeName: 'layer-vector-entity-line',
        routePath: '/layers/vector/1-3-2-entity-line',
      }),
      defineFeature({
        id: 'entity-polygon',
        code: '1.3.3',
        name: 'entity面',
        imageSrc: entityPolygonCover,
        imageAlt: 'Entity 面示例封面',
        kind: 'vector',
        sceneId: 'entity-polygon',
        routeName: 'layer-vector-entity-polygon',
        routePath: '/layers/vector/1-3-3-entity-polygon',
      }),
      defineFeature({
        id: 'billboard',
        code: '1.3.4',
        name: '图标',
        imageSrc: billboardCover,
        imageAlt: 'Billboard 图标示例封面',
        kind: 'vector',
        sceneId: 'billboard',
        routeName: 'layer-vector-billboard',
        routePath: '/layers/vector/1-3-4-billboard',
      }),
      defineFeature({
        id: 'billboard-collection',
        code: '1.3.5',
        name: '海量图标',
        imageSrc: billboardCollectionCover,
        imageAlt: 'BillboardCollection 海量图标示例封面',
        kind: 'vector',
        sceneId: 'billboard-collection',
        routeName: 'layer-vector-billboard-collection',
        routePath: '/layers/vector/1-3-5-billboard-collection',
      }),
      defineFeature({
        id: 'popup',
        code: '1.3.6',
        name: 'popup',
        imageSrc: popupCover,
        imageAlt: '跟随世界坐标的 HTML 弹窗示例封面',
        kind: 'vector',
        sceneId: 'popup',
        routeName: 'layer-vector-popup',
        routePath: '/layers/vector/1-3-6-popup',
      }),
      defineFeature({
        id: 'geojson',
        code: '1.3.7',
        name: 'geojson',
        imageSrc: geojsonCover,
        imageAlt: 'GeoJSON 面示例封面',
        kind: 'vector',
        sceneId: 'geojson',
        routeName: 'layer-vector-geojson',
        routePath: '/layers/vector/1-3-7-geojson',
      }),
      defineFeature({
        id: 'primitive',
        code: '1.3.8',
        name: 'Primitive',
        imageSrc: primitiveCover,
        imageAlt: 'Primitive 图元示例封面',
        kind: 'vector',
        sceneId: 'primitive',
        routeName: 'layer-vector-primitive',
        routePath: '/layers/vector/1-3-8-primitive',
      }),
      defineFeature({
        id: 'all-primitive',
        code: '1.3.9',
        name: 'AllPrimitive',
        imageSrc: allPrimitiveCover,
        imageAlt: 'AllPrimitive 几何体集合示例封面',
        kind: 'vector',
        sceneId: 'all-primitive',
        routeName: 'layer-vector-all-primitive',
        routePath: '/layers/vector/1-3-9-all-primitive',
      }),
      defineFeature({
        id: 'entity-collection',
        code: '1.3.10',
        name: 'entityCollection',
        imageSrc: entityCollectionCover,
        imageAlt: 'EntityCollection 示例封面',
        kind: 'vector',
        sceneId: 'entity-collection',
        routeName: 'layer-vector-entity-collection',
        routePath: '/layers/vector/1-3-10-entity-collection',
      }),
      defineFeature({
        id: 'entity-operation',
        code: '1.3.11',
        name: 'entity操作',
        imageSrc: entityOperationCover,
        imageAlt: 'Entity 操作示例封面',
        kind: 'vector',
        sceneId: 'entity-operation',
        routeName: 'layer-vector-entity-operation',
        routePath: '/layers/vector/1-3-11-entity-operation',
      }),
      defineFeature({
        id: 'html-overlay',
        code: '1.3.12',
        name: '气泡窗口',
        imageSrc: htmlOverlayCover,
        imageAlt: 'HTML 气泡窗口示例封面',
        kind: 'vector',
        sceneId: 'html-overlay',
        routeName: 'layer-vector-html-overlay',
        routePath: '/layers/vector/1-3-12-html-overlay',
      }),
      defineFeature({
        id: 'click-popup',
        code: '1.3.13',
        name: '气泡弹窗',
        imageSrc: clickPopupCover,
        imageAlt: '点击图标打开气泡弹窗示例封面',
        kind: 'vector',
        sceneId: 'click-popup',
        routeName: 'layer-vector-click-popup',
        routePath: '/layers/vector/1-3-13-click-popup',
      }),
      defineFeature({
        id: 'road',
        code: '1.3.14',
        name: '道路',
        imageSrc: roadCover,
        imageAlt: '道路材质示例封面',
        kind: 'vector',
        sceneId: 'road',
        routeName: 'layer-vector-road',
        routePath: '/layers/vector/1-3-14-road',
      }),
      defineFeature({
        id: 'svg',
        code: '1.3.15',
        name: 'svg',
        imageSrc: svgCover,
        imageAlt: 'SVG Billboard 示例封面',
        kind: 'vector',
        sceneId: 'svg',
        routeName: 'layer-vector-svg',
        routePath: '/layers/vector/1-3-15-svg',
      }),
      defineFeature({
        id: 'gif',
        code: '1.3.16',
        name: 'gif',
        imageSrc: gifCover,
        imageAlt: 'GIF 动画 Billboard 示例封面',
        kind: 'vector',
        sceneId: 'gif',
        routeName: 'layer-vector-gif',
        routePath: '/layers/vector/1-3-16-gif',
      }),
    ],
  },
]

export const effectsSection: FeatureSection = {
  id: 'effects',
  code: '',
  title: '视觉效果',
  icon: MagicStick,
  items: [
    defineFeature({
      id: 'radar',
      code: '',
      name: '雷达图',
      imageSrc: radarEffectCover,
      imageAlt: '广州海珠区三维雷达扫描效果截图',
      kind: 'radar',
      routeName: 'effects-radar',
      routePath: '/layers#radar',
    }),
  ],
}

export const menuGroups: MenuGroup[] = [
  {
    id: 'layers',
    code: '1',
    title: '图层',
    icon: FolderOpened,
    sections: layerSections,
  },
  {
    id: 'effects',
    code: '',
    title: '视觉效果',
    icon: MagicStick,
    sections: [effectsSection],
  },
]

export const featureSections: FeatureSection[] = [...layerSections, effectsSection]
export const allFeatures = featureSections.flatMap((section) => section.items)
export const featureAnchors = allFeatures.map((feature) => feature.id)
export const featuredRoutes = allFeatures
  .filter((feature) => feature.kind !== 'radar')
  .map((feature) => ({
    path: feature.routePath,
    name: feature.routeName,
    featureId: feature.id,
  }))

export function getFeatureById(featureId: string | undefined) {
  return allFeatures.find((feature) => feature.id === featureId)
}
