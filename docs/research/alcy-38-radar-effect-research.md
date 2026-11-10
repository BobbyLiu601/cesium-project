# ALCY-38 Cesium 雷达效果实现调研

- 调研日期：2026-11-06
- 目标：为三维地球弹窗制作一个可截图验收的“3D 特效 / 雷达图”展示效果，技术栈为 Vue 3 + TypeScript + CesiumJS 1.147。
- 结论优先级：先做地面扫描盘，再叠加 3D 扫描扇面/穹顶；使用 GPU 材质动画，不逐帧重建几何。

## 结论

推荐采用 **Primitive API + 自定义 Material** 的组合，而不是把整个效果建立在 Entity 的逐帧属性动画上。

1. **地面扫描盘**：用 `GroundPrimitive` + `EllipseGeometry` + `MaterialAppearance` + 自定义 GLSL Material，在一个静态圆盘内绘制旋转扫描扇区、扩散圆环和中心光晕。`EllipseGeometry` 是 `GroundPrimitive` 官方支持的几何类型之一。[8][9]
2. **3D 扫描扇面/穹顶**：用 `Primitive` + `EllipsoidGeometry` + `MaterialAppearance`，通过 `minimumClock`、`maximumClock`、`minimumCone`、`maximumCone` 和 `innerRadii` 组合出扇形壳体或穹顶；运行时用 Shader 驱动扫描，或只旋转 `primitive.modelMatrix`，不修改几何参数。[1][2][3]
3. **可选泛光**：用 `PostProcessStageLibrary.createBloomStage()` 增加发光感，但它会增加多 Pass 开销，低端设备和移动端应提供降级开关。[12][13]

不建议首版用 Entity 的 `minimumClock`/`maximumClock` 做逐帧扫描：Cesium 的 `EllipsoidGeometryUpdater` 会在这些属性变化时重建 Primitive；它只对 `radii` 变化有 3D 缩放快路径。[4] Entity 更适合静态配置、选中和拾取，不适合每帧改扇形角度。

## 效果拆分

| 效果             | 推荐实现                                                    | 特点                                         |
| ---------------- | ----------------------------------------------------------- | -------------------------------------------- |
| 地面扫描盘       | `GroundPrimitive` + `EllipseGeometry` + 自定义 Material     | 贴地、单几何、适合城市尺度俯视截图           |
| 旋转扫描扇区     | 静态地面圆盘内用 GLSL 计算角度和时间                        | 不需要每帧改顶点，扫描方向由 Shader 驱动     |
| 扩散圆环         | 同一个 GLSL Material 内绘制多个环，或少量静态圆环叠加       | 避免为每个环创建独立、逐帧更新的 Entity      |
| 3D 雷达穹顶/扇面 | `Primitive` + 局部 `EllipsoidGeometry` + `modelMatrix` 旋转 | 有体积感，适合斜视相机和弹窗主视觉           |
| 全屏扫描线/泛光  | `PostProcessStage` 或 `createBloomStage()`                  | 只能做屏幕空间修饰，不能替代地理定位的雷达体 |
| 真实天气回波     | 单独接入影像瓦片或 3D Tiles 数据源                          | 属于数据接入问题，不是本次雷达特效的核心     |

## API 方案对比

| 路线                        | 优点                                                                                     | 风险/限制                                                                                              | 适用场景                             |
| --------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Entity API                  | 代码最短，自动接入时间、拾取、`heightReference` 等能力                                   | 自定义 Material 需要实现 `MaterialProperty`；改 clock/cone 会触发 Primitive 重建；透明几何排序不易控制 | 静态雷达站、原型验证、少量非逐帧动画 |
| Primitive + 自定义 Material | 可直接使用 `Material`；几何创建一次，动画只在 Shader 或 `modelMatrix` 中发生；控制力最强 | 需要自行处理创建、异步 ready、清理和透明渲染状态                                                       | 本 Issue 的首选                      |
| GroundPrimitive             | 几何自动贴地/贴合 3D Tiles，适合地面扫描盘                                               | 自定义材质依赖 `WEBGL_depth_texture` 和 `EXT_frag_depth`；部分设备可能有渲染伪影                       | 地面雷达盘                           |
| PostProcessStage            | 适合 Bloom、扫描线、压暗、色彩校正                                                       | 全屏 Pass，不知道雷达的地理位置；性能和功耗更高                                                        | 视觉增强，不是主体几何               |

