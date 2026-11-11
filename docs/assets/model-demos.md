# 模型示例资产来源

本文记录 `1.4、模型` 下 8 个演示使用的封面和 3D 模型来源，便于公开部署时核对资源边界。

## 封面

封面来自参考站 `jiawanlong/Cesium-Examples` 的 `examples/cesiumEx/img/` 目录。核对时对应提交为 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。

| 本地文件                                          | 参考项                         | 原始文件                           |
| ------------------------------------------------- | ------------------------------ | ---------------------------------- |
| `src/assets/model-covers/load-model.jpg`          | `2.4.1、加载模型`              | `2.4.1、加载模型.jpg`              |
| `src/assets/model-covers/primitive-model.jpg`     | `2.4.2、primitive加载模型`     | `2.4.2、primitive加载模型.jpg`     |
| `src/assets/model-covers/mass-models.jpg`         | `2.4.3、primitive加载大量模型` | `2.4.3、primitive加载大量模型.jpg` |
| `src/assets/model-covers/model-motion.jpg`        | `2.4.4、模型运动`              | `1.8、时间运动.jpg`                |
| `src/assets/model-covers/model-interpolation.jpg` | `2.4.5、模型插值运动`          | `2.4.5、模型插值运动.jpg`          |
| `src/assets/model-covers/pick-child-node.jpg`     | `2.4.6、点击获取子节点`        | `2.4.6、点击获取子节点.jpg`        |
| `src/assets/model-covers/manual-model.jpg`        | `2.4.7、人工模型`              | `2.4.7、人工模型.jpg`              |
| `src/assets/model-covers/wind-turbine.jpg`        | `2.4.8、风力发电机`            | `2.4.8、风力发电机.jpg`            |

参考仓库在核对提交的根目录未提供 `LICENSE` 文件或明确许可证标识。这里仅按 Issue 要求本地化对应示例封面，不将封面作为可单独复用的素材对外授权。

来源目录：

`https://github.com/jiawanlong/Cesium-Examples/tree/b328a14ca1a0b9b0bcae5d548e5eb2686d262baf/examples/cesiumEx/img`

## Cesium 官方模型

| 本地文件                           | 上游文件                                                          | 许可证     |
| ---------------------------------- | ----------------------------------------------------------------- | ---------- |
| `src/assets/models/cesium-air.glb` | `CesiumGS/cesium/Apps/SampleData/models/CesiumAir/Cesium_Air.glb` | Apache-2.0 |
| `src/assets/models/cesium-man.glb` | `CesiumGS/cesium/Apps/SampleData/models/CesiumMan/Cesium_Man.glb` | Apache-2.0 |

上游目录：

`https://github.com/CesiumGS/cesium/tree/main/Apps/SampleData/models`

## 项目自制模型

以下模型由项目脚本生成，不包含第三方模型数据：

| 本地文件                             | 用途                                             |
| ------------------------------------ | ------------------------------------------------ |
| `src/assets/models/city-block.glb`   | `1.4.7、人工模型` 的城市低模建筑                 |
| `src/assets/models/mass-model.glb`   | `1.4.3、primitive加载大量模型` 的轻量模型        |
| `src/assets/models/wind-turbine.glb` | `1.4.8、风力发电机` 的塔架、机舱、叶片和旋转动画 |

重新生成：

```bash
pnpm generate:models
```

生成脚本位于 `scripts/generate-project-models.mjs`，资源版权字段标记为项目自制。

## 运行时边界

- 所有封面和 GLB 均随站点本地构建，不热链参考站、Mars3D、SuperMap 或 CDN。
- 未复制参考站中许可证不明的 `feiji.glb`、`Man.glb`、`zhanji.glb` 等模型。
- 如替换第三方模型，需要同步更新本文的来源、作者和许可证信息。
