# ADR 0006：GitHub Pages 自动部署边界

- 状态：已接受
- 日期：2026-11-09
- 修订：ADR 0003 中“Release Build 不执行部署”的边界

## 背景

项目需要通过 GitHub Pages 提供公开可访问的演示站点，并在 `main` 更新后自动发布。当前 Vite 构建和 Cesium 静态资源按站点根路径 `/` 生成，Vue Router 使用 HTML5 History；项目页的实际路径是 `/cesium-project/`，GitHub Pages 又不提供任意 SPA 子路由的服务端重写。同时，ADR 0003 约定 Release Build 只上传产物、不执行部署，因此需要明确发布、部署和路由回退之间的新边界。

## 决策

- GitHub Pages 站点使用项目页默认地址 `https://bobbyliu601.github.io/cesium-project/`，不配置自定义域名。Pages 专用构建使用 `/cesium-project/` 基路径，Cesium 静态资源 URL 必须跟随该基路径。
- `main` 推送在完整 `pnpm verify` 通过后自动部署，并保留 `workflow_dispatch` 手动重跑；PR 预览和 tag 发布不在本期范围内。
- 继续使用 HTML5 History，并在部署产物中生成 `404.html` 作为 SPA 回退，以保留现有干净 URL 和路由行为。
- 复用 `production` Environment 的 `TIANDITU_TOKEN` Secret，并在 workflow 的构建步骤显式映射为 `VITE_TIANDITU_TOKEN`。GitHub Secret 不会自动变成 Vite 变量；`VITE_TIANDITU_TOKEN` 是构建时环境变量名，不是默认的 Secret 名称。缺少映射值时，Pages 继续发布跳过天地图图层的降级版本并输出 warning；Release Build 继续保持 fail-fast。
- 页面构建前检查映射后的 `VITE_TIANDITU_TOKEN`（去除首尾空白）是否为空，避免 workflow 已经配置映射、但 Secret 实际为空时把漏配误判为成功。站点按公开站点管理，天地图允许域名必须包含目标 Pages 域名；`VITE_` 注入值按可限制来源域名、可轮换的公开客户端凭据管理。
- 使用 GitHub 官方 Pages Actions 和 `github-pages` 部署环境，不维护 `gh-pages` 分支。
- Release Build 继续作为手动触发、面向通用静态托管的产物流程，仍使用根基路径；Pages 构建通过独立流程使用项目基路径。两者共享验证门禁，但不互相替代。
- Pages 自动化检查应验证静态站点层面的外部行为：基路径入口可加载、子路由刷新可由 `404.html` 恢复、Cesium 静态资源指向 Pages 基路径；不直接断言 Vite 配置等实现细节。

## 备选方案

- 改用 hash 路由：部署最简单，但会改变现有公开 URL 和路由体验，因此不采用。
- 仅在手动 Release Build 中部署：审批边界更严格，但不符合 `main` 推送后自动更新站点的目标。
- 使用 `gh-pages` 分支：兼容旧流程，但需要额外分支写权限和产物同步逻辑；官方 Pages Actions 更直接，因此不采用。
- 配置自定义域名：可以改善品牌和访问地址，但引入 DNS、证书和天地图白名单迁移等外部工作，留待后续独立任务。

## 影响

- 合并到 `main` 的改动可以直接进入公开站点；生产环境审批、仓库 Pages 设置和天地图域名白名单成为上线前置条件。
- 直接访问或刷新子路由时，GitHub Pages 会返回 `404.html` 和 HTTP 404 状态，但应用仍能按原始地址恢复渲染。
- 手动 Release Build 与 Pages 自动部署生成不同基路径的产物，审查时不能把两种产物混用。
- GitHub Pages 启用前，仓库管理员需要将 Pages Source 设置为 GitHub Actions，并确认 `production` Environment 的 Secret 可用。
- GitHub Secret 名称必须与 workflow 引用一致；仅在 GitHub 中创建 `VITE_TIANDITU_TOKEN` 不会自动被现有流程读取。缺省行为是 Pages 降级部署、Release Build 失败，两者语义不同。