## 关键 API 事实

### 1. Ellipsoid 的角度和壳体

`EllipsoidGeometry` 的角度定义如下：

- `minimumClock` / `maximumClock`：在 xy 平面内，从正 x 轴朝正 y 轴测量。[2][3]
- `minimumCone` / `maximumCone`：从正 z 轴朝负 z 轴测量。[2][3]
- 默认 `minimumClock = 0`、`maximumClock = 2π`、`minimumCone = 0`、`maximumCone = π`，即完整椭球。[2]
- `innerRadii` 默认等于 `radii`。如果内半径和外半径相同，几何只有外表面；当 clock 或 cone 不完整时，侧边不一定会闭合。要让局部扇形看起来像有厚度的壳体，应传入略小于 `radii` 的 `innerRadii`。[3]

`EllipsoidGeometry` 的 `st` 不是局部扇形的 `(方位角, 圆锥角)` 归一化结果。1.147 源码中的映射为：

```text
st.x = atan2(-normal.y, normal.x) / (2π) + 0.5
st.y = asin(normal.z) / π + 0.5
```

因此 `st.x = 0.5` 对应 clock 角 0，clock 角增大时 `st.x` 减小；`st.y = 1` 对应 +z 方向，`st.y = 0` 对应 -z 方向。需要圆锥角时应使用 `cone = (1 - st.y) * π`，不要直接把 `st.y` 当作 cone。这个映射基于椭球表面法线，局部薄壳的内表面可能得到不同的纹理方向，最终应以实际渲染检查为准。[3]

据此：

- 半球穹顶：`minimumCone = 0`、`maximumCone = π / 2`。
- 近地平线扫描带：例如 `minimumCone = 55°`、`maximumCone = 90°`。
- 水平扇形：同时限制 `minimumClock`/`maximumClock`，例如 40° 宽。
- 想要“有体积”的扇面：配合 `innerRadii` 形成薄壳，避免只看到一张没有侧壁的曲面。

### 2. Entity 的更新代价

`EllipsoidGeometryUpdater` 在 3D、`heightReference === NONE` 时，会优先用单位球几何加缩放矩阵更新 `radii`；但 `innerRadii`、`minimumClock`、`maximumClock`、`minimumCone`、`maximumCone` 等变化会走 Primitive 重建路径。[4]

因此：

- 不要用 `CallbackProperty` 每帧修改 `entity.ellipsoid.minimumClock` 或 `maximumClock`。
- 若必须用 Entity，让几何参数保持常量，用 `entity.orientation` 旋转整个实体，或用 Shader 做材质动画。
- 更推荐直接用 `Primitive.modelMatrix` 旋转，控制更明确。[14]

### 3. 贴地扇区

`GroundPrimitive` 官方列出的有效几何包括 `CircleGeometry`、`CorridorGeometry`、`EllipseGeometry`、`PolygonGeometry` 和 `RectangleGeometry`。[9]

用 `EllipseGeometry` 做一个完整地面圆盘，再由 Shader 只显示一个角度扇区，比每帧重建扇形 Polygon 更稳定。圆盘几何只创建一次，旋转扇区完全由 GLSL 的 `atan` 和时间控制。

`GroundPrimitive` 使用自定义 Material 时有平台限制：

- 需要 `WEBGL_depth_texture` 扩展；文档说明材质/不同 PerInstanceColor 需要它。[9]
- 正确渲染还依赖 `EXT_frag_depth`；不支持时可能在某些视角出现伪影。[9]
- 上线前应调用 `Cesium.GroundPrimitive.supportsMaterials(viewer.scene)` 做能力判断，失败时退化为普通 `Primitive` 的固定高度圆盘或 Entity 的颜色材质。

`classificationType` 的默认值是 `BOTH`；只画地形时可设为 `TERRAIN`，避免地面雷达效果把 3D Tiles 建筑也一起分类。[17]

### 4. 贴地、深度和显示顺序

