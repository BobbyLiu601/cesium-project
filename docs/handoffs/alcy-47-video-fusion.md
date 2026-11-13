# ALCY-47 视频融合 Handoff

## 目标

在 `2、空间分析` 下新增两级菜单区块 `2.2、视频融合`，以卡片方式交付参考站 `4.3.1、视频纹理` 和 `4.3.2、视频投射(直播流)` 的功能等价示例。

## 已确认范围

- 菜单保持两级，不增加第三级导航。
- 本地展示编号为 `2.2.1、视频纹理`、`2.2.2、视频投射(直播流)`，名称与参考站一致。
- 深链分别为 `/spatial-analysis/2-2-1-video-texture`、`/spatial-analysis/2-2-2-video-projection-livestream`。
- `2.2.1` 使用项目本地的约一分钟城市航拍视频，静音循环，同时贴到立体立面和平面两个多边形。
- `2.2.2` 保留参考站第三方 HLS 直播流。Chrome/Firefox 按需加载 `hls.js`，Safari 优先使用原生 HLS；加载失败或超时后切换到本地视频，并提示“直播流不可用，已切换本地回退视频”。
- `2.2.2` 使用固定视点、水平 60°、垂直 40° 的视锥完成视频投射，并绘制视锥轮廓；不增加拖拽布设和参数编辑。
- 验收以参考站默认场景、相机位置、材质效果和交互结果为准，不要求像素级一致。

## 实现入口

- 菜单、卡片和路由数据：`src/data/layers.ts`
- 展示页空间分析区块：`src/views/ShowcaseView.vue`
- 场景分派：`src/demos/spatialScene.ts`
- 视频播放与 HLS/回退适配：`src/demos/spatial/videoFusionPlayback.ts`
- 投射视锥与屏幕取景几何：`src/demos/spatial/videoFusionGeometry.ts`
- 视频纹理和视频投射场景：`src/demos/spatial/videoFusionScene.ts`
- 视频来源标注：`src/demos/SpatialDemoGlobe.vue`

## 资源

- 两张封面来自参考仓库固定提交 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`，已保存到 `src/assets/spatial-covers/`。
- `2.2.1` 视频保存为 `public/spatial-analysis/video-fusion/sheboygan-falls-drone.mp4`，来源、作者、许可证和文件信息见 `docs/assets/spatial-demos.md`。
- `2.2.2` 直播地址为 `https://kbs-dokdo.gscdn.com/dokdo_300/definst/dokdo_300.stream/playlist.m3u8`。该服务由第三方控制，不可作为离线构建依赖。

## 测试 seam

- `CreateVideoFusionSceneOptions.playback` 允许单元测试注入播放器，不访问真实直播或视频文件。
- `e2e/fixtures/video-fusion-hls/` 保存由本地视频生成的 2 秒 HLS 测试流，仅通过 Playwright 网络拦截提供给浏览器。
- `VideoFusionPlayback` 隔离了原生 HLS、动态 `hls.js`、12 秒启动超时、统一的可中止等待生命周期、播放期错误回退和资源清理。
- Vitest 使用真实 Cesium 数学验证投射面四个角均位于初始视口内，并覆盖坐标换算、两个多边形材质、固定相机与视锥参数、Primitive 清理、HLS 成功、Safari 播放期错误回退、致命错误回退和延迟实例清理。
- Playwright 覆盖菜单与卡片、两个深链、视频解码、全屏、关闭、焦点恢复、动态来源标注、测试 HLS 直播成功路径和直播失败后的本地回退提示。

## 验收清单

1. `2.2、视频融合` 在两个既有空间分析卡片后显示两张新卡片。
2. 两个卡片和深链打开同一场景，关闭后回到对应卡片并恢复焦点。
3. `2.2.1` 的本地视频实际解码，并在立体立面和平面持续播放。
4. `2.2.2` 显示固定视锥；直播不可用时仍保留视锥并播放本地回退视频。
5. `pnpm verify` 通过，`hls.js` 保持动态加载且不进入入口包。

## 交付边界

- 只推送任务分支 `feat/alcy-47-video-fusion`，不合并 `main`，不默认创建 PR。
- 第三方直播流的可用性、内容和授权不由本项目保证；实现只负责保留参考语义并提供可用回退。
