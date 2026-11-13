import * as Cesium from 'cesium'

import { createThunderAudio } from '@/demos/effects/thunderAudio'
import type { EffectsScene, ThunderAudioController } from '@/demos/effects/types'

export const LIGHTNING_INTERVAL_MS = 5_200

const RAIN_SHADER = `
uniform sampler2D colorTexture;
in vec2 v_textureCoordinates;

float hash(float x) {
  return fract(sin(x * 133.3) * 13.13);
}

void main(void) {
  float time = czm_frameNumber / 60.0;
  vec2 resolution = czm_viewport.zw;
  vec2 uv = (gl_FragCoord.xy * 2.0 - resolution.xy) / min(resolution.x, resolution.y);
  vec3 rainColor = vec3(0.58, 0.69, 0.82);
  float angle = -0.4;
  float s = sin(angle);
  float c = cos(angle);
  uv *= mat2(c, -s, s, c);
  uv *= length(uv + vec2(0.0, 4.9)) * 0.3 + 1.0;
  float streak = 1.0 - sin(hash(floor(uv.x * 100.0)) * 2.0);
  float intensity =
    clamp(abs(sin(20.0 * time * streak + uv.y * (5.0 / (2.0 + streak)))) - 0.95, 0.0, 1.0) * 20.0;
  rainColor *= streak * intensity;
  vec4 scene = texture(colorTexture, v_textureCoordinates);
  out_FragColor = mix(scene, vec4(rainColor, scene.a), 0.42);
}
`

const LIGHTNING_SHADER = `
uniform sampler2D colorTexture;
uniform float u_flash;
uniform float u_seed;
in vec2 v_textureCoordinates;

float hash11(float x) {
  return fract(sin(x * 127.1) * 43758.5453);
}

vec2 hash22(vec2 point) {
  return fract(
    sin(vec2(dot(point, vec2(127.1, 311.7)), dot(point, vec2(269.5, 183.3)))) *
    43758.5453
  );
}

float noise(vec2 point) {
  vec2 cell = floor(point);
  vec2 local = fract(point);
  local = local * local * (3.0 - 2.0 * local);
  float a = hash11(dot(cell, vec2(1.0, 57.0)));
  float b = hash11(dot(cell + vec2(1.0, 0.0), vec2(1.0, 57.0)));
  float c = hash11(dot(cell + vec2(0.0, 1.0), vec2(1.0, 57.0)));
  float d = hash11(dot(cell + vec2(1.0), vec2(1.0, 57.0)));
  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
}

float fbm(vec2 point) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += noise(point) * amplitude;
    point *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

float segmentDistance(vec2 segment, vec2 point) {
  float lengthSquared = dot(segment, segment);
  float projection = clamp(dot(point, segment) / max(lengthSquared, 0.000001), 0.0, 1.0);
  return length(point - segment * projection);
}

void main(void) {
  vec4 source = texture(colorTexture, v_textureCoordinates);
  float flash = clamp(u_flash, 0.0, 1.0);
  if (flash <= 0.001) {
    out_FragColor = source;
    return;
  }

  vec2 resolution = czm_viewport.zw;
  vec2 point = gl_FragCoord.xy / resolution;
  vec3 light = vec3(0.0);

  vec2 cloudUv = point * vec2(2.4, 0.9) + vec2(u_seed * 0.013, 0.2);
  float cloud = 1.0 - fbm(cloudUv);
  cloud = smoothstep(0.42, 0.82, cloud) * smoothstep(0.18, 0.98, point.y);
  light += cloud * vec3(0.32, 0.45, 0.72) * flash;

  vec2 previous = vec2(mix(0.44, 0.8, hash11(u_seed + 3.1)), 1.04);
  vec2 branchOrigin = previous;
  float bolt = 0.0;
  for (int i = 0; i < 36; i++) {
    float index = float(i);
    vec2 jitter = hash22(vec2(index + u_seed * 13.7, index * 0.37 + 1.7));
    vec2 next = previous + vec2((jitter.x - 0.5) * 0.065, -0.035 - jitter.y * 0.012);
    float distanceToBolt = segmentDistance(next - previous, point - previous);
    bolt += exp(-distanceToBolt * 280.0) + exp(-distanceToBolt * 44.0) * 0.06;
    previous = next;
    if (i == 16) {
      branchOrigin = previous;
    }
  }

  float branchDirection = hash11(u_seed + 21.0) > 0.5 ? 1.0 : -1.0;
  vec2 branch = branchOrigin;
  for (int i = 0; i < 14; i++) {
    float index = float(i);
    vec2 jitter = hash22(vec2(index * 1.7 + u_seed, index * 0.19 + u_seed + 5.0));
    vec2 next =
      branch +
      vec2(branchDirection * (0.025 + jitter.x * 0.04), -0.026 - jitter.y * 0.012);
    float distanceToBranch = segmentDistance(next - branch, point - branch);
    bolt += exp(-distanceToBranch * 320.0) + exp(-distanceToBranch * 48.0) * 0.04;
    branch = next;
  }

  light += clamp(bolt, 0.0, 2.0) * vec3(0.78, 0.87, 1.0) * flash;
  out_FragColor = vec4(clamp(source.rgb + light, 0.0, 1.0), source.a);
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
  let flashSeed = 1
  const flashTimeouts = new Set<ReturnType<typeof setTimeout>>()
  const renderTicker = () => viewer.scene.requestRender()

  const rainStage = new Cesium.PostProcessStage({
    fragmentShader: RAIN_SHADER,
    name: 'effect_rain',
  })
  const lightningStage = new Cesium.PostProcessStage({
    fragmentShader: LIGHTNING_SHADER,
    name: 'effect_lightning',
    uniforms: {
      u_flash: () => flashStrength,
      u_seed: () => flashSeed,
    },
  })

  viewer.scene.postProcessStages.add(rainStage)
  viewer.scene.postProcessStages.add(lightningStage)
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
    const strengths = [0.42, 1, 0.08, 0.86, 0.24, 0]
    const delays = [0, 55, 120, 190, 310, 520]
    const timer = setTimeout(() => {
      flashTimeouts.delete(timer)
      flashStrength = strengths[step] ?? 0
      viewer.scene.requestRender()
    }, delays[step] ?? 0)
    flashTimeouts.add(timer)
  }

  function triggerLightning() {
    flashSeed = (flashSeed * 17.17 + 13.31) % 997
    for (let step = 0; step < 6; step += 1) {
      queueFlash(step)
    }
  }

  const initialFlash = setTimeout(triggerLightning, 1_200)
  const flashInterval = setInterval(triggerLightning, LIGHTNING_INTERVAL_MS)
  void audio.play()
  setStatus('已启动参考视角的程序化雨幕与分叉闪电，雷声默认开启并循环')

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
      viewer.scene.postProcessStages.remove(lightningStage)
      audio.dispose()
    },
    retryAudio: audio.play,
  }
}
