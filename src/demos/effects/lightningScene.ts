import * as Cesium from 'cesium'

import { createThunderAudio } from '@/demos/effects/thunderAudio'
import type { EffectsScene, ThunderAudioController } from '@/demos/effects/types'

export const LIGHTNING_INTERVAL_MS = 5_200

const RAIN_SHADER = `
uniform sampler2D colorTexture;
uniform float u_time;
in vec2 v_textureCoordinates;

float hash(vec2 point) {
  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);
}

void main(void) {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec2 uv = v_textureCoordinates * vec2(110.0, 38.0);
  uv.x += uv.y * 0.16;
  uv.y += u_time * 10.0;
  vec2 cell = floor(uv);
  vec2 local = fract(uv);
  float drop = step(0.72, hash(cell));
  float streak = smoothstep(0.16, 0.0, abs(local.x - 0.5));
  streak *= smoothstep(0.08, 0.42, local.y) * smoothstep(0.98, 0.55, local.y);
  float rain = clamp(drop * streak * 0.82, 0.0, 1.0);
  out_FragColor = mix(color, vec4(0.62, 0.76, 0.94, 1.0), rain);
}
`

const FLASH_SHADER = `
uniform sampler2D colorTexture;
uniform float u_flash;
in vec2 v_textureCoordinates;

void main(void) {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec3 flashColor = vec3(0.74, 0.83, 1.0);
  out_FragColor = vec4(mix(color.rgb, flashColor, u_flash), color.a);
}
`

interface CreateLightningSceneOptions {
  createAudio?: () => ThunderAudioController
  setStatus: (message: string) => void
}

export function createLightningScene(
  viewer: Cesium.Viewer,
  { createAudio, setStatus }: CreateLightningSceneOptions,
): EffectsScene {
  let flashStrength = 0
  const flashTimeouts = new Set<ReturnType<typeof setTimeout>>()
  const renderTicker = () => viewer.scene.requestRender()

  const rainStage = new Cesium.PostProcessStage({
    fragmentShader: RAIN_SHADER,
    name: 'effect_rain',
    uniforms: {
      u_time: () => performance.now() / 1_000,
    },
  })
  const flashStage = new Cesium.PostProcessStage({
    fragmentShader: FLASH_SHADER,
    name: 'effect_lightning_flash',
    uniforms: {
      u_flash: () => flashStrength,
    },
  })

  viewer.scene.postProcessStages.add(rainStage)
  viewer.scene.postProcessStages.add(flashStage)
  viewer.scene.preUpdate.addEventListener(renderTicker)
  viewer.scene.globe.depthTestAgainstTerrain = true
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(121.662323, 20.157338, 271_712),
    orientation: {
      heading: Cesium.Math.toRadians(350.3),
      pitch: Cesium.Math.toRadians(-27.4),
      roll: 0,
    },
  })

  const audio = createAudio?.() ?? createThunderAudio()

  function queueFlash(step: number) {
    const strengths = [1, 0.24, 0.82, 0.12, 0]
    const delays = [0, 75, 150, 250, 360]
    const timer = setTimeout(() => {
      flashTimeouts.delete(timer)
      flashStrength = strengths[step] ?? 0
      viewer.scene.requestRender()
    }, delays[step] ?? 0)
    flashTimeouts.add(timer)
  }

  function triggerLightning() {
    for (let step = 0; step < 5; step += 1) {
      queueFlash(step)
    }
  }

  const initialFlash = setTimeout(triggerLightning, 1_200)
  const flashInterval = setInterval(triggerLightning, LIGHTNING_INTERVAL_MS)
  void audio.play()
  setStatus('雨幕与周期闪电持续播放，雷声默认开启并循环')

  return {
    actions: [],
    audioState: audio.state,
    dispose: () => {
      clearTimeout(initialFlash)
      clearInterval(flashInterval)
      flashTimeouts.forEach((timer) => clearTimeout(timer))
      flashTimeouts.clear()
      viewer.scene.preUpdate.removeEventListener(renderTicker)
      viewer.scene.postProcessStages.remove(rainStage)
      viewer.scene.postProcessStages.remove(flashStage)
      audio.dispose()
    },
    retryAudio: audio.play,
  }
}