- `Globe.depthTestAgainstTerrain` 默认是 `false`；开启后，billboard、polyline、label 等 Primitive 会与地形做深度测试，但代价是地形 LOD/数值噪声可能导致表面物体闪烁或消失。[16]
- `disableDepthTestDistance` 是 Billboard、Label、Point 的属性，不是 Ellipsoid、Ellipse 或 Polygon 的属性；不能指望它来修复雷达体与地形的遮挡。[15]
- 雷达中心图标/标签如果被地形裁掉，可以给 Billboard/Label 设置 `disableDepthTestDistance: Number.POSITIVE_INFINITY`；但不要把该属性用在雷达几何上。[15]
- Entity 的 `heightReference` 支持 `CLAMP_TO_GROUND`、`CLAMP_TO_TERRAIN`、`RELATIVE_TO_GROUND` 等；地面扫描盘优先使用 `GroundPrimitive`，不要把悬浮 Ellipsoid 当作贴地扇区。[10][17]

### 5. 材质坐标和动画

`EllipseGeometry` 会生成归一化纹理坐标 `st`：以椭圆在投影平面上的包围盒为范围，中心在 `(0.5, 0.5)`。[11] 因此可以在片元着色器中用：

```glsl
vec2 p = materialInput.st * 2.0 - 1.0;
float radius = length(p);
float angle = atan(p.y, p.x);
```

绘制圆盘、环和旋转扇区。这个做法不依赖贴图，也没有每帧的纹理上传。

`Material` 的 fabric、uniform 和 `translucent` 用法见官方文档和 1.147 源码；`MaterialAppearance` 负责把材质绑定到 Primitive。[5][6][7]

`czm_frameNumber` 是 Cesium 自动 uniform，每帧递增。[14] 它适合原型和简单演示；如果要让不同刷新率下速度一致，建议给 Material 传一个 `time` 标量，由 JavaScript 每帧更新。更新 uniform 不等于重建几何。

当前项目的 `CesiumGlobe.vue` 使用 `requestRenderMode: true`。启用该模式后，场景不会自动持续渲染，必须调用 `scene.requestRender()`。[23] 雷达动画期间需要：

- 在弹窗打开期间临时关闭 `requestRenderMode`，或
- 用 `requestAnimationFrame`/`scene.preRender` 每帧调用 `scene.requestRender()`，并在关闭弹窗时清理监听器。

## 推荐实现

### 1. 地面雷达盘

```ts
import * as Cesium from 'cesium'

const RADAR_GROUND_SHADER = `
uniform vec4 color;
uniform float time;
uniform float sweepWidth;

czm_material czm_getMaterial(czm_materialInput materialInput)
{
  czm_material material = czm_getDefaultMaterial(materialInput);
  vec2 p = materialInput.st * 2.0 - 1.0;
  float radius = length(p);
  float inside = 1.0 - smoothstep(0.92, 1.0, radius);

  float angle = atan(p.y, p.x);
  float phase = fract((angle + 3.141592653589793) / 6.283185307179586 - time * 0.12);
  float beam = pow(smoothstep(1.0 - sweepWidth, 1.0, phase), 2.0);

  float ringPhase = fract(radius * 4.0 - time * 0.35);
  float ring = smoothstep(0.93, 1.0, ringPhase)
             * (1.0 - smoothstep(0.15, 1.0, radius));

  material.diffuse = color.rgb;
  material.alpha = inside * (beam * 0.55 + ring * 0.22) * color.a;
  return material;
}
`

const radarMaterial = new Cesium.Material({
  fabric: {
    type: 'RadarGroundSweep',
    uniforms: {
      color: new Cesium.Color(0.16, 0.95, 0.82, 1.0),
      time: 0.0,
      sweepWidth: 0.045, // 约 16° 的扫描扇区宽度
    },
    source: RADAR_GROUND_SHADER,
  },
  translucent: true,
})

const groundPrimitive = new Cesium.GroundPrimitive({
  geometryInstances: new Cesium.GeometryInstance({
    geometry: new Cesium.EllipseGeometry({
      center: Cesium.Cartesian3.fromDegrees(113.32, 23.08),
      semiMajorAxis: 3500,
      semiMinorAxis: 3500,
      vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    }),
  }),
  appearance: new Cesium.MaterialAppearance({
    material: radarMaterial,
    translucent: true,
    closed: false,
  }),
  classificationType: Cesium.ClassificationType.TERRAIN,
})

viewer.scene.primitives.add(groundPrimitive)
```

可先用 Sandcastle 的 [Circles and Ellipses][18]、[Materials][19] 和 [Polygons][22] 示例验证贴地几何、材质与分类行为。

