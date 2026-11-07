import elevationImage from '@/assets/elevation-cover.jpg'
import radarEffectCover from '@/assets/radar-effect-cover.jpg'
import threeDimensionalEarthImage from '@/assets/three-dimensional-earth.svg'

export interface FeatureItem {
  id: string
  name: string
  imageSrc: string
  imageAlt: string
}

export const featureItems: FeatureItem[] = [
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
]

export const effectItems: FeatureItem[] = [
  {
    id: 'radar',
    name: '雷达图',
    imageSrc: radarEffectCover,
    imageAlt: '广州海珠区三维雷达扫描效果截图',
  },
]
