# cesium-project

基于 Vue 3 + TypeScript 的三维地球展示项目。后台通过“三维地球”功能卡片打开三维地球弹窗，并使用 Cesium 加载天地图影像与中文注记。

## 技术栈

- Vue 3（Composition API + `<script setup lang="ts">`）
- TypeScript
- Vue Router（HTML5 History 模式）
- Pinia（setup store 约定）
- Element Plus
- Cesium
- Vite
- Vitest + Vue Test Utils（jsdom）
- Playwright（Chromium）
- ESLint + Prettier

## 环境要求

- Node.js `24.22.0`（见 `.nvmrc` 与 `package.json` 的 `engines`）
- pnpm `12.14.0`（见 `package.json` 的 `packageManager`）

推荐通过 Corepack 使用项目锁定的 pnpm 版本：

```bash
corepack enable
pnpm install
```

如果 Corepack 未启用，也可以先执行 `corepack prepare pnpm@12.14.0 --activate` 再安装依赖。

首次运行浏览器测试前安装 Chromium：

```bash
pnpm exec playwright install chromium
```

## 天地图密钥配置

项目只提交空白的 `.env.example`，真实环境文件不会进入版本库。本地开发时复制示例文件，并从团队密码库填入密钥：

```bash
cp .env.example .env.local
```

```dotenv
VITE_TIANDITU_TOKEN=your-token
```

修改环境文件后需要重新启动开发服务器或重新构建。密钥缺失或为空时，应用和三维地球弹窗仍可使用，但会跳过天地图图层，并在浏览器控制台记录错误。

`VITE_` 变量最终会出现在浏览器产物和网络请求中，不能作为服务端秘密。正式使用前需要在天地图控制台配置允许域名，并定期轮换密钥。

GitHub Actions 不会自动把 Secret 暴露成 Vite 的 `VITE_` 变量。仓库使用 `production` Environment Secret `TIANDITU_TOKEN`，并在构建步骤中显式映射为 `VITE_TIANDITU_TOKEN`。配置方式：

1. 打开仓库的 `Settings` -> `Secrets and variables` -> `Actions` -> `Environments` -> `production`，新增 Environment secret `TIANDITU_TOKEN`。
2. 如果当前账号没有 Environment secret 权限，可以在 `Repository secrets` 中新增同名 `TIANDITU_TOKEN`。
3. 不要只创建名为 `VITE_TIANDITU_TOKEN` 的 Secret 并假定它会自动被读取；当前 workflow 引用的是 `TIANDITU_TOKEN`。已有 `VITE_TIANDITU_TOKEN` Secret 时，请改名为 `TIANDITU_TOKEN`，或同步修改 workflow 的映射。

保存 Secret 后需要重新运行 `Deploy GitHub Pages`（或 `Release Build`）才会使用新值。`VITE_TIANDITU_TOKEN` 会出现在公开构建产物中，必须按可限制来源域名、可轮换的客户端凭据管理，不要把 token 提交到仓库或粘贴到公开评论中。

正式构建通过 GitHub Actions 的 **Release Build** 手动触发。该 workflow 只允许默认分支运行，要求 `production` Environment 中存在 `TIANDITU_TOKEN` Secret，并将其映射为构建时的 `VITE_TIANDITU_TOKEN`。验证和构建成功后，会以 `cesium-project-dist` 名称上传根基路径的 `dist` 产物，作为通用静态托管产物。

GitHub Pages 部署使用独立流程，目标地址为 `https://bobbyliu601.github.io/cesium-project/`。`main` 推送后先执行完整 `pnpm verify`，再发布使用 `/cesium-project/` 基路径的构建产物；保留手动重跑，不提供 PR 预览。workflow 会启用或使用 GitHub Actions 的 Pages Source，并在构建前检查映射后的 `VITE_TIANDITU_TOKEN` 去空白后是否非空。`production` Environment 中的 `TIANDITU_TOKEN` 是显示天地图图层的可选增强项，缺失或为空白时记录 warning 并继续部署降级版本。正式启用天地图图层前，还需要配置该 Secret 和天地图允许域名。具体边界见 ADR 0006。

