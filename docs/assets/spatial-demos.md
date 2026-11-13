# 空间分析示例素材

## 封面来源

以下封面来自参考站 `https://jiawanlong.github.io/Cesium-Examples/`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。文件已下载到项目本地，构建时不依赖参考站域名。

| 项目                    | 本地文件                                                          | 参考站原始文件                                      |
| ----------------------- | ----------------------------------------------------------------- | --------------------------------------------------- |
| 2.1.1、淹没分析（简易） | `src/assets/spatial-covers/2-1-1-inundation-analysis-simple.jpg`  | `examples/cesiumEx/img/4.1.3、淹没分析（简易）.jpg` |
| 2.1.2、日照分析         | `src/assets/spatial-covers/2-1-2-sunlight-analysis.jpg`           | `examples/cesiumEx/img/4.1.6、日照分析.jpg`         |
| 2.1.3、水域面           | `src/assets/spatial-covers/2-1-3-water-surface.jpg`               | `examples/cesiumEx/img/4.1.10、水域面.jpg`          |
| 2.1.4、坡向分析         | `src/assets/spatial-covers/2-1-4-aspect-analysis.jpg`             | `examples/cesiumEx/img/4.1.13、坡向分析.jpg`        |
| 2.2.1、视频纹理         | `src/assets/spatial-covers/2-2-1-video-texture.jpg`               | `examples/cesiumEx/img/4.3.1、视频纹理.jpg`         |
| 2.2.2、视频投射(直播流) | `src/assets/spatial-covers/2-2-2-video-projection-livestream.jpg` | `examples/cesiumEx/img/4.3.2、视频投射.jpg`         |

## 视频来源

| 项目            | 本地文件                                                         | 来源与作者                                                                                                                                                         | 许可证                                                    | 处理与大小                                                                 |
| --------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- | -------------------------------------------------------------------------- |
| 2.2.1、视频纹理 | `public/spatial-analysis/video-fusion/sheboygan-falls-drone.mp4` | [Sheboygan Falls, Wisconsin; aerial drone video](https://commons.wikimedia.org/wiki/File:Sheboygan_Falls,_Wisconsin;_aerial_drone_video.webm)，作者 WLUK-TV FOX 11 | [CC BY 3.0](https://creativecommons.org/licenses/by/3.0/) | 原视频 1280×720、98.164 秒；截取前 60 秒并移除音轨，MP4 为 16,360,812 字节 |

`2.2.1` 在界面右下角显示视频作者、Wikimedia Commons 来源和 CC BY 3.0 许可。`2.2.2` 使用参考站原始第三方 HLS 直播流 `https://kbs-dokdo.gscdn.com/dokdo_300/definst/dokdo_300.stream/playlist.m3u8`，未复制到本地；加载失败时复用 `2.2.1` 的本地视频。该直播流的内容与可用性由第三方服务控制，不在本项目许可证覆盖范围内。

## 模型来源

| 项目            | 本地目录                                  | 必需文件                                       |
| --------------- | ----------------------------------------- | ---------------------------------------------- |
| 2.1.2、日照分析 | `public/spatial-analysis/sunlight-model/` | `tileset.json`、`NoLod_0.b3dm`、`NoLod_1.b3dm` |

模型来自参考站 `4.1.6、日照分析` 对应的 `examples/cesiumEx/data/`，生成工具标识为 `cesiumlab2@www.cesiumlab.com/model2tiles`。未被 tileset 引用的 `.cmpt` 文件和 `scenetree.json` 未保留。

## 边界

- 参考仓库根目录没有 `LICENSE` 文件。项目在 ALCY-46 中记录了用户于 2026-11-12 明确要求 `2.1.2` 使用参考站模型、并于 2026-11-13 确认 `4.1.16` 是 `4.1.6` 笔误的书面请求；这是当前本地化使用的项目范围内依据，不构成对第三方素材的再授权。
- 日照分析使用参考站 `4.1.6、日照分析` 对应的 `data/tileset.json` 3D Tiles 城市模型，仅保留运行时必需的 tileset 与两个 b3dm 文件。
- 除日照分析所需的 CesiumLab 3D Tiles 模型外，SuperMap SDK、Mars3D SDK 和站点 Token 均未复制。
- 淹没分析使用参考区域山体地形，水体在高程瓦片加载完成后从 1000 米上涨至 2000 米；服务不可用时回退椭球地形并保留挤出上涨动画。
- 水域面使用 Cesium `Water` 材质、法线贴图和持续渲染，确保波纹动画可见。
- 坡向分析通过 Cesium 原生 `CesiumTerrainProvider` 读取项目已使用的 `https://data.mars3d.cn/terrain`，按参考范围绘制红色坡度坡面与下坡方向箭头；服务不可用时回退椭球地形并保留完整分析图层。
