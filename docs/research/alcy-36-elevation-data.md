# ALCY-36 高程图层数据调研

- 调研日期：2026-11-05
- 目标：为 Cesium 三维地球增加可展示的高程地形，优先寻找公开在线服务，其次寻找公开可下载的 DEM。
- 区域参照：广州市海珠区（约 113.32°E、23.08°N）；在线服务覆盖全球，不要求预先裁区。

## 结论

**推荐方案 A：直接接入 Esri 的 `Terrain 3D` 在线高程服务。** 该服务当前公开可访问、无需 token，返回 ArcGIS ImageServer 的 LERC 高程瓦片，Cesium 1.147.0 自带 `ArcGISTiledElevationTerrainProvider`，可以直接消费。它最适合本 Issue 先做出“点击高程 item 打开三维地球并展示地形”的演示效果，不需要下载、裁剪或生成瓦片。

**推荐方案 B：需要公开许可、离线部署或自行托管时，下载 Copernicus DEM GLO-30。** AWS Open Data 提供免账号的 COG 下载，标称 30 m 全球覆盖；海珠区落在 `N23E113` 这一幅 1°×1° 瓦片内，且该幅已确认存在。下载后裁剪到目标区域，再转换为 Cesium 地形瓦片即可。

需要明确一个边界：**“公开可访问”不等于“开放数据许可”**。Esri 服务是公开在线服务，但受 Esri Master License Agreement 约束，且官方明确说明该图层不用于离线导出；若项目需要可再分发、可离线的数据资产，应使用 Copernicus DEM。

## 候选对比

| 数据源                | 访问方式                     | 覆盖与分辨率                                                | 数据格式                          | Cesium 接入成本                                          | 许可/限制                                                   |
| --------------------- | ---------------------------- | ----------------------------------------------------------- | --------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------- |
| Esri Terrain 3D       | 公开在线服务，当前无需 token | 全球；由 1000 m 至 50 cm 的多源数据编译，服务最高 LOD 16    | ArcGIS ImageServer，LERC 高程瓦片 | 最低，直接使用 `ArcGISTiledElevationTerrainProvider`     | Esri Master License Agreement；在线使用，不允许离线导出瓦片 |
| Copernicus DEM GLO-30 | AWS S3/HTTPS 免账号下载      | 标称全球 30 m；AWS Public 集少数国家缺幅；官方按 1°×1° 分幅 | Cloud Optimized GeoTIFF           | 中，需要裁剪并转换为 Cesium terrain tiles                | 全球免费许可，需署名                                        |
| Mapzen Terrain Tiles  | AWS S3/HTTPS 免账号下载      | 全球；广州陆地区域主要来自 SRTM，约 30 m 原生数据           | Terrarium PNG、GeoTIFF、Skadi HGT | 较高，Terrarium PNG 不能直接交给 `CesiumTerrainProvider` | 需逐项署名；官方文档说明没有定期更新计划                    |

## 方案 A：Esri Terrain 3D

### 服务信息

- 服务地址：`https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer`
- 服务说明：为 3D 应用提供全球高程，高程为正常高（orthometric，单位米），由多个数据源编译，覆盖精度范围为 1000 m 至 50 cm。[5]
- 服务元数据：`access` 为 `public`，`copyrightText` 要求显示数据来源；`tileInfo` 提供 LOD 0–16，LOD 16 的采样分辨率约为 2.39 m/px。[5][6]
- 许可：ArcGIS 条目信息标注为 Esri Master License Agreement，并明确“不用于离线导出瓦片”。[6]

### 已验证项

以下检查均于 2026-11-05 执行：

| 检查                                                                                     | 结果                                                        |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| 服务元数据 `?f=pjson`                                                                    | HTTP 200，`Access-Control-Allow-Origin: *`                  |
| 海珠区附近 z13 瓦片 `tile/13/3557/6674`                                                  | HTTP 200，47,252 bytes，`application/octet-stream`          |
| `tilemap/13/...` 可用性接口                                                              | HTTP 200，返回 JSON                                         |
| 项目当前 Cesium 1.147.0 调用 `ArcGISTiledElevationTerrainProvider.fromUrl`（不传 token） | 初始化成功；`WebMercatorTilingScheme`，`availability: true` |
| Provider 能力                                                                            | `hasWaterMask: false`，`hasVertexNormals: false`            |

`hasVertexNormals` 和 `hasWaterMask` 为 false 不代表不能展示地形，只是不能依赖服务直接提供法线或水面遮罩。若地形在默认材质下不够明显，可开启光照并按验收观感调整场景的 `verticalExaggeration`。

