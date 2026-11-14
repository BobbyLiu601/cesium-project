# 场景特效示例素材

本文记录 `3.1、场景特效` 五项演示的封面、天空盒纹理、云纹理、雷声音频和参考来源，便于部署与后续维护时核对资源边界。

## 封面

封面来自参考站 `jiawanlong/Cesium-Examples`，核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。文件已本地化，运行时不热链参考站。

| 当前编号 | 演示名称   | 本地文件                                                | 参考站原始文件                                |
| -------- | ---------- | ------------------------------------------------------- | --------------------------------------------- |
| `3.1.1`  | 天空盒     | `src/assets/effect-covers/3-1-1-skybox.jpg`             | `examples/cesiumEx/img/5.1.2、天空盒.jpg`     |
| `3.1.2`  | 近地天空盒 | `src/assets/effect-covers/3-1-2-near-ground-skybox.jpg` | `examples/cesiumEx/img/5.1.3、近地天空盒.jpg` |
| `3.1.3`  | 体积云     | `src/assets/effect-covers/3-1-3-volumetric-cloud.jpg`   | `examples/cesiumEx/img/5.1.7、体积云.jpg`     |
| `3.1.4`  | 闪电       | `src/assets/effect-covers/3-1-4-lightning.jpg`          | `examples/cesiumEx/img/5.1.8、闪电.jpg`       |
| `3.1.5`  | 高度雾     | `src/assets/effect-covers/3-1-5-height-fog.jpg`         | `examples/cesiumEx/img/5.1.9、高度雾.jpg`     |

## 天空盒纹理

两套纹理均来自参考仓库 `examples/cesiumEx/SkyBox/`，并按 Cesium `SkyBox` 的六面名称存储。

### `3.1.1、天空盒`

本地目录：`src/assets/skyboxes/sky/`

| 本地文件         | 参考站文件                                    |
| ---------------- | --------------------------------------------- |
| `positive-x.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_px.jpg` |
| `negative-x.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_mx.jpg` |
| `positive-y.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_py.jpg` |
| `negative-y.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_my.jpg` |
| `positive-z.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_pz.jpg` |
| `negative-z.jpg` | `examples/cesiumEx/SkyBox/tycho2t3_80_mz.jpg` |

### `3.1.2、近地天空盒`

本地目录：`src/assets/skyboxes/near-ground/`

| 本地文件         | 参考站文件                           |
| ---------------- | ------------------------------------ |
| `positive-x.jpg` | `examples/cesiumEx/SkyBox/Right.jpg` |
| `negative-x.jpg` | `examples/cesiumEx/SkyBox/Left.jpg`  |
| `positive-y.jpg` | `examples/cesiumEx/SkyBox/Front.jpg` |
| `negative-y.jpg` | `examples/cesiumEx/SkyBox/Back.jpg`  |
| `positive-z.jpg` | `examples/cesiumEx/SkyBox/Up.jpg`    |
| `negative-z.jpg` | `examples/cesiumEx/SkyBox/Down.jpg`  |

参考页 `examples/cesiumEx/5.1.3、近地天空盒.html` 使用旧版私有 `SkyBoxOnGround`。本项目不复制该实现，而是通过 Cesium 1.147 公开的 `SkyBox`、相机高度和大气显示开关复刻等价行为。

## 闪电雷声

参考页 `examples/cesiumEx/5.1.8、闪电.html` 使用根目录 `examples/cesiumEx/dl.mp3`，但参考仓库没有明确的素材授权标识。本项目没有复制该音频。

`src/assets/audio/thunder.wav` 由项目脚本使用确定性噪声与低频包络合成：

```bash
node scripts/generate-thunder-audio.mjs
```

生成脚本为 `scripts/generate-thunder-audio.mjs`，不读取网络资源或第三方音频。场景进入后会立即尝试循环播放；浏览器拒绝自动播放时显示受阻状态并提供“重新播放雷声”按钮。

## 体积云纹理

`src/assets/clouds/cumulus-cloud.png` 由 [Cloudpipe](https://github.com/LaN-yong-code/cloudpipe) 的默认云团参数生成，再经裁剪、调色与缩放，用于透明积云布告板。Cloudpipe 以 MIT License 发布，版权归 `Copyright (c) 2024-2026 LaN.Yong`；完整许可文本见 `docs/assets/third-party/cloudpipe-LICENSE.txt`。

## 场景参数与运行时服务

- 体积云以 `BillboardCollection` 和 `sizeInMeters` 渲染透明积云纹理，云层中心位于参考位置 `114.39264, 30.52252, 200` 上方 `100` 米；初始尺寸为 `600 x 350`、亮度 `1`，X/Y 控件范围分别为 `5..2500`、`5..1500`。亮度按参考案例缩放云朵 RGB 颜色，不改变整体透明度。
- 闪电场景参照参考页的程序化雨幕、分叉闪电和云层照明方法实现；控制面板与音频自动播放行为保持项目现有交互。
- 近地天空盒沿用参考视点 `-95.166493, 39.9060534`，近地高度 `3336.6` 米、航向 `351.2°`、俯仰 `-6.7°`；低于 `225705` 米时显示近地全景。
- 高度雾沿用参考相机视点和雾参数，运行时按需读取项目已使用的 `https://data.mars3d.cn/terrain`。服务不可用时回退椭球地形并保留雾效果。
- 所有封面、六面纹理和雷声音频均随站点本地构建；仅高度雾地形在运行时访问 Mars3D 公共地形服务。

## 授权边界

参考仓库根目录没有 `LICENSE` 文件或明确许可证标识。这里仅按 Issue 要求本地化对应示例封面、天空盒纹理和场景参数，不将这些素材宣称为项目可单独再授权的资产，也不复制参考站中授权状态不明确的音频。Cloudpipe 云纹理按其 MIT License 使用，许可文本随素材保存在项目文档目录。
