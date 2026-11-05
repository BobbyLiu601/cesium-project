# 编码标准

本文是项目共享约定的单一事实来源。本地 `AGENTS.md` 保留 Multica 运行时说明、少量速查约定和指向本文的导航。

## Vue 与 Pinia

- 所有 Vue 组件使用 Composition API。
- 组件脚本统一使用 `<script setup lang="ts">`。
- Pinia store 统一使用 setup store 写法。
- 组件与 store 优先表达用户可观察行为，避免暴露不必要的内部实现。

## 依赖与版本

- 使用 pnpm 安装依赖，并提交 `pnpm-lock.yaml`。
- Node.js 版本固定为 `.nvmrc` 与 `package.json` 中的 `24.22.0`。
- pnpm 版本由 `package.json` 的 `packageManager` 固定，通过 Corepack 激活。
- 安装可复现依赖使用 `pnpm install --frozen-lockfile`。

## 验证命令

- `pnpm verify`：提交与 CI 的完整验证入口。
- `pnpm lint`：本地自动修复 oxlint 与 ESLint 问题。
- `pnpm lint:check`：只检查、不修改文件。
- `pnpm format`：使用 Prettier 格式化。
- `pnpm format:check`：只检查格式。
- `pnpm type-check`：运行 `vue-tsc` 类型检查。
- `pnpm test`：运行 Vitest。
- `pnpm test:e2e`：运行 Playwright 浏览器测试。
- `pnpm build-only`：只执行生产构建。

提交前必须运行 `pnpm verify`。CI 使用同一命令，不维护第二套检查逻辑。

## 工程护栏

`pnpm verify` 依次执行 lint、格式、类型、Vitest、Playwright、密钥扫描、生产构建和包体门禁。以下命令也可以单独运行：

- `pnpm check:secrets`：扫描工作区中 Git 跟踪和未忽略的文件。
- `pnpm check:secrets:staged`：只扫描本次暂存内容，由 pre-commit 调用。
- `pnpm check:template`：校验 Vue 模板的按钮内容模型。
- `pnpm check:bundle`：检查最近一次 `pnpm build-only` 生成的 `dist`。

### 密钥扫描

- 使用固定版本 `secretlint@13.1.0`（由 `pnpm-lock.yaml` 锁定）扫描常见凭据，并额外检查非空、非占位的 `VITE_TIANDITU_TOKEN` 配置和 URL 中的 `tk=` 参数。
- 失败时只输出文件、行号、规则和修复建议，不回显凭据原文；测试会断言遮罩行为。
- 空白值、`your-token`、`<token>`、`change-me` 等明确占位符直接放行。
- 专用测试假值必须逐项加入 `scripts/secret-allowlist.json`，不要用忽略整个测试目录的方式绕过扫描。
- `pnpm install` 会通过 `simple-git-hooks` 安装 pre-commit；它只扫描暂存区。CI 中的 `pnpm verify` 执行完整工作区扫描，绕过本地 hook 的提交仍会被拦截。

### 包体门禁

- Vite 生产构建生成 `dist/.vite/manifest.json`，`pnpm check:bundle` 基于该 manifest 检查入口和动态 chunk。
- 入口 JavaScript gzip 预算为 400 kB。超出时命令失败并报告实际值与预算值；提高预算必须通过单独、可审查的配置变更。
- Cesium 必须存在于独立的动态 chunk，且入口不能静态导入它、入口 HTML 不能预加载它、入口 chunk 不能包含 Cesium 代码标记。
- 失败信息使用 `entry-budget`、`cesium-in-entry`、`cesium-preloaded`、`cesium-static-import`、`cesium-not-dynamic` 等代码区分原因。

### 模板内容模型

- 使用 `@vue/compiler-sfc` 解析 Vue 单文件组件，检查原生 `button` 和 `ElButton` 的默认插槽内容。
- `button` 内出现块级元素或嵌套交互元素时失败，并报告来源文件和行号。
- 该检查接入 `pnpm lint:check`，因此同时由本地 `pnpm verify` 和 CI 执行。

### actionlint

- Verify workflow 使用固定镜像 `rhysd/actionlint:1.7.7` 的独立 job 校验 GitHub Actions 的表达式、权限和 secret 引用。
- 该检查只要求 CI 环境；Windows 本地不要求安装 Go 工具。需要本地复核时可以使用 Docker：

```bash
docker run --rm -v "$PWD:/repo" -w /repo rhysd/actionlint:1.7.7
```

## 测试与交付

- 每次执行完成后，执行者必须自行运行与改动相关的测试，不能把执行测试或验收留给用户。
- 测试工具按行为选择：组件逻辑优先使用 Vitest，需要真实浏览器渲染、导航、布局或交互时使用 Playwright，不限定于特定页面或固定场景。
- 新增行为缺少对应测试时，先补充测试再交付；确实无法自动化覆盖的边界，必须在交付说明中写明原因和人工验证结果。
- 交付前运行 `pnpm verify`，并记录实际执行的测试命令与结果。

## 缓存与生成文件

- Vite 与 TypeScript 的缓存统一写入项目内 `.cache/`，该目录不进入 Git。
- `node_modules/`、`dist/`、`.eslintcache` 与其他生成文件不得提交。

## 文档与提交

- 项目文档、提交说明和面向用户的界面文案优先使用中文。
- 提交应聚焦单一目的，避免混入与任务无关的格式化或重构。
- 提交前确认 `pnpm verify` 通过，并检查 `git status` 只包含预期文件。