建议在添加前检查平台能力：

```ts
if (!Cesium.GroundPrimitive.supportsMaterials(viewer.scene)) {
  // 退化方案：使用固定高度的 Primitive + EllipseGeometry，
  // 或只使用 PerInstanceColorAppearance 的简单圆盘。
}
```

### 2. 3D 扇面或穹顶

下面是一个靠地平线的 40° 扇面示例。几何只创建一次，扫描线在材质中移动；如果希望整个扇面绕站点转动，再额外更新 `modelMatrix`：

```ts
const origin = Cesium.Cartesian3.fromDegrees(113.32, 23.08, 60)
const enu = Cesium.Transforms.eastNorthUpToFixedFrame(origin)
const minClock = Cesium.Math.toRadians(0)
const maxClock = Cesium.Math.toRadians(40)
const minCone = Cesium.Math.toRadians(55)
const maxCone = Cesium.Math.toRadians(90)

const domeMaterial = new Cesium.Material({
  fabric: {
    type: 'RadarDome',
    uniforms: {
      color: new Cesium.Color(0.22, 0.85, 1.0, 1.0),
      time: 0.0,
      minClock,
      maxClock,
      minCone,
      maxCone,
    },
    source: `
      uniform vec4 color;
      uniform float time;
      uniform float minClock;
      uniform float maxClock;
      uniform float minCone;
      uniform float maxCone;

      czm_material czm_getMaterial(czm_materialInput materialInput)
      {
        czm_material material = czm_getDefaultMaterial(materialInput);
        float azimuth = fract(0.5 - materialInput.st.x) * 6.283185307179586;
        float localAzimuth = (azimuth - minClock) / (maxClock - minClock);
        float cone = (1.0 - materialInput.st.y) * 3.141592653589793;
        float phase = fract(localAzimuth - time * 0.14);
        float beam = smoothstep(0.96, 1.0, phase);
        float verticalFade = smoothstep(minCone, minCone + 0.08, cone)
                           * (1.0 - smoothstep(maxCone - 0.08, maxCone, cone));
        material.diffuse = color.rgb;
        material.alpha = color.a * beam * verticalFade * 0.32;
        return material;
      }
    `,
  },
  translucent: true,
})

const dome = new Cesium.Primitive({
  geometryInstances: new Cesium.GeometryInstance({
    geometry: new Cesium.EllipsoidGeometry({
      radii: new Cesium.Cartesian3(3500, 3500, 1600),
      innerRadii: new Cesium.Cartesian3(3450, 3450, 1575),
      minimumClock: minClock,
      maximumClock: maxClock,
      minimumCone: minCone,
      maximumCone: maxCone,
      stackPartitions: 48,
      slicePartitions: 48,
      vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
    }),
  }),
  appearance: new Cesium.MaterialAppearance({
    material: domeMaterial,
    translucent: true,
    closed: true,
    faceForward: true,
  }),
  modelMatrix: enu,
})

viewer.scene.primitives.add(dome)

// 可选：只有需要整个扇面绕站点旋转时才更新 modelMatrix。
// 扫描线本身由上面的 time uniform 驱动，不需要重建 EllipsoidGeometry。
```

如果要做完整穹顶，把 clock 恢复为 `0..2π`、cone 改为 `0..π/2`，同时把材质中的 `minClock`、`maxClock`、`minCone`、`maxCone` 更新为相同范围，并用材质中的方位角实现扫描。完整穹顶不需要旋转 `modelMatrix`。Sandcastle 的 [Spheres and Ellipsoids][21] 可用于检查椭球几何的方向。

### 3. 动画循环

```ts
const startedAt = performance.now()
let frameId = 0

function tick() {
  const time = (performance.now() - startedAt) / 1000
  radarMaterial.uniforms.time = time
  domeMaterial.uniforms.time = time
  viewer.scene.requestRender()
  frameId = requestAnimationFrame(tick)
}

frameId = requestAnimationFrame(tick)

// 弹窗关闭时
// cancelAnimationFrame(frameId)
// viewer.scene.primitives.remove(groundPrimitive)
// viewer.scene.primitives.remove(dome)
```

如果直接使用 `czm_frameNumber`，可以省略 `time` uniform 更新，但动画速度会依赖实际渲染帧率。对固定截图场景，可以在截图前手动把 `time` 设成固定值，保证每次画面一致。