### Cesium 接入方式

`ArcGISTiledElevationTerrainProvider` 的官方示例使用的正是这个服务地址。[4] 当前不需要 token：

```ts
import * as Cesium from 'cesium'

const terrainProvider = await Cesium.ArcGISTiledElevationTerrainProvider.fromUrl(
  'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
)

const viewer = new Cesium.Viewer(host, {
  terrainProvider,
  // 保留现有 Viewer 配置
})

viewer.scene.globe.enableLighting = true
// 可选：海珠区地形起伏较小，演示时可适度增大，但不要用夸张值伪造数据
viewer.scene.verticalExaggeration = 1.5
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(113.32, 23.08, 12_000),
})
```

现有 `CesiumGlobe.vue` 在初始化时同步创建 `Viewer`，接入时需把地形 Provider 的异步初始化纳入 `createSession`，并处理失败回退。建议高程弹窗沿用三维地球的 Viewer 与交互，只把 `terrainProvider` 切换为该 Provider，同时把相机定位到目标区域；不要复制两套 Cesium 初始化逻辑。

### 必须处理的署名

Provider 初始化后返回的 `credit.html` 为：

```text
Sources: Vantor, Airbus DS, USGS, NGA, NASA, CGIAR, GEBCO, N Robinson, NCEAS, NLS, OS, NMA, Geodatastyrelsen and the GIS User Community
```

当前工程在 `src/components/CesiumGlobe.vue:34` 创建 credit 容器后将其隐藏，并在 `src/components/CesiumGlobe.vue:147` 通过 CSS 隐藏 `.cesium-globe__credits` 和 `.cesium-viewer-bottom`。接入在线高程时必须调整这部分，至少要展示地形 Provider 的 credit；相应测试目前断言容器 `hidden` 且 `display: none`，也要同步修改。

## 方案 B：Copernicus DEM GLO-30

### 为什么作为本地备选

Copernicus DEM GLO-30 由 TanDEM-X 数据制作，官方描述为数字表面模型（DSM），包含建筑、基础设施和植被；GLO-30 标称全球 30 m 覆盖，GLO-90 标称全球 90 m 覆盖。AWS 的 GLO-30 Public 集合因少数国家尚未公开发布而存在少量缺幅，但广州所在的 `N23E113` 已确认可用。[1][2] 它适合在没有在线服务、需要离线部署或需要开放数据许可时使用。

海珠区所在瓦片的直接下载地址已验证：

```text
https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N23_00_E113_00_DEM/Copernicus_DSM_COG_10_N23_00_E113_00_DEM.tif
```

- HTTP 200，`image/tiff`，约 51.0 MB。
- `tileList.txt` 中存在 `Copernicus_DSM_COG_10_N23_00_E113_00_DEM`。
- 该幅 COG 覆盖 23°N–24°N、113°E–114°E，海珠区位于其中；官方数据按 1° 网格分幅，因此不能直接下载“海珠区大小”的原始文件，需要下载后裁剪。[3]

### 许可与署名

官方页面说明 GLO-30 和 GLO-90 按全球免费许可提供。[2] 如果修改或再分发 GLO-30，应使用官方要求的署名：

```text
produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European Union and ESA; all rights reserved
```

如果只是向公众传播未修改的 GLO-30，则使用官方给出的原始数据署名版本。[2] 由于本项目会裁剪和转换，实际应使用 “produced using” 版本。Copernicus 还说明其垂直基准为 EGM2008；若业务要求绝对高程精度，需要在接入时确认与 Cesium 椭球高之间的基准转换。

### 本地处理流程

1. 下载 `N23E113` COG。
2. 用 GDAL 按目标展示范围裁剪；如果存在 NODATA，先补洞，因为 Cesium Terrain Builder 不会自动处理 NODATA。
3. 转换为 Cesium 地形瓦片。`geo-data/cesium-terrain-builder` 的 `ctb-tile` 可以读取 GDAL DEM 并生成 Cesium heightmap-1.0 瓦片；Cesium 1.147 的 `CesiumTerrainProvider` 文档仍明确支持 Height Map 和 Quantized Mesh 两种格式。[7][11]
4. 确认地形目录包含 `CesiumTerrainProvider` 所需的 `layer.json`，并将其与瓦片放入可访问的静态目录，使用 `CesiumTerrainProvider.fromUrl(...)` 加载；若工具未自动生成清单，需要按 heightmap-1.0 格式补充。若后续对包体或瓦片数量敏感，再评估 Quantized Mesh 生成器。[8]

示意命令（实际范围需按目标区界微调）：

