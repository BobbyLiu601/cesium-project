import { MagicStick, Setting } from '@element-plus/icons-vue'
import type { Component } from 'vue'

import elevationImage from '@/assets/elevation-cover.jpg'
import radarEffectCover from '@/assets/radar-effect-cover.jpg'
import threeDimensionalEarthImage from '@/assets/three-dimensional-earth.svg'

export interface FeatureItem {
  id: string
  name: string
  imageSrc: string
  imageAlt: string
}

export interface FeatureSection {
  id: 'basic-config' | 'effects'
  title: string
  icon: Component
  items: FeatureItem[]
}

export const featureSections: FeatureSection[] = [
  {
    id: 'basic-config',
    title: '基础配置',
    icon: Setting,
    items: [
      {
        id: 'three-dimensional-earth',
        name: '三维地球',
        imageSrc: threeDimensionalEarthImage,
        imageAlt: '蓝色三维地球与环绕轨道示意图',
      },
      {
        id: 'elevation',
        name: '高程',
        imageSrc: elevationImage,
        imageAlt: '从化山地三维地形效果',
      },
    ],
  },
  {
    id: 'effects',
    title: '视觉效果',
    icon: MagicStick,
    items: [
      {
        id: 'radar',
        name: '雷达图',
        imageSrc: radarEffectCover,
        imageAlt: '广州海珠区三维雷达扫描效果截图',
      },
    ],
  },
]

export const featureAnchors = featureSections.flatMap((section) =>
  section.items.map((item) => item.id),
)
