# ALCY-52 粒子效果 Handoff

## 目标

在第三个一级菜单 `3、特效` 下新增 `3.3、粒子效果`，按参考站 `5.4.1` 至 `5.4.5` 的顺序交付火焰、水枪、爆炸、喷雾、烟五项本地化演示。编号、名称、封面、路由和默认场景行为与参考项同步。

参考仓库：`jiawanlong/Cesium-Examples`，固定提交 `b328a14ca1a0b9b0bcae5d548e5eb2686d262baf`。

## 已确认范围

- 本 Issue 只新增 `3.3`，包含 `3.3.1` 至 `3.3.5`；不创建空的 `3.2` 占位，不实现 ALCY-51 的内容。
- 卡片顺序固定为：火焰、水枪、爆炸、喷雾、烟。
- 用户可见深链：
  - `/effects/particle-effects/3-3-1-fire`
  - `/effects/particle-effects/3-3-2-water-gun`
  - `/effects/particle-effects/3-3-3-explosion`
  - `/effects/particle-effects/3-3-4-spray`
  - `/effects/particle-effects/3-3-5-smoke`
- 封面和粒子纹理全部本地化，不热链参考站。
- 五项场景默认自动循环播放；新增统一“暂停/继续”控制，不增加发射率、颜色、尺寸等参考页没有的调节项。
- 天地图影像可选；Token 缺失或影像加载失败时不阻断粒子演示。
- 页面外壳继续使用项目现有弹窗、全屏、关闭、焦点恢复和状态提示。

## 实现入口

- 菜单、卡片、编号与路由数据：`src/data/layers.ts`
- 目录区块渲染：`src/views/ShowcaseView.vue`
- 粒子场景工厂：`src/demos/particles/particleScene.ts`
- 粒子场景类型：`src/demos/particles/types.ts`
- 通用粒子 Vue 宿主：`src/demos/ParticleDemoGlobe.vue`
- 弹窗场景分派：`src/components/FeatureDialog.vue`
- 素材说明：`docs/assets/particle-demos.md`

## 素材

- 五张封面位于 `src/assets/effect-covers/3-3-*.jpg`。
- 四张粒子纹理位于 `src/assets/particle-textures/`：`fire.png`、`water.png`、`explot.png`、`smoke.png`。
- 参考仓库没有明确 `LICENSE`，本项目只按 Issue 所需本地化素材，不扩展再授权主张。

## 测试 seam

- `createParticleScene(viewer, sceneId, setStatus)` 是场景工厂 seam，可分别验证五项场景的纹理、颜色、发射器、默认参数、自动播放、暂停/继续、监听清理和资源销毁。
- `ParticleDemoGlobe.vue` 是统一 Vue 宿主 seam，负责加载状态、错误提示、暂停按钮和移动端工具栏。
- 目录与路由使用现有数据层和组件测试，覆盖 `3.3` 分区顺序、五张卡片、深链和菜单锚点。
- Playwright 通过真实菜单和五个深链验证 ready 状态、暂停/继续、全屏/关闭、焦点恢复和移动端布局。

## 验收清单

1. `3.3、粒子效果` 出现在 `3.1、场景特效` 之后，五张卡片编号和顺序正确。
2. 五张封面和四张粒子纹理均从本地加载。
3. 五个深链直接打开对应弹窗，关闭后回到原卡片并恢复焦点。
4. 五项场景进入后自动循环播放，爆炸同样持续循环。
5. 统一暂停按钮冻结场景时钟，继续后恢复时间推进。
6. 天地图影像不可用时仍显示粒子场景且不出现阻断错误。
7. 关闭弹窗后移除预更新监听、粒子系统和实体，并恢复宿主的时钟与渲染状态。
8. `pnpm verify` 通过。

## 交付边界

- 只推送任务分支 `agent/deepseek-flash/alcy-52`，不合并 `main`，不自动创建 PR。
- 不补做 `3.2`、不复制参考站编辑器、FPS 面板、天地图 Token 或默认 Cesium 控件。
- 验收以公开行为、默认参数和默认视觉等价为准，不要求受影像服务影响的逐像素一致。
