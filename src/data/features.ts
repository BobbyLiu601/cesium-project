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
]
