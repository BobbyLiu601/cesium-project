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
- `pnpm build-only`：只执行生产构建。

提交前必须运行 `pnpm verify`。CI 使用同一命令，不维护第二套检查逻辑。

## 缓存与生成文件

- Vite 与 TypeScript 的缓存统一写入项目内 `.cache/`，该目录不进入 Git。
- `node_modules/`、`dist/`、`.eslintcache` 与其他生成文件不得提交。

## 文档与提交

- 项目文档、提交说明和面向用户的界面文案优先使用中文。
- 提交应聚焦单一目的，避免混入与任务无关的格式化或重构。
- 提交前确认 `pnpm verify` 通过，并检查 `git status` 只包含预期文件。
