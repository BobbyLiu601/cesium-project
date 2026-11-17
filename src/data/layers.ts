import {
  Box,
  DataAnalysis,
  Film,
  FolderOpened,
  Location,
  MagicStick,
  MapLocation,
  TrendCharts,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'

import amapImage from '@/assets/amap-cover.jpg'
import elevationImage from '@/assets/elevation-cover.jpg'
import tiandituImage from '@/assets/tianditu-cover.jpg'
import heightFogCover from '@/assets/effect-covers/3-1-5-height-fog.jpg'
import lightningCover from '@/assets/effect-covers/3-1-4-lightning.jpg'
import nearGroundSkyboxCover from '@/assets/effect-covers/3-1-2-near-ground-skybox.jpg'
import skyboxCover from '@/assets/effect-covers/3-1-1-skybox.jpg'
import volumetricCloudCover from '@/assets/effect-covers/3-1-3-volumetric-cloud.jpg'
import explosionCover from '@/assets/effect-covers/3-3-3-explosion.jpg'
import fireCover from '@/assets/effect-covers/3-3-1-fire.jpg'
import smokeCover from '@/assets/effect-covers/3-3-5-smoke.jpg'
import sprayCover from '@/assets/effect-covers/3-3-4-spray.jpg'
import waterGunCover from '@/assets/effect-covers/3-3-2-water-gun.jpg'
import modelInterpolationCover from '@/assets/model-covers/model-interpolation.jpg'
import windTurbineCover from '@/assets/model-covers/wind-turbine.jpg'
import ballRotationCover from '@/assets/physics-covers/3-4-3-ball-rotation.jpg'
import flagRotationCover from '@/assets/physics-covers/3-4-2-flag-rotation.jpg'
import fractureCollisionCover from '@/assets/physics-covers/3-4-5-fracture-collision.jpg'
import softBodyCollisionCover from '@/assets/physics-covers/3-4-4-soft-body-collision.jpg'
import vehicleMotionCover from '@/assets/physics-covers/3-4-1-vehicle-motion.jpg'
import curveInterpolationCover from '@/assets/special-shape-covers/3-2-6-curve-interpolation.jpg'
import electronicFence2Cover from '@/assets/special-shape-covers/3-2-10-electronic-fence-2.jpg'
import electronicFenceCover from '@/assets/special-shape-covers/3-2-9-electronic-fence.jpg'
import frustumCover from '@/assets/special-shape-covers/3-2-1-frustum.jpg'
import manualFrustumCover from '@/assets/special-shape-covers/3-2-2-manual-frustum.jpg'
import movingFrustumCover from '@/assets/special-shape-covers/3-2-3-moving-frustum.jpg'
import outlineConeCover from '@/assets/special-shape-covers/3-2-7-cone.jpg'
import radarConeCover from '@/assets/special-shape-covers/3-2-4-cone.jpg'
import radarMaskScanCover from '@/assets/special-shape-covers/3-2-11-radar-mask-scan.jpg'
import radarScanCover from '@/assets/special-shape-covers/3-2-8-radar-scan.jpg'
import solidWallCover from '@/assets/special-shape-covers/3-2-5-solid-wall.jpg'
import aspectAnalysisCover from '@/assets/spatial-covers/2-1-4-aspect-analysis.jpg'
import inundationAnalysisCover from '@/assets/spatial-covers/2-1-1-inundation-analysis-simple.jpg'
import sunlightAnalysisCover from '@/assets/spatial-covers/2-1-2-sunlight-analysis.jpg'
import waterSurfaceCover from '@/assets/spatial-covers/2-1-3-water-surface.jpg'
import videoProjectionCover from '@/assets/spatial-covers/2-2-2-video-projection-livestream.jpg'
import videoTextureCover from '@/assets/spatial-covers/2-2-1-video-texture.jpg'
import isosurfaceCover from '@/assets/visualization-covers/4-1-3-isosurface.jpg'
import overlayAnalysisCover from '@/assets/visualization-covers/4-1-1-overlay-analysis.jpg'
import thiessenPolygonCover from '@/assets/visualization-covers/4-1-2-thiessen-polygon.jpg'
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
  | 'inundation-analysis-simple'
  | 'sunlight-analysis'
  | 'water-surface'
  | 'aspect-analysis'
  | 'video-texture'
  | 'video-projection-livestream'

export type EffectSceneId =
  'skybox' | 'near-ground-skybox' | 'volumetric-cloud' | 'lightning' | 'height-fog'

export type SpecialShapeSceneId =
  | 'frustum'
  | 'manual-frustum'
  | 'moving-frustum'
  | 'cone'
  | 'solid-wall'
  | 'curve-interpolation'
  | 'outline-cone'
  | 'radar-scan'
  | 'electronic-fence'
  | 'electronic-fence-2'
  | 'radar-mask-scan'

export type ParticleSceneId =
  | 'particle-fire'
  | 'particle-water-gun'
  | 'particle-explosion'
  | 'particle-spray'
  | 'particle-smoke'

export type PhysicsEngineSceneId =
  | 'vehicle-motion'
  | 'flag-rotation'
  | 'ball-rotation'
  | 'soft-body-collision'
  | 'fracture-collision'

export type VisualizationSceneId = 'overlay-analysis' | 'thiessen-polygon' | 'isosurface'

export type FeatureKind =
  | 'tianditu'
  | 'amap'
  | 'elevation'
  | 'vector'
  | 'model'
  | 'spatial'
  | 'effects'
  | 'special-shapes'
  | 'particles'
  | 'physics-engine'
  | 'visualization'

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
  effectSceneId?: EffectSceneId
  specialShapeSceneId?: SpecialShapeSceneId
  particleSceneId?: ParticleSceneId
  physicsEngineSceneId?: PhysicsEngineSceneId
  visualizationSceneId?: VisualizationSceneId
}