### 4. 可选的泛光

```ts
const bloom = Cesium.PostProcessStageLibrary.createBloomStage()
viewer.scene.postProcessStages.add(bloom)
```

`createBloomStage()` 是 Cesium 自带的多 Pass Bloom 组合。[13] 它适合在截图中增强青色高光，但应在移动端或低性能设备上关闭，或只在截图/展示模式开启。可参考 Sandcastle 的 [Post Processing][20] 交互示例调整强度。

## 与当前工程的接入建议

1. 在 `src/components/` 新增一个独立的 Cesium 雷达效果工厂（例如 `radarEffect.ts`），接收 `Viewer` 和站点坐标，返回 `{ destroy }`。这样不把材质、几何和动画状态塞进 `CesiumGlobe.vue`。
2. `CesiumGlobe.vue` 目前使用 `requestRenderMode: true`，雷达模式打开时要按上文启动显式渲染循环；关闭弹窗时取消循环并移除 Primitive。
3. 现有 `ThreeDimensionalEarthDialog` 标题固定为“三维地球”，可改为接收 `title`/`mode`，或在同一个 Viewer 会话上切换“普通地球 / 雷达”内容；不要为雷达再创建第二套 Viewer。
4. `src/data/features.ts` 增加 `radar` 项，`ShowcaseView.vue` 增加对应弹窗状态。菜单“视觉效果”放在“基础配置”下方，内容项名称使用“雷达图”。
5. 验收截图应从实际 Cesium canvas 抓取，而不是使用示意图。可在动画稳定后固定 `time`，用 Playwright 设置 1200×700 视口并截取弹窗中的 canvas。

## 视觉与截图建议

- **站点**：可沿用项目已有的广州海珠区参考点 `113.32°E, 23.08°N`，便于和 ALCY-36 的高程调研复用场景。
- **相机**：使用 `camera.lookAt(center, new HeadingPitchRange(heading, pitch, range))`，建议 heading 20°–35°、pitch -35°–-50°、range 5500–7500 m，能同时看到地面圆盘和 3D 扇面。
- **颜色**：深蓝黑背景上使用青绿色主色（例如 `#35F2CF`），蓝青色 3D 扇面（例如 `#54A8FF`），少量琥珀色只用于中心标记或告警。
- **节奏**：扫描一圈 6–10 秒；地面环 3–4 个；扇区宽度 12°–18°；避免转速太快导致截图模糊。
- **层次**：地面盘用较低透明度，3D 扇面用更高透明度；中心点/标签用高对比色。
- **低端设备**：减少环数量、关闭 Bloom、降低球面 `stackPartitions`/`slicePartitions`，并在 `requestRenderMode` 下按需渲染。

## 验证清单

- [ ] 地面盘在无地形和有地形两种配置下都能贴地，不出现悬浮或穿过地形。
- [ ] 在 WebGL2 Chromium 下 `GroundPrimitive.supportsMaterials(viewer.scene)` 为 `true`；不支持时有明确降级路径。
- [ ] 扫描动画连续，`requestRenderMode` 下不会冻结。
- [ ] 代码中没有对 `minimumClock`、`maximumClock`、`minimumCone`、`maximumCone` 的逐帧写入；没有每帧创建/销毁 Primitive。
- [ ] 透明排序在斜视、俯视、近距离三种相机下都可接受，没有明显黑边或闪烁。
- [ ] 设置 `classificationType = TERRAIN` 时，雷达盘不会错误覆盖 3D Tiles 建筑；若业务要求覆盖建筑，再改为 `BOTH`。
- [ ] 移动端或低性能设备关闭 Bloom 后仍能保持可读性。
- [ ] 弹窗关闭后取消 `requestAnimationFrame`，移除所有 Primitive，Viewer 不保留材质/几何引用。
- [ ] 最终截图为实际 canvas 效果，分辨率、构图和“雷达图”卡片封面一致。

## 仍需浏览器实验确认的点

以下结论来自源码和官方文档，但仍建议在实际项目 Viewer、实际 WebGL 上下文中做一次截图验证：

