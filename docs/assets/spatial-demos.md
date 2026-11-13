# 空间分析示例素材

## 封面来源

以下封面来自参考站 `https://jiawanlong.github.io/Cesium-Examples/`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。文件已下载到项目本地，构建时不依赖参考站域名。

| 项目                    | 本地文件                                                         | 参考站原始文件                                      |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| 2.1.1、淹没分析（简易） | `src/assets/spatial-covers/2-1-1-inundation-analysis-simple.jpg` | `examples/cesiumEx/img/4.1.3、淹没分析（简易）.jpg` |
| 2.1.2、日照分析         | `src/assets/spatial-covers/2-1-2-sunlight-analysis.jpg`          | `examples/cesiumEx/img/4.1.6、日照分析.jpg`         |
| 2.1.3、水域面           | `src/assets/spatial-covers/2-1-3-water-surface.jpg`              | `examples/cesiumEx/img/4.1.10、水域面.jpg`          |
| 2.1.4、坡向分析         | `src/assets/spatial-covers/2-1-4-aspect-analysis.jpg`            | `examples/cesiumEx/img/4.1.13、坡向分析.jpg`        |

## 模型来源

| 项目            | 本地目录                                  | 必需文件                                       |
| --------------- | ----------------------------------------- | ---------------------------------------------- |
| 2.1.2、日照分析 | `public/spatial-analysis/sunlight-model/` | `tileset.json`、`NoLod_0.b3dm`、`NoLod_1.b3dm` |

模型来自参考站 `4.1.6、日照分析` 对应的 `examples/cesiumEx/data/`，生成工具标识为 `cesiumlab2@www.cesiumlab.com/model2tiles`。未被 tileset 引用的 `.cmpt` 文件和 `scenetree.json` 未保留。

## 边界

- 参考仓库根目录没有 `LICENSE` 文件。项目在 ALCY-46 中记录了用户于 2026-11-12 明确要求 `2.1.2` 使用参考站模型、并于 2026-11-13 确认 `4.1.16` 是 `4.1.6` 笔误的书面请求；这是当前本地化使用的项目范围内依据，不构成对第三方素材的再授权。
- 日照分析使用参考站 `4.1.6、日照分析` 对应的 `data/tileset.json` 3D Tiles 城市模型，仅保留运行时必需的 tileset 与两个 b3dm 文件。
- 除日照分析所需的 CesiumLab 3D Tiles 模型外，SuperMap SDK、Mars3D SDK 和站点 Token 均未复制。
- 淹没分析使用参考区域山体地形，水体从 1000 米上涨至 3600 米；服务不可用时回退椭球地形并保留挤出上涨动画。
- 水域面使用 Cesium `Water` 材质、法线贴图和持续渲染，确保波纹动画可见。
- 坡向分析通过 Cesium 原生 `CesiumTerrainProvider` 读取项目已使用的 `https://data.mars3d.cn/terrain`，按参考范围绘制红色坡度坡面与下坡方向箭头；服务不可用时回退椭球地形并保留完整分析图层。