```bash
# 下载约 51 MB 的 1° COG
curl -O https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N23_00_E113_00_DEM/Copernicus_DSM_COG_10_N23_00_E113_00_DEM.tif

# 粗略裁剪到海珠区周边
gdal_translate -projwin 113.14 23.15 113.44 22.94 \
  Copernicus_DSM_COG_10_N23_00_E113_00_DEM.tif haizhu-dem.tif

# 生成 Cesium terrain tiles
ctb-tile --output-dir ./terrain-tiles haizhu-dem.tif
```

该命令是本地预处理示意，不应在前端构建阶段执行。生成物建议单独作为部署资产，不把全部瓦片直接提交进 Git。

## 未选用 Mapzen Terrain Tiles 的原因

Mapzen Terrain Tiles 是很好的公开备选：AWS Open Data 说明其提供全球裸地高程，`elevation-tiles-prod` 桶无需 AWS 账号即可访问。[9] 但 Cesium 原生地形 Provider 读取的是 `layer.json` 加地形瓦片，Terrarium PNG 需要自行解码或转换，不能直接作为 `CesiumTerrainProvider` 的数据源。[7][10] 此外，其官方数据源文档说明该数据集没有定期更新计划。[10]

如果 Copernicus 的 COG 处理链路受阻，Mapzen 的 GeoTIFF 仍可作为备用下载源；不建议把它作为本项目首选，因为会额外引入 Terrarium 编解码或切片转换工作。

## 对当前工程的落地影响

- 功能入口：在 `src/data/features.ts` 增加“高程”卡片；在 `src/views/ShowcaseView.vue` 增加对应弹窗状态和 `openFeature` 分支。
- 三维初始化：现有 `src/components/CesiumGlobe.vue:55` 使用 `EllipsoidTerrainProvider`。高程模式需改为异步创建 `ArcGISTiledElevationTerrainProvider`；建议抽成 `terrainProvider` 选择参数，避免复制 Viewer 初始化。
- 视图：现有相机初始高度为 `22_000_000`，适合全球视图；高程弹窗应设置海珠区或广州的局部视角，否则看不到地形起伏。
- 署名：在线方案必须展示 Provider credit；本地 Copernicus 方案必须展示 Copernicus 要求的署名。当前 credit 容器被隐藏，不能直接沿用。
- 视觉：海珠区以低平地形为主，高程效果可能不如山地地区明显。验收图若要求强烈地形起伏，可改用广州北部山地视角或适度提高地形夸张，但不应修改数据本身。
- 错误处理：在线服务可能受网络、服务限流或服务条款变化影响；建议 Provider 初始化失败时回退到 `EllipsoidTerrainProvider`，并给出可见提示，不能静默白屏。

## 建议决策

1. **本 Issue 先按方案 A 实现**：开发量最小，能直接验证“高程 item + 弹窗 + 三维地形”的交互链路。
2. **如果验收明确要求开放许可、离线或可再分发**：改用方案 B，并把 Copernicus 裁剪、切片、静态资源托管纳入同一任务或拆成独立子任务。
3. **不要把 Esri 在线瓦片下载后打包进仓库**：其许可信息明确不用于离线导出；需要离线时使用 Copernicus。

## 参考来源

1. [Registry of Open Data on AWS — Copernicus DEM](https://registry.opendata.aws/copernicus-dem/)
2. [Copernicus Data Space — Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM)
3. [Copernicus DEM GLO-30 S3 README](https://copernicus-dem-30m.s3.amazonaws.com/readme.html)
4. [Cesium Documentation — ArcGISTiledElevationTerrainProvider](https://cesium.com/learn/cesiumjs/ref-doc/ArcGISTiledElevationTerrainProvider.html)
5. [Esri Terrain 3D ImageServer metadata](https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer?f=pjson)
6. [ArcGIS item — Terrain 3D](https://www.arcgis.com/home/item.html?id=7029fb60158543ad845c7e1527af11e4)
7. [Cesium Documentation — CesiumTerrainProvider](https://cesium.com/learn/cesiumjs/ref-doc/CesiumTerrainProvider.html)
8. [CesiumGS — quantized-mesh-1.0 terrain format](https://github.com/CesiumGS/quantized-mesh)
9. [Registry of Open Data on AWS — Terrain Tiles](https://registry.opendata.aws/terrain-tiles/)
10. [Mapzen Terrain Tiles — formats and data sources](https://github.com/tilezen/joerd/tree/master/docs)
11. [geo-data/cesium-terrain-builder](https://github.com/geo-data/cesium-terrain-builder)