- `GroundPrimitive` + 自定义 `MaterialAppearance` 在当前目标浏览器上的实际渲染效果和扩展支持。
- `EllipseGeometry` 的 `st` 范围与 GLSL 中 `atan` 扇区的边界是否完全符合预期（尤其是椭圆长短轴不等时）。
- `Primitive` + `EllipsoidGeometry` 的 `modelMatrix` 旋转轴是否与站点本地 ENU 的 z 轴一致，以及扇面开口方向是否符合设计稿。
- Bloom 对天底图影像的亮度影响，以及是否需要按场景关闭。

## 参考来源

以下链接于 2026-11-06 实际检查，均返回 HTTP 200。Cesium 官方 ref-doc 是当前文档，源码链接固定到 1.147 tag，避免版本漂移。

1. [Cesium Documentation — EllipsoidGraphics](https://cesium.com/learn/cesiumjs/ref-doc/EllipsoidGraphics.html)
2. [Cesium Documentation — EllipsoidGeometry](https://cesium.com/learn/cesiumjs/ref-doc/EllipsoidGeometry.html)
3. [CesiumGS/cesium 1.147 — EllipsoidGeometry source](https://github.com/CesiumGS/cesium/blob/1.147/packages/core/Source/EllipsoidGeometry.js)
4. [CesiumGS/cesium 1.147 — EllipsoidGeometryUpdater source](https://github.com/CesiumGS/cesium/blob/1.147/packages/engine/Source/DataSources/EllipsoidGeometryUpdater.js)
5. [Cesium Documentation — Material](https://cesium.com/learn/cesiumjs/ref-doc/Material.html)
6. [CesiumGS/cesium 1.147 — Material source](https://github.com/CesiumGS/cesium/blob/1.147/packages/engine/Source/Scene/Material.js)
7. [Cesium Documentation — MaterialAppearance](https://cesium.com/learn/cesiumjs/ref-doc/MaterialAppearance.html)
8. [Cesium Documentation — GroundPrimitive](https://cesium.com/learn/cesiumjs/ref-doc/GroundPrimitive.html)
9. [CesiumGS/cesium 1.147 — GroundPrimitive source](https://github.com/CesiumGS/cesium/blob/1.147/packages/engine/Source/Scene/GroundPrimitive.js)
10. [Cesium Documentation — EllipseGraphics](https://cesium.com/learn/cesiumjs/ref-doc/EllipseGraphics.html)
11. [CesiumGS/cesium 1.147 — EllipseGeometry source](https://github.com/CesiumGS/cesium/blob/1.147/packages/core/Source/EllipseGeometry.js)
12. [Cesium Documentation — PostProcessStage](https://cesium.com/learn/cesiumjs/ref-doc/PostProcessStage.html)
13. [CesiumGS/cesium 1.147 — PostProcessStageLibrary source](https://github.com/CesiumGS/cesium/blob/1.147/packages/engine/Source/Scene/PostProcessStageLibrary.js)
14. [CesiumGS/cesium 1.147 — AutomaticUniforms source (`czm_frameNumber`)](https://github.com/CesiumGS/cesium/blob/1.147/packages/engine/Source/Renderer/AutomaticUniforms.js)
15. [Cesium Documentation — BillboardGraphics (`disableDepthTestDistance`)](https://cesium.com/learn/cesiumjs/ref-doc/BillboardGraphics.html)
16. [Cesium Documentation — Globe (`depthTestAgainstTerrain`)](https://cesium.com/learn/cesiumjs/ref-doc/Globe.html)
17. [Cesium Documentation — PolygonGraphics (`classificationType`)](https://cesium.com/learn/cesiumjs/ref-doc/PolygonGraphics.html)
18. [Cesium Sandcastle — Circles and Ellipses](https://sandcastle.cesium.com/index.html?id=circles-and-ellipses)
19. [Cesium Sandcastle — Materials](https://sandcastle.cesium.com/index.html?id=materials)
20. [Cesium Sandcastle — Post Processing](https://sandcastle.cesium.com/index.html?id=post-processing)
21. [Cesium Sandcastle — Spheres and Ellipsoids](https://sandcastle.cesium.com/index.html?id=spheres-and-ellipsoids)
22. [Cesium Sandcastle — Polygons](https://sandcastle.cesium.com/index.html?id=polygons)
23. [Cesium Documentation — Scene (`requestRenderMode`)](https://cesium.com/learn/cesiumjs/ref-doc/Scene.html#requestRenderMode)
