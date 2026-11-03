# cesium-project

基于 Vue 3 + TypeScript 的三维地球展示项目。当前仓库处于脚手架阶段，只包含可运行的最小前端骨架，尚未接入 Cesium。

## 技术栈

- Vue 3（Composition API + `<script setup lang="ts">`）
- TypeScript
- Vue Router（HTML5 History 模式）
- Pinia（setup store 约定）
- Vite
- Vitest + Vue Test Utils（jsdom）
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

## 常用命令

| 命令                | 说明                                                            |
| ------------------- | --------------------------------------------------------------- |
| `pnpm dev`          | 启动开发服务器                                                  |
| `pnpm build`        | 类型检查并构建生产版本                                          |
| `pnpm preview`      | 本地预览生产构建                                                |
| `pnpm lint`         | 运行 oxlint 与 ESLint                                           |
| `pnpm format`       | 使用 Prettier 格式化代码                                        |
| `pnpm format:check` | 检查格式是否符合 Prettier 规则                                  |
| `pnpm type-check`   | 使用 vue-tsc 做类型检查                                         |
| `pnpm test`         | 运行单元测试                                                    |
| `pnpm test:unit`    | 运行单元测试（与 `pnpm test` 等价）                             |
| `pnpm verify`       | 依次运行 lint:check、format:check、type-check、test、build-only |

## 目录结构

```text
.
├── docs/adr/            # 架构决策记录
├── public/              # 静态资源
├── src/
│   ├── __tests__/       # 应用级测试
│   ├── assets/          # 全局样式
│   ├── router/          # 路由配置
│   ├── views/           # 页面视图
│   ├── App.vue          # 应用外壳
│   └── main.ts          # 应用入口
├── index.html
└── vite.config.ts
```

## 开发约定

- 所有 Vue 组件使用 Composition API 与 `<script setup lang="ts">`。
- Pinia store 统一使用 setup store 写法。
- 新增页面时在 `src/views/` 中创建视图，并在 `src/router/index.ts` 注册路由。
- 测试优先覆盖用户可观察行为，应用装配与路由使用应用级 seam 验证。
- 完整编码、验证与提交约定见 `docs/CODING_STANDARDS.md`。

## 部署说明

路由使用 `createWebHistory`，生产环境的静态服务器必须把所有前端路由回退到 `index.html`，否则直接访问或刷新子路由会返回 404。

以 Nginx 为例：

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
