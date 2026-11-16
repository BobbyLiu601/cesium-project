# 粒子效果示例素材

本文记录 `3.3、粒子效果` 五项演示的封面、粒子纹理、参考来源和运行参数。参考站核对提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`，运行时不热链参考站资源。

## 封面

| 当前编号 | 演示名称 | 本地文件                                       | 参考站原始文件                          |
| -------- | -------- | ---------------------------------------------- | --------------------------------------- |
| `3.3.1`  | 火焰     | `src/assets/effect-covers/3-3-1-fire.jpg`      | `examples/cesiumEx/img/5.4.1、火焰.jpg` |
| `3.3.2`  | 水枪     | `src/assets/effect-covers/3-3-2-water-gun.jpg` | `examples/cesiumEx/img/5.4.2、水枪.jpg` |
| `3.3.3`  | 爆炸     | `src/assets/effect-covers/3-3-3-explosion.jpg` | `examples/cesiumEx/img/5.4.3、爆炸.jpg` |
| `3.3.4`  | 喷雾     | `src/assets/effect-covers/3-3-4-spray.jpg`     | `examples/cesiumEx/img/5.4.4、喷雾.jpg` |
| `3.3.5`  | 烟       | `src/assets/effect-covers/3-3-5-smoke.jpg`     | `examples/cesiumEx/img/5.4.5、烟.jpg`   |

## 粒子纹理

| 本地文件                                  | 参考站原始文件                 | 使用场景   |
| ----------------------------------------- | ------------------------------ | ---------- |
| `src/assets/particle-textures/fire.png`   | `examples/cesiumEx/fire.png`   | 火焰、喷雾 |
| `src/assets/particle-textures/water.png`  | `examples/cesiumEx/water.png`  | 水枪       |
| `src/assets/particle-textures/explot.png` | `examples/cesiumEx/explot.png` | 爆炸       |
| `src/assets/particle-textures/smoke.png`  | `examples/cesiumEx/smoke.png`  | 烟         |

参考站文件拼写 `explot.png` 保持原样，避免无意义的资源改名。

## 场景参数

五项演示共用以下默认值：发射率 `5`、生命周期 `16` 秒、单粒子生命 `1..6` 秒、速度 `1..4`、初始缩放 `0`、结束缩放 `10`、粒子纹理尺寸 `25 x 25`、按米缩放、循环发射。相机均位于 `-117.16, 32.71` 上方 `1500` 米，发射器局部偏移为 `(-4, 0, 1.4)`。

| 编号    | 纹理     | 发射器               | 起始颜色           | 结束颜色              | 重力回调                    | 锚点高度 |
| ------- | -------- | -------------------- | ------------------ | --------------------- | --------------------------- | -------- |
| `3.3.1` | `fire`   | `ConeEmitter(45°)`   | 白色，不透明       | `(0.5, 0, 0, 0)`      | 无                          | `0` 米   |
| `3.3.2` | `water`  | `CircleEmitter(0.2)` | `(1, 1, 1, 0.6)`   | `(0.8, 0.86, 1, 0.4)` | `(20, normalY, -30)` 加速度 | `0` 米   |
| `3.3.3` | `explot` | `CircleEmitter(5)`   | 红色，透明度 `0.7` | 黄色，透明度 `0.3`    | 无                          | `0` 米   |
| `3.3.4` | `fire`   | `CircleEmitter(2)`   | 红色，透明度 `0.7` | 黄色，透明度 `0.3`    | `(20, normalY, -30)` 加速度 | `0` 米   |
| `3.3.5` | `smoke`  | `CircleEmitter(2)`   | 黑色，透明度 `0.7` | 白色，透明度 `0.3`    | `(20, 30, normalY)` 加速度  | `100` 米 |

## 播放与降级

- 进入场景后默认循环播放，包括参考站中同样循环的“爆炸”。
- 页面提供统一的“暂停/继续”按钮；暂停使用 Cesium 场景时钟语义，继续后恢复时间推进。
- 粒子纹理和封面均随站点构建，不依赖天地图影像；天地图 Token 缺失或瓦片请求失败时，粒子场景仍可加载。
- 只有 Cesium 初始化或本地粒子资源失败时才进入可恢复错误状态。

## 授权边界

参考仓库根目录没有 `LICENSE` 文件或明确许可证标识。本项目仅按 Issue 要求本地化对应的五张封面和四张粒子纹理，不将这些素材宣称为项目可单独再授权的资产。
