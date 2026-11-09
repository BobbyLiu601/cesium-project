# cesium-project

三维地球展示项目的后台管理界面及其后续三维展示能力。

## Language

**后台管理壳**：
由顶部栏、侧边导航和内容区组成的后台整体布局，为后续管理页面提供固定框架。
_Avoid_: 管理页面、Vben 页面

**顶部栏（Header）**：
横跨页面顶部的区域，左侧显示系统标题“三维效果展示”。
_Avoid_: 导航栏

**侧边导航（Sidebar）**：
顶部栏下方左侧的菜单区域；窄屏时以抽屉形式呈现。
_Avoid_: 菜单栏、Sidebar Menu

**内容区（Content）**：
顶部栏下方、侧边导航右侧的区域，用于展示当前菜单项对应的页面。
_Avoid_: 主区域、页面主体

**基础配置（Basic Configuration）**：
本期唯一的菜单项和页面，展示功能卡片网格；它是可点击的叶子菜单，不是可展开的父级菜单。
_Avoid_: 基础配置子菜单、基础配置分组

**404 页面**：
访问地址未匹配任何页面时显示的后台页面，保留原地址并提供返回“基础配置”的入口。
_Avoid_: 错误跳转页、空白页

**功能卡片（Feature Card）**：
内容区网格中的展示单元，由图片和名称组成。
_Avoid_: 菜单项、入口

**三维地球**：
本期唯一功能卡片的名称。
_Avoid_: 三维场景、地球页面

**Vben 风格**：
借鉴 Vben 的后台布局、留白和视觉层次，但不复制其实现，也不依赖 Vben。
_Avoid_: Vben 复刻、Vben 集成

**GitHub Pages 站点**：
项目通过 GitHub Pages 发布的公开静态站点，项目页地址为 `https://bobbyliu601.github.io/cesium-project/`。
_Avoid_: 预览站点、生产服务器

**Pages 部署**：
将通过 `pnpm verify` 的 Pages 专用构建产物更新到 GitHub Pages 站点的动作。
_Avoid_: 发布构建、上传产物

**Release Build（发布构建）**：
手动触发、面向通用静态托管的验证与 `dist` 产物上传流程；它不等于 Pages 部署。
_Avoid_: Pages 部署、自动发布