export interface FeatureSection {
  id:
    | 'imagery'
    | 'terrain'
    | 'vector'
    | 'model'
    | 'spatial'
    | 'video-fusion'
    | 'effects'
    | 'special-shapes'
    | 'particle-effects'
    | 'physics-engine'
    | 'gis-client'
  code: string
  title: string
  icon: Component
  items: FeatureItem[]
}

export interface MenuGroup {
  id: 'layers' | 'spatial' | 'effects' | 'visualization'
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

export const videoFusionSection: FeatureSection = {
  id: 'video-fusion',
  code: '2.2',
  title: '视频融合',
  icon: Film,
  items: [
    defineFeature({
      id: 'video-texture',
      code: '2.2.1',
      name: '视频纹理',
      imageSrc: videoTextureCover,
      imageAlt: '视频纹理参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'video-texture',
      routeName: 'spatial-analysis-video-texture',
      routePath: '/spatial-analysis/2-2-1-video-texture',
    }),
    defineFeature({
      id: 'video-projection-livestream',
      code: '2.2.2',
      name: '视频投射(直播流)',
      imageSrc: videoProjectionCover,
      imageAlt: '视频投射参考示例封面',
      kind: 'spatial',
      spatialSceneId: 'video-projection-livestream',
      routeName: 'spatial-analysis-video-projection-livestream',
      routePath: '/spatial-analysis/2-2-2-video-projection-livestream',
    }),
  ],
}

export const effectSection: FeatureSection = {
  id: 'effects',
  code: '3.1',
  title: '场景特效',
  icon: MagicStick,
  items: [
    defineFeature({
      id: 'skybox',
      code: '3.1.1',
      name: '天空盒',
      imageSrc: skyboxCover,
      imageAlt: '天空盒参考示例封面',
      kind: 'effects',
      effectSceneId: 'skybox',
      routeName: 'effect-scene-skybox',
      routePath: '/effects/scene/3-1-1-skybox',
    }),
    defineFeature({
      id: 'near-ground-skybox',
      code: '3.1.2',
      name: '近地天空盒',
      imageSrc: nearGroundSkyboxCover,
      imageAlt: '近地天空盒参考示例封面',
      kind: 'effects',
      effectSceneId: 'near-ground-skybox',
      routeName: 'effect-scene-near-ground-skybox',
      routePath: '/effects/scene/3-1-2-near-ground-skybox',
    }),
    defineFeature({
      id: 'volumetric-cloud',
      code: '3.1.3',
      name: '体积云',
      imageSrc: volumetricCloudCover,
      imageAlt: '体积云参考示例封面',
      kind: 'effects',
      effectSceneId: 'volumetric-cloud',
      routeName: 'effect-scene-volumetric-cloud',
      routePath: '/effects/scene/3-1-3-volumetric-cloud',
    }),
    defineFeature({
      id: 'lightning',
      code: '3.1.4',
      name: '闪电',
      imageSrc: lightningCover,
      imageAlt: '闪电参考示例封面',
      kind: 'effects',
      effectSceneId: 'lightning',
      routeName: 'effect-scene-lightning',
      routePath: '/effects/scene/3-1-4-lightning',
    }),
    defineFeature({
      id: 'height-fog',
      code: '3.1.5',
      name: '高度雾',
      imageSrc: heightFogCover,
      imageAlt: '高度雾参考示例封面',
      kind: 'effects',
      effectSceneId: 'height-fog',
      routeName: 'effect-scene-height-fog',
      routePath: '/effects/scene/3-1-5-height-fog',
    }),
  ],
}

export const specialShapeSection: FeatureSection = {
  id: 'special-shapes',
  code: '3.2',
  title: '特殊形状',
  icon: MagicStick,
  items: [
    defineFeature({
      id: 'frustum',
      code: '3.2.1',
      name: '视锥体',
      imageSrc: frustumCover,
      imageAlt: '视锥体参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'frustum',
      routeName: 'special-shape-frustum',
      routePath: '/effects/special-shapes/3-2-1-frustum',
    }),
    defineFeature({
      id: 'manual-frustum',
      code: '3.2.2',
      name: '手动视锥体',
      imageSrc: manualFrustumCover,
      imageAlt: '手动视锥体参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'manual-frustum',
      routeName: 'special-shape-manual-frustum',
      routePath: '/effects/special-shapes/3-2-2-manual-frustum',
    }),
    defineFeature({
      id: 'moving-frustum',
      code: '3.2.3',
      name: '移动的视锥体',
      imageSrc: movingFrustumCover,
      imageAlt: '移动的视锥体参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'moving-frustum',
      routeName: 'special-shape-moving-frustum',
      routePath: '/effects/special-shapes/3-2-3-moving-frustum',
    }),
    defineFeature({
      id: 'radar-cone',
      code: '3.2.4',
      name: '圆锥体',
      imageSrc: radarConeCover,
      imageAlt: '雷达条纹圆锥体参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'cone',
      routeName: 'special-shape-radar-cone',
      routePath: '/effects/special-shapes/3-2-4-cone',
    }),
    defineFeature({
      id: 'solid-wall',
      code: '3.2.5',
      name: '立体墙',
      imageSrc: solidWallCover,
      imageAlt: '立体墙参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'solid-wall',
      routeName: 'special-shape-solid-wall',
      routePath: '/effects/special-shapes/3-2-5-solid-wall',
    }),
    defineFeature({
      id: 'curve-interpolation',
      code: '3.2.6',
      name: '曲线插值',
      imageSrc: curveInterpolationCover,
      imageAlt: '曲线插值参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'curve-interpolation',
      routeName: 'special-shape-curve-interpolation',
      routePath: '/effects/special-shapes/3-2-6-curve-interpolation',
    }),
    defineFeature({
      id: 'outline-cone',
      code: '3.2.7',
      name: '圆锥体',
      imageSrc: outlineConeCover,
      imageAlt: '带描边圆锥体参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'outline-cone',
      routeName: 'special-shape-outline-cone',
      routePath: '/effects/special-shapes/3-2-7-cone',
    }),
    defineFeature({
      id: 'radar-scan',
      code: '3.2.8',
      name: '雷达扫描',
      imageSrc: radarScanCover,
      imageAlt: '雷达扫描参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'radar-scan',
      routeName: 'special-shape-radar-scan',
      routePath: '/effects/special-shapes/3-2-8-radar-scan',
    }),
    defineFeature({
      id: 'electronic-fence',
      code: '3.2.9',
      name: '电子围栏',
      imageSrc: electronicFenceCover,
      imageAlt: '电子围栏参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'electronic-fence',
      routeName: 'special-shape-electronic-fence',
      routePath: '/effects/special-shapes/3-2-9-electronic-fence',
    }),
    defineFeature({
      id: 'electronic-fence-2',
      code: '3.2.10',
      name: '电子围栏2',
      imageSrc: electronicFence2Cover,
      imageAlt: '电子围栏2参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'electronic-fence-2',
      routeName: 'special-shape-electronic-fence-2',
      routePath: '/effects/special-shapes/3-2-10-electronic-fence-2',
    }),
    defineFeature({
      id: 'radar-mask-scan',
      code: '3.2.11',
      name: '雷达遮罩扫描',
      imageSrc: radarMaskScanCover,
      imageAlt: '雷达遮罩扫描参考示例封面',
      kind: 'special-shapes',
      specialShapeSceneId: 'radar-mask-scan',
      routeName: 'special-shape-radar-mask-scan',
      routePath: '/effects/special-shapes/3-2-11-radar-mask-scan',
    }),
  ],
}

export const physicsEngineSection: FeatureSection = {
  id: 'physics-engine',
  code: '3.4',
  title: '物理引擎',
  icon: MagicStick,
  items: [
    defineFeature({
      id: 'vehicle-motion',
      code: '3.4.1',
      name: '车辆运动',
      imageSrc: vehicleMotionCover,
      imageAlt: 'Ammo.js 车辆在物理平台上运动参考示例封面',
      kind: 'physics-engine',
      physicsEngineSceneId: 'vehicle-motion',
      routeName: 'physics-engine-vehicle-motion',
      routePath: '/effects/physics-engine/3-4-1-vehicle-motion',
    }),
    defineFeature({
      id: 'flag-rotation',
      code: '3.4.2',
      name: '转动（旗子）',
      imageSrc: flagRotationCover,
      imageAlt: 'Ammo.js 旗面软体左右转动参考示例封面',
      kind: 'physics-engine',
      physicsEngineSceneId: 'flag-rotation',
      routeName: 'physics-engine-flag-rotation',
      routePath: '/effects/physics-engine/3-4-2-flag-rotation',
    }),
    defineFeature({
      id: 'ball-rotation',
      code: '3.4.3',
      name: '转动（球）',
      imageSrc: ballRotationCover,
      imageAlt: 'Ammo.js 软绳连接刚体球转动参考示例封面',
      kind: 'physics-engine',
      physicsEngineSceneId: 'ball-rotation',
      routeName: 'physics-engine-ball-rotation',
      routePath: '/effects/physics-engine/3-4-3-ball-rotation',
    }),
    defineFeature({
      id: 'soft-body-collision',
      code: '3.4.4',
      name: '撞击（软体）',
      imageSrc: softBodyCollisionCover,
      imageAlt: 'Ammo.js 小球撞击软体参考示例封面',
      kind: 'physics-engine',
      physicsEngineSceneId: 'soft-body-collision',
      routeName: 'physics-engine-soft-body-collision',
      routePath: '/effects/physics-engine/3-4-4-soft-body-collision',
    }),
    defineFeature({
      id: 'fracture-collision',
      code: '3.4.5',
      name: '撞击断裂体',
      imageSrc: fractureCollisionCover,
      imageAlt: 'Ammo.js 撞击导致塔桥断裂参考示例封面',
      kind: 'physics-engine',
      physicsEngineSceneId: 'fracture-collision',
      routeName: 'physics-engine-fracture-collision',
      routePath: '/effects/physics-engine/3-4-5-fracture-collision',
    }),
  ],
}

export const particleSection: FeatureSection = {
  id: 'particle-effects',
  code: '3.3',
  title: '粒子效果',
  icon: MagicStick,
  items: [
    defineFeature({
      id: 'particle-fire',
      code: '3.3.1',
      name: '火焰',
      imageSrc: fireCover,
      imageAlt: '火焰粒子效果参考示例封面',
      kind: 'particles',
      particleSceneId: 'particle-fire',
      routeName: 'effect-particle-fire',
      routePath: '/effects/particle-effects/3-3-1-fire',
    }),
    defineFeature({
      id: 'particle-water-gun',
      code: '3.3.2',
      name: '水枪',
      imageSrc: waterGunCover,
      imageAlt: '水枪粒子效果参考示例封面',
      kind: 'particles',
      particleSceneId: 'particle-water-gun',
      routeName: 'effect-particle-water-gun',
      routePath: '/effects/particle-effects/3-3-2-water-gun',
    }),
    defineFeature({
      id: 'particle-explosion',
      code: '3.3.3',
      name: '爆炸',
      imageSrc: explosionCover,
      imageAlt: '爆炸粒子效果参考示例封面',
      kind: 'particles',
      particleSceneId: 'particle-explosion',
      routeName: 'effect-particle-explosion',
      routePath: '/effects/particle-effects/3-3-3-explosion',
    }),
    defineFeature({
      id: 'particle-spray',
      code: '3.3.4',
      name: '喷雾',
      imageSrc: sprayCover,
      imageAlt: '喷雾粒子效果参考示例封面',
      kind: 'particles',
      particleSceneId: 'particle-spray',
      routeName: 'effect-particle-spray',
      routePath: '/effects/particle-effects/3-3-4-spray',
    }),
    defineFeature({
      id: 'particle-smoke',
      code: '3.3.5',
      name: '烟',
      imageSrc: smokeCover,
      imageAlt: '烟雾粒子效果参考示例封面',
      kind: 'particles',
      particleSceneId: 'particle-smoke',
      routeName: 'effect-particle-smoke',
      routePath: '/effects/particle-effects/3-3-5-smoke',
    }),
  ],
}

export const gisClientSection: FeatureSection = {
  id: 'gis-client',
  code: '4.1',
  title: 'GIS客户端',
  icon: DataAnalysis,
  items: [
    defineFeature({
      id: 'overlay-analysis',
      code: '4.1.1',
      name: '叠加分析',
      imageSrc: overlayAnalysisCover,
      imageAlt: '叠加分析参考示例封面',
      kind: 'visualization',
      visualizationSceneId: 'overlay-analysis',
      routeName: 'visualization-gis-client-overlay-analysis',
      routePath: '/visualization/gis-client/4-1-1-overlay-analysis',
    }),
    defineFeature({
      id: 'thiessen-polygon',
      code: '4.1.2',
      name: '泰森多边形',
      imageSrc: thiessenPolygonCover,
      imageAlt: '泰森多边形参考示例封面',
      kind: 'visualization',
      visualizationSceneId: 'thiessen-polygon',
      routeName: 'visualization-gis-client-thiessen-polygon',
      routePath: '/visualization/gis-client/4-1-2-thiessen-polygon',
    }),
    defineFeature({
      id: 'isosurface',
      code: '4.1.3',
      name: '等值面',
      imageSrc: isosurfaceCover,
      imageAlt: '等值面参考示例封面',
      kind: 'visualization',
      visualizationSceneId: 'isosurface',
      routeName: 'visualization-gis-client-isosurface',
      routePath: '/visualization/gis-client/4-1-3-isosurface',
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

export const spatialMenuGroup: MenuGroup = {
  id: 'spatial',
  code: '2',
  title: '空间分析',
  icon: TrendCharts,
  sections: [spatialSection, videoFusionSection],
}

export const effectsMenuGroup: MenuGroup = {
  id: 'effects',
  code: '3',
  title: '特效',
  icon: MagicStick,
  sections: [effectSection, specialShapeSection, particleSection, physicsEngineSection],
}

export const visualizationMenuGroup: MenuGroup = {
  id: 'visualization',
  code: '4',
  title: '可视化',
  icon: DataAnalysis,
  sections: [gisClientSection],
}

export const menuGroups: MenuGroup[] = [
  layersMenuGroup,
  spatialMenuGroup,
  effectsMenuGroup,
  visualizationMenuGroup,
]

export const featureSections: FeatureSection[] = [
  ...layerSections,
  spatialSection,
  videoFusionSection,
  effectSection,
  specialShapeSection,
  particleSection,
  physicsEngineSection,
  gisClientSection,
]
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
  const menuGroup = menuGroups.find((group) =>
    group.sections.some(
      (section) => section.id === anchor || section.items.some((feature) => feature.id === anchor),
    ),
  )
  return menuGroup?.id ?? 'layers'
}
