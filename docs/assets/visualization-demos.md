# 可视化示例素材

本文记录 `4.1、GIS客户端` 与 `4.2、数据可视化` 七项演示的参考映射、封面来源、固定数据和第三方依赖，便于部署与后续维护时核对资源边界。

## 参考映射

参考站为 `https://jiawanlong.github.io/Cesium-Examples/`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。参考站菜单中的 `8.1.3、等值面` 对应页面和封面文件名仍使用 `8.1.5`。

| 当前编号 | 演示名称   | 本地路由                                                    | 参考编号 | 参考页面                 |
| -------- | ---------- | ----------------------------------------------------------- | -------- | ------------------------ |
| `4.1.1`  | 叠加分析   | `/visualization/gis-client/4-1-1-overlay-analysis`          | `8.1.1`  | `8.1.1、叠加分析.html`   |
| `4.1.2`  | 泰森多边形 | `/visualization/gis-client/4-1-2-thiessen-polygon`          | `8.1.2`  | `8.1.2、泰森多边形.html` |
| `4.1.3`  | 等值面     | `/visualization/gis-client/4-1-3-isosurface`                | `8.1.3`  | `8.1.5、等值面.html`     |
| `4.2.1`  | 海流       | `/visualization/data-visualization/4-2-1-ocean-current`     | `8.2.2`  | `8.1.2、海流.html`       |
| `4.2.2`  | 3d热力图   | `/visualization/data-visualization/4-2-2-3d-heatmap`        | `8.2.3`  | `8.1.3、3d热力图.html`   |
| `4.2.3`  | 风场       | `/visualization/data-visualization/4-2-3-wind-field`        | `8.2.4`  | `8.1.4、风场.html`       |
| `4.2.4`  | 蜂窝热力图 | `/visualization/data-visualization/4-2-4-honeycomb-heatmap` | `8.2.6`  | `8.2.6、蜂窝热力图.html` |

## 封面来源

以下封面按 Issue 要求取自参考站，并已下载到项目本地；构建和运行时不热链参考站域名。

| 当前编号 | 本地文件                                                      | 参考站原始文件                                |
| -------- | ------------------------------------------------------------- | --------------------------------------------- |
| `4.1.1`  | `src/assets/visualization-covers/4-1-1-overlay-analysis.jpg`  | `examples/cesiumEx/img/8.1.1、叠加分析.jpg`   |
| `4.1.2`  | `src/assets/visualization-covers/4-1-2-thiessen-polygon.jpg`  | `examples/cesiumEx/img/8.1.2、泰森多边形.jpg` |
| `4.1.3`  | `src/assets/visualization-covers/4-1-3-isosurface.jpg`        | `examples/cesiumEx/img/8.1.5、等值面.jpg`     |
| `4.2.1`  | `src/assets/visualization-covers/4-2-1-ocean-current.jpg`     | `examples/cesiumEx/img/8.1.2、海流.jpg`       |
| `4.2.2`  | `src/assets/visualization-covers/4-2-2-3d-heatmap.jpg`        | `examples/cesiumEx/img/8.1.3、3d热力图.jpg`   |
| `4.2.3`  | `src/assets/visualization-covers/4-2-3-wind-field.jpg`        | `examples/cesiumEx/img/8.1.4、风场.jpg`       |
| `4.2.4`  | `src/assets/visualization-covers/4-2-4-honeycomb-heatmap.jpg` | `examples/cesiumEx/img/8.2.6、蜂窝热力图.jpg` |

## 固定数据与呈现

- `4.1.1、叠加分析` 沿用参考页中的两组多边形坐标，在本地调用 Turf `intersect` 计算相交面，再用 `area` 计算面积。Turf 在计算时会改写传入多边形的坐标，因此场景先复制参考坐标，确保导出的固定数据保持不变。
- `4.1.2、泰森多边形` 将参考页的 50 个随机点和四角边界点改为固定种子生成的 50 个点加四个边界点；仍按参考页使用 Turf `tin` 生成三角网，并为三角面分配稳定颜色。参考页标题为“泰森多边形”，但其可观察结果实际是彩色 TIN 三角面。
- `4.1.3、等值面` 不再请求参考站的 `windpoint.json`，改为本地生成 `20 × 15` 的固定点阵和风场值；按 `0..9、99` 的参考分级使用 Turf `isobands` 绘制分级面、`isolines` 绘制等值线，并显示 `0–9+ m/s` 图例。固定风场覆盖全部 10 个色带，运行时不依赖参考站或临时数据地址。
- `4.2.1、海流` 使用东亚至西太平洋的固定解析矢量场生成覆盖海域的蓝→绿→黄→红速度热力图，并叠加固定种子生成的 260 条加长流线；流线几何一次生成，由着色器沿轨迹移动高亮段，避免逐帧重建顶点，热力层和流线颜色均按流速映射，进入后自动播放，可暂停和继续，并显示速度色带图例。不下载参考站的全球流场 JSON，也不请求海洋底图瓦片。
- `4.2.2、3d热力图` 使用北京固定区域内的 50 个确定性热点和 `192 × 192` 连续纹理三角网，生成最高约 1,500 米的三维热力地形；热力纹理包含坡面明暗，网格边缘带实体侧壁，顶点高度与颜色使用同一热力值，加载后保持静态并显示只读色带。
- `4.2.3、风场` 使用中国及周边区域的固定解析矢量场和固定种子生成的 2,000 条加长风轨迹，采用 15 档风速色带和着色器驱动的渐隐流动高亮；静态轨迹按颜色与相位分组到多个 `PolylineCollection`，逐帧只请求重绘而不重建顶点，进入后自动播放，可暂停和继续。不引入参考站的 `cesium-wind` 插件或风场 JSON。
- `4.2.4、蜂窝热力图` 使用参考页同范围的 `50 × 50` 固定网格，每格按确定性插值结果从地表挤出到最高 800 米，全部单元合并到一个批量 `Primitive`；颜色使用带透明度的连续绿色至红色高程色带，加载后保持静态并显示只读色带，不使用 Turf/Kriging、随机点或参考站内嵌 Token。
- 七项场景均使用项目通用 Cesium 弹窗、可视化宿主和全屏/关闭能力；`4.2.1`、`4.2.3` 只增加统一的暂停/继续控制，两个热力图不增加参数面板。基础底图仅在项目配置 `VITE_TIANDITU_TOKEN` 时加载，不复制参考站内嵌的天地图 Token。

## Turf 依赖

项目按功能引入以下 `7.4.0` 版本模块，均以 MIT License 发布，版本由 `pnpm-lock.yaml` 锁定：

- `@turf/area`
- `@turf/helpers`
- `@turf/intersect`
- `@turf/isobands`
- `@turf/isolines`
- `@turf/tin`

## 授权边界

参考仓库根目录没有 `LICENSE` 文件或 SPDX 许可证标识；其 README 写明示例“免费、无任何收费、无需找我授权，直接用即可”，但这不是附带完整许可文本的正式开源许可证。本项目仅按 Issue 和已确认方案本地化这七张参考封面，场景数据与实现独立编写，不复制参考站脚本、`turf.min.js`、`windpoint.json`、洋流数据、`cesium-wind`、Kriging 脚本或天地图 Token。参考封面保留来源和核对提交记录，不宣称项目可对这些素材单独再授权。
