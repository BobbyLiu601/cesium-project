import * as Cesium from 'cesium'

import { loadEffectTerrain } from '@/demos/effects/shared'
import type { EffectsScene } from '@/demos/effects/types'

export const HEIGHT_FOG_DEFAULTS = {
  color: [0.8, 0.82, 0.84],
  density: 0.6,
  height: 1_000,
} as const

const HEIGHT_FOG_SHADER = `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float u_earthRadiusOnCamera;
uniform float u_cameraHeight;
uniform float u_fogHeight;
uniform vec3 u_fogColor;
uniform float u_globalDensity;
in vec2 v_textureCoordinates;

vec4 getWorldCoordinate(sampler2D depthSampler, vec2 texCoords) {
  float depth = czm_unpackDepth(texture(depthSampler, texCoords));
  vec4 eyeCoordinate = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
  eyeCoordinate = eyeCoordinate / eyeCoordinate.w;
  vec4 worldCoordinate = czm_inverseView * eyeCoordinate;
  return worldCoordinate / worldCoordinate.w;
}

float getRoughHeight(vec4 worldCoordinate) {
  return length(vec3(worldCoordinate)) - u_earthRadiusOnCamera;
}

float projectVector(vec3 vector, vec3 axis) {
  float scale = dot(vector, axis) / max(dot(axis, axis), 0.00001);
  float direction = sign(scale);
  return direction * length(scale * axis);
}

float linearHeightFog(
  vec3 positionToCamera,
  float cameraHeight,
  float pixelHeight,
  float fogMaxHeight
) {
  float density = u_globalDensity / 10.0;
  vec3 up = -normalize(czm_viewerPositionWC);
  float verticalFactor = max(projectVector(normalize(positionToCamera), up), 0.08);
  float bottom = mix(cameraHeight, fogMaxHeight, step(fogMaxHeight, cameraHeight));
  float top = mix(pixelHeight, fogMaxHeight, step(fogMaxHeight, pixelHeight));
  float fog =
    (bottom - top) -
    0.5 * (bottom * bottom - top * top) / max(fogMaxHeight, 0.001);
  fog = density * fog / verticalFactor;
  return clamp(fog / (fog + 1.0), 0.0, 1.0);
}

void main(void) {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec4 position = getWorldCoordinate(depthTexture, v_textureCoordinates);
  float pixelHeight = getRoughHeight(position);
  vec3 positionToCamera = vec3(position) - czm_viewerPositionWC;
  float fog = linearHeightFog(
    positionToCamera,
    u_cameraHeight,
    pixelHeight,
    u_fogHeight
  );
  out_FragColor = mix(color, vec4(u_fogColor, 1.0), fog);
}
`

interface CreateHeightFogSceneOptions {
  setStatus: (message: string) => void
  signal?: AbortSignal
}

export async function createHeightFogScene(
  viewer: Cesium.Viewer,
  { setStatus, signal }: CreateHeightFogSceneOptions,
): Promise<EffectsScene> {
  const fogStage = new Cesium.PostProcessStage({
    fragmentShader: HEIGHT_FOG_SHADER,
    name: 'effect_height_fog',
    uniforms: {
      u_cameraHeight: () => viewer.camera.positionCartographic.height,
      u_earthRadiusOnCamera: () =>
        Cesium.Cartesian3.magnitude(viewer.camera.positionWC) -
        viewer.camera.positionCartographic.height,
      u_fogColor: () => new Cesium.Color(...HEIGHT_FOG_DEFAULTS.color, 1),
      u_fogHeight: () => HEIGHT_FOG_DEFAULTS.height,
      u_globalDensity: () => HEIGHT_FOG_DEFAULTS.density,
    },
  })

  try {
    viewer.scene.postProcessStages.add(fogStage)
    viewer.camera.setView({
      destination: new Cesium.Cartesian3(
        -1386705.7605894802,
        5226754.975571179,
        3375582.2076837276,
      ),
      orientation: {
        heading: 3.968066845543675,
        pitch: -0.300780994602595,
        roll: 0.00007913394522685024,
      },
    })

    const terrainLoaded = await loadEffectTerrain(viewer, signal)
    setStatus(
      terrainLoaded
        ? '已加载 Mars3D 地形与高度雾，可拖拽观察近地面雾层'
        : '地形服务不可用，已回退椭球地形并保留高度雾效果',
    )

    return {
      actions: [],
      dispose: () => {
        viewer.scene.postProcessStages.remove(fogStage)
      },
    }
  } catch (error) {
    viewer.scene.postProcessStages.remove(fogStage)
    throw error
  }
}
