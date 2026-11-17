# GIS 客户端示例素材

本文记录 `4.1、GIS客户端` 三项演示的参考映射、封面来源、固定数据和第三方依赖，便于部署与后续维护时核对资源边界。

## 参考映射

参考站为 `https://jiawanlong.github.io/Cesium-Examples/`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。参考站菜单中的 `8.1.3、等值面` 对应页面和封面文件名仍使用 `8.1.5`。

| 当前编号 | 演示名称   | 本地路由                                           | 参考编号 | 参考页面                 |
| -------- | ---------- | -------------------------------------------------- | -------- | ------------------------ |
| `4.1.1`  | 叠加分析   | `/visualization/gis-client/4-1-1-overlay-analysis` | `8.1.1`  | `8.1.1、叠加分析.html`   |
| `4.1.2`  | 泰森多边形 | `/visualization/gis-client/4-1-2-thiessen-polygon` | `8.1.2`  | `8.1.2、泰森多边形.html` |
| `4.1.3`  | 等值面     | `/visualization/gis-client/4-1-3-isosurface`       | `8.1.3`  | `8.1.5、等值面.html`     |

## 封面来源

以下封面按 Issue 要求取自参考站，并已下载到项目本地；构建和运行时不热链参考站域名。

| 当前编号 | 本地文件                                                     | 参考站原始文件                                |
| -------- | ------------------------------------------------------------ | --------------------------------------------- |
| `4.1.1`  | `src/assets/visualization-covers/4-1-1-overlay-analysis.jpg` | `examples/cesiumEx/img/8.1.1、叠加分析.jpg`   |
| `4.1.2`  | `src/assets/visualization-covers/4-1-2-thiessen-polygon.jpg` | `examples/cesiumEx/img/8.1.2、泰森多边形.jpg` |
| `4.1.3`  | `src/assets/visualization-covers/4-1-3-isosurface.jpg`       | `examples/cesiumEx/img/8.1.5、等值面.jpg`     |

## 固定数据与呈现

- `4.1.1、叠加分析` 沿用参考页中的两组多边形坐标，在本地调用 Turf `intersect` 计算相交面，再用 `area` 计算面积。Turf 在计算时会改写传入多边形的坐标，因此场景先复制参考坐标，确保导出的固定数据保持不变。
- `4.1.2、泰森多边形` 将参考页的 50 个随机点和四角边界点改为固定种子生成的 50 个点加四个边界点；仍按参考页使用 Turf `tin` 生成三角网，并为三角面分配稳定颜色。参考页标题为“泰森多边形”，但其可观察结果实际是彩色 TIN 三角面。
- `4.1.3、等值面` 不再请求参考站的 `windpoint.json`，改为本地生成 `20 × 15` 的固定点阵和风场值；按 `0..9、99` 的参考分级使用 Turf `isobands` 绘制分级面、`isolines` 绘制等值线，并显示 `0–9+ m/s` 图例。固定风场覆盖全部 10 个色带，运行时不依赖参考站或临时数据地址。
- 三个场景均使用项目通用 Cesium 弹窗的全屏与关闭能力，不增加参考站没有的业务控制。基础底图仅在项目配置 `VITE_TIANDITU_TOKEN` 时加载，不复制参考站内嵌的天地图 Token。

## Turf 依赖

项目按功能引入以下 `7.4.0` 版本模块，均以 MIT License 发布，版本由 `pnpm-lock.yaml` 锁定：

- `@turf/area`
- `@turf/helpers`
- `@turf/intersect`
- `@turf/isobands`
- `@turf/isolines`
- `@turf/tin`

## 授权边界

参考仓库根目录没有 `LICENSE` 文件或 SPDX 许可证标识；其 README 写明示例“免费、无任何收费、无需找我授权，直接用即可”，但这不是附带完整许可文本的正式开源许可证。本项目仅按 Issue 和已确认方案本地化这三张参考封面，场景数据与实现独立编写，不复制参考站脚本、`turf.min.js`、`windpoint.json` 或天地图 Token。参考封面保留来源和核对提交记录，不宣称项目可对这些素材单独再授权。
