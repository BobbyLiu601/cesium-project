import * as Cesium from 'cesium'

import { createSpecialShapeAnimation, removeEntities } from '@/demos/specialShapes/shared'
import type { SpecialShapeScene, StatusReporter } from '@/demos/specialShapes/types'

export function createRadarConeScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const position = Cesium.Cartesian3.fromDegrees(114, 35, 500_000)
  const orientation = Cesium.Transforms.headingPitchRollQuaternion(
    position,
    new Cesium.HeadingPitchRoll(Cesium.Math.toRadians(135), 0, 0),
  )
  let animationElapsedMs = 0
  const material = new Cesium.StripeMaterialProperty({
    evenColor: Cesium.Color.CORAL.withAlpha(0.12),
    oddColor: Cesium.Color.CORAL.withAlpha(0.72),
    offset: new Cesium.CallbackProperty(() => {
      return (animationElapsedMs % 2_000) / 2_000
    }, false),
    repeat: 30,
  })
  const entity = viewer.entities.add({
    name: 'Red radar cone',
    orientation,
    position,
    cylinder: {
      bottomRadius: 50_000,
      length: 500_000,
      material,
      topRadius: 0,
    },
  })
  const animation = createSpecialShapeAnimation(viewer, (elapsedMs) => {
    animationElapsedMs = elapsedMs
  })

  void viewer.flyTo(entity)
  setStatus('红色雷达条纹圆锥体持续扫描播放中')

  return {
    actions: [],
    animationState: animation.state,
    dispose: () => {
      animation.dispose()
      removeEntities(viewer, [entity])
    },
    toggleAnimation: () => {
      const state = animation.toggle()
      setStatus(state === 'paused' ? '圆锥体扫描已暂停' : '圆锥体扫描继续播放中')
    },
  }
}

export function createOutlineConeScene(
  viewer: Cesium.Viewer,
  setStatus: StatusReporter,
): SpecialShapeScene {
  const fillPosition = Cesium.Cartesian3.fromDegrees(-100, 30, 150)
  const outlinePosition = Cesium.Cartesian3.fromDegrees(-100.001, 30, 150)
  const outlineOrientation = Cesium.Transforms.headingPitchRollQuaternion(
    outlinePosition,
    new Cesium.HeadingPitchRoll(0, Cesium.Math.toRadians(120), 0),
  )
  const entities = [
    viewer.entities.add({
      position: fillPosition,
      cylinder: {
        bottomRadius: 30,
        length: 100,
        material: Cesium.Color.fromCssColorString('rgba(255,240,0,0.35)'),
        topRadius: 0,
      },
    }),
    viewer.entities.add({
      orientation: outlineOrientation,
      position: outlinePosition,
      cylinder: {
        bottomRadius: 30,
        fill: false,
        length: 100,
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString('rgba(255,240,0,0.7)'),
        outlineWidth: 5,
        topRadius: 0,
      },
    }),
  ]

  const fillEntity = entities[0]
  if (fillEntity) {
    void viewer.flyTo(fillEntity, { duration: 0 })
  }
  setStatus('黄色半透明圆锥体与倾斜轮廓线已生成')

  return {
    actions: [],
    dispose: () => removeEntities(viewer, entities),
  }
}
