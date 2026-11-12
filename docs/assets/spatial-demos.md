# 空间分析示例素材

## 封面来源

以下封面来自参考站 `https://jiawanlong.github.io/Cesium-Examples/`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。文件已下载到项目本地，构建时不依赖参考站域名。

| 项目                    | 本地文件                                                         | 参考站原始文件                                      |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| 2.1.3、淹没分析（简易） | `src/assets/spatial-covers/2-1-3-inundation-analysis-simple.jpg` | `examples/cesiumEx/img/4.1.3、淹没分析（简易）.jpg` |
| 2.1.6、日照分析         | `src/assets/spatial-covers/2-1-6-sunlight-analysis.jpg`          | `examples/cesiumEx/img/4.1.6、日照分析.jpg`         |
| 2.1.10、水域面          | `src/assets/spatial-covers/2-1-10-water-surface.jpg`             | `examples/cesiumEx/img/4.1.10、水域面.jpg`          |
| 2.1.13、坡向分析        | `src/assets/spatial-covers/2-1-13-aspect-analysis.jpg`           | `examples/cesiumEx/img/4.1.13、坡向分析.jpg`        |

## 边界

- 参考仓库根目录没有 `LICENSE` 文件，封面仅按 Issue 要求本地化用于目录卡片。
- 参考站的 CesiumLab 3D Tiles 数据、SuperMap SDK、Mars3D SDK 和站点 Token 均未复制。
- 日照分析使用项目内生成的 36 栋低多边形建筑，不引入第三方模型。
- 坡向分析通过 Cesium 原生 `CesiumTerrainProvider` 读取项目已使用的 `https://data.mars3d.cn/terrain`；服务不可用时回退椭球地形并展示可操作提示。
