import {
  Box,
  Film,
  FolderOpened,
  Location,
  MapLocation,
  TrendCharts,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

import amapImage from '@/assets/amap-cover.jpg'
import elevationImage from '@/assets/elevation-cover.jpg'
import tiandituImage from '@/assets/tianditu-cover.jpg'
import modelInterpolationCover from '@/assets/model-covers/model-interpolation.jpg'
import windTurbineCover from '@/assets/model-covers/wind-turbine.jpg'
import aspectAnalysisCover from '@/assets/spatial-covers/2-1-4-aspect-analysis.jpg'
import inundationAnalysisCover from '@/assets/spatial-covers/2-1-1-inundation-analysis-simple.jpg'
import sunlightAnalysisCover from '@/assets/spatial-covers/2-1-2-sunlight-analysis.jpg'
import waterSurfaceCover from '@/assets/spatial-covers/2-1-3-water-surface.jpg'
import allPrimitiveCover from '@/assets/vector-covers/all-primitive.jpg'
import billboardCover from '@/assets/vector-covers/billboard.jpg'
import billboardCollectionCover from '@/assets/vector-covers/billboard-collection.jpg'
import clickPopupCover from '@/assets/vector-covers/click-popup.jpg'
import entityCollectionCover from '@/assets/vector-covers/entity-collection.jpg'
import entityLineCover from '@/assets/vector-covers/entity-line.jpg'
import entityOperationCover from '@/assets/vector-covers/entity-operation.jpg'
import entityPointCover from '@/assets/vector-covers/entity-point.jpg'
import entityPolygonCover from '@/assets/vector-covers/entity-polygon.jpg'
import geojsonCover from '@/assets/vector-covers/geojson.jpg'
import gifCover from '@/assets/vector-covers/gif.jpg'
import htmlOverlayCover from '@/assets/vector-covers/html-overlay.jpg'
import popupCover from '@/assets/vector-covers/popup.jpg'
import primitiveCover from '@/assets/vector-covers/primitive.jpg'
import roadCover from '@/assets/vector-covers/road.jpg'
import svgCover from '@/assets/vector-covers/svg.jpg'

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

export type ModelSceneId = 'model-interpolation' | 'wind-turbine'

export type SpatialSceneId =
  'inundation-analysis-simple' | 'sunlight-analysis' | 'water-surface' | 'aspect-analysis'

export type FeatureKind = 'tianditu' | 'amap' | 'elevation' | 'vector' | 'model' | 'spatial'

export interface FeatureItem {
  id: string
  code: string
  /** 参考站中的原始名称，用于日志和无障碍兜底。 */
  name: string
  /** 菜单与卡片展示名称，默认由编号和原始名称生成。 */
  displayName: string
  imageSrc: string
  imageAlt: string
  kind: FeatureKind
  /** 可独立深链的功能才配置路由。 */
  routeName?: string
  routePath?: string
  sceneId?: VectorSceneId
  modelSceneId?: ModelSceneId
  spatialSceneId?: SpatialSceneId
}

export interface FeatureSection {
  id: 'imagery' | 'terrain' | 'vector' | 'model' | 'spatial'
  code: string
  title: string
  icon: Component
  items: FeatureItem[]
}

export interface MenuGroup {
  id: 'layers' | 'spatial'
  code: string
  title: string
  icon: Component
  sections: FeatureSection[]
}

export function formatMenuGroupTitle(group: Pick<MenuGroup, 'code' | 'title'>) {
  return group.code ? `${group.code}、${group.title}` : group.title
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

// 功能名称保持参考站原文，避免编号和检索关键词与来源偏离。
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
        imageAlt: '天地图卫星影像三维地球实际效果截图',
        kind: 'tianditu',
        routeName: 'layer-imagery-tianditu',
        routePath: '/layers/imagery/1-1-1-tianditu',
      }),
      defineFeature({
        id: 'amap',
        code: '1.1.2',
        name: '高德地图',
        imageSrc: amapImage,
        imageAlt: '高德地图标准矢量三维地球实际效果截图',
        kind: 'amap',
        routeName: 'layer-imagery-amap',
        routePath: '/layers/imagery/1-1-2-amap',
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

export const modelSection: FeatureSection = {
  id: 'model',
  code: '1.4',
  title: '模型',
  icon: Box,
  items: [
    defineFeature({
      id: 'model-interpolation',
      code: '1.4.1',
      name: '模型插值运动',
      imageSrc: modelInterpolationCover,
      imageAlt: '模型按采样点插值运动并显示完整轨迹示例封面',
      kind: 'model',
      modelSceneId: 'model-interpolation',
      routeName: 'layer-model-interpolation-motion',
      routePath: '/layers/model/1-4-1-model-interpolation-motion',
    }),
    defineFeature({
      id: 'wind-turbine',
      code: '1.4.2',
      name: '风力发电机',
      imageSrc: windTurbineCover,
      imageAlt: '按参考站高程数据布置的多台风力发电机示例封面',
      kind: 'model',
      modelSceneId: 'wind-turbine',
      routeName: 'layer-model-wind-turbine',
      routePath: '/layers/model/1-4-2-wind-turbine',
    }),
  ],
}

layerSections.push(modelSection)

export const spatialSection: FeatureSection = {
  id: 'spatial',
  code: '2.1',
  title: '空间分析',
  icon: TrendCharts,
  items: [
    defineFeature({
      id: 'inundation-analysis-simple',
      code: '2.1.1',
      name: '淹没分析（简易）',
      imageSrc: inundationAnalysisCover,
      imageAlt: '淹没分析（简易）参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'inundation-analysis-simple',
      routeName: 'spatial-analysis-inundation-simple',
      routePath: '/spatial-analysis/2-1-1-inundation-analysis-simple',
    }),
    defineFeature({
      id: 'sunlight-analysis',
      code: '2.1.2',
      name: '日照分析',
      imageSrc: sunlightAnalysisCover,
      imageAlt: '日照分析参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'sunlight-analysis',
      routeName: 'spatial-analysis-sunlight',
      routePath: '/spatial-analysis/2-1-2-sunlight-analysis',
    }),
    defineFeature({
      id: 'water-surface',
      code: '2.1.3',
      name: '水域面',
      imageSrc: waterSurfaceCover,
      imageAlt: '水域面参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'water-surface',
      routeName: 'spatial-analysis-water-surface',
      routePath: '/spatial-analysis/2-1-3-water-surface',
    }),
    defineFeature({
      id: 'aspect-analysis',
      code: '2.1.4',
      name: '坡向分析',
      imageSrc: aspectAnalysisCover,
      imageAlt: '坡向分析参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'aspect-analysis',
      routeName: 'spatial-analysis-aspect',
      routePath: '/spatial-analysis/2-1-4-aspect-analysis',
    }),
  ],
}

export const layersMenuGroup: MenuGroup = {
  id: 'layers',
  code: '1',
  title: '图层',
  icon: FolderOpened,
  sections: layerSections,
}

const spatialMenuGroup: MenuGroup = {
  id: 'spatial',
  code: '2',
  title: '空间分析',
  icon: TrendCharts,
  sections: [spatialSection],
}

export const menuGroups: MenuGroup[] = [layersMenuGroup, spatialMenuGroup]

export const featureSections: FeatureSection[] = [...layerSections, spatialSection]
export const allFeatures = featureSections.flatMap((section) => section.items)
export const featureAnchors = allFeatures.map((feature) => feature.id)
export const contentAnchors = [...featureAnchors, ...featureSections.map((section) => section.id)]
export const featuredRoutes = allFeatures.flatMap((feature) =>
  feature.routeName && feature.routePath
    ? [
        {
          path: feature.routePath,
          name: feature.routeName,
          featureId: feature.id,
        },
      ]
    : [],
)

export function getFeatureById(featureId: string | undefined) {
  return allFeatures.find((feature) => feature.id === featureId)
}

export function getNavigationAnchorForContent(anchor: string) {
  const section = featureSections.find(
    (section) => section.id === anchor || section.items.some((feature) => feature.id === anchor),
  )
  return section?.id ?? ''
}

export function getMenuGroupIdForAnchor(anchor: string): MenuGroup['id'] {
  return spatialSection.id === anchor ||
    spatialSection.items.some((feature) => feature.id === anchor)
    ? 'spatial'
    : 'layers'
}