## 常用命令

| 命令                  | 说明                                                      |
| --------------------- | --------------------------------------------------------- |
| `pnpm dev`            | 启动开发服务器                                            |
| `pnpm build`          | 类型检查、构建生产版本并执行包体门禁                      |
| `pnpm build:pages`    | 使用 Pages 基路径构建并生成 `404.html`                    |
| `pnpm preview`        | 本地预览生产构建                                          |
| `pnpm lint`           | 运行 oxlint 与 ESLint                                     |
| `pnpm format`         | 使用 Prettier 格式化代码                                  |
| `pnpm format:check`   | 检查格式是否符合 Prettier 规则                            |
| `pnpm type-check`     | 使用 vue-tsc 做类型检查                                   |
| `pnpm test`           | 运行单元测试                                              |
| `pnpm test:unit`      | 运行单元测试（与 `pnpm test` 等价）                       |
| `pnpm test:e2e`       | 运行 Playwright 浏览器测试                                |
| `pnpm check:secrets`  | 扫描工作区中的疑似凭据                                    |
| `pnpm check:template` | 校验 Vue 模板的按钮内容模型                               |
| `pnpm check:bundle`   | 检查生产构建的 Cesium 边界与入口包体                      |
| `pnpm check:pages`    | 检查 Pages 产物基路径、子路由回退和 Cesium 静态资源       |
| `pnpm verify`         | 运行 lint、格式、类型、测试、密钥扫描、生产构建与包体门禁 |
| `pnpm verify:pages`   | 构建 Pages 产物并执行 Pages 专用检查                      |

## 目录结构

```text
.
├── docs/adr/            # 架构决策记录
├── public/              # 静态资源
├── src/
│   ├── __tests__/       # 应用级测试
│   ├── assets/          # 全局样式与本地图片
│   ├── components/      # 后台组件
│   ├── data/            # 静态展示数据
│   ├── layouts/         # 后台管理壳
│   ├── router/          # 路由配置
│   ├── views/           # 页面视图
│   ├── App.vue          # 应用外壳
│   └── main.ts          # 应用入口
├── e2e/                 # Playwright 浏览器测试
├── index.html
└── vite.config.ts
```

## 开发约定

- 所有 Vue 组件使用 Composition API 与 `<script setup lang="ts">`。
- Pinia store 统一使用 setup store 写法。
- 新增页面时在 `src/views/` 中创建视图，并在 `src/router/index.ts` 注册路由。
- 测试优先覆盖用户可观察行为，应用装配与路由使用应用级 seam 验证。
- `pnpm install` 会安装 pre-commit 密钥扫描；完整扫描、包体门禁和模板校验都接入 `pnpm verify`。
- CI 额外使用固定版本的 actionlint 检查 GitHub Actions workflow；Windows 本地不要求安装 Go。
- 完整编码、验证与提交约定见 `docs/CODING_STANDARDS.md`。

## 部署说明

### GitHub Pages

GitHub Pages 使用项目页地址 `https://bobbyliu601.github.io/cesium-project/`，构建基路径固定为 `/cesium-project/`。路由继续使用 HTML5 History，部署产物需要包含由 `index.html` 复制的 `404.html`；直接访问或刷新子路由时 HTTP 状态仍为 404，但应用会按原始地址恢复渲染。

`.github/workflows/pages.yml` 在默认分支更新后执行完整验证、Pages 专用构建和浏览器检查，再通过 GitHub 官方 Pages Actions 发布。`pnpm verify:pages` 可复现构建与检查；没有天地图 token 时，本地和 Pages 部署都会降级渲染。

### 其他静态托管

路由使用 `createWebHistory`，生产环境的静态服务器必须把所有前端路由回退到 `index.html`，否则直接访问或刷新子路由会返回 404。

以 Nginx 为例：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
