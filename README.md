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

正式构建通过 GitHub Actions 的 **Release Build** 手动触发。该 workflow 只允许默认分支运行，要求 `production` Environment 中存在 `TIANDITU_TOKEN` Secret，并将其映射为构建时的 `VITE_TIANDITU_TOKEN`。验证和构建成功后，会以 `cesium-project-dist` 名称上传 `dist` 产物；本轮不自动部署到具体托管平台。

## 常用命令

| 命令                  | 说明                                                      |
| --------------------- | --------------------------------------------------------- |
| `pnpm dev`            | 启动开发服务器                                            |
| `pnpm build`          | 类型检查、构建生产版本并执行包体门禁                      |
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
| `pnpm verify`         | 运行 lint、格式、类型、测试、密钥扫描、生产构建与包体门禁 |

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

路由使用 `createWebHistory`，生产环境的静态服务器必须把所有前端路由回退到 `index.html`，否则直接访问或刷新子路由会返回 404。

以 Nginx 为例：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
