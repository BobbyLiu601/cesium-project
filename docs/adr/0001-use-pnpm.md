# ADR 0001：使用 pnpm 作为包管理器

- 状态：已接受
- 日期：2026-11-03

## 背景

项目需要从零建立 Vue 3 + TypeScript 前端骨架。当前开发机器已经安装 Node.js 24.22.0 与 npm，但团队希望获得更严格的依赖隔离、更快的安装速度以及可复现的依赖解析结果。

## 决策

项目统一使用 pnpm 管理依赖：

- 通过 `package.json` 的 `packageManager` 固定 pnpm 版本为 `12.14.0`，由 Corepack 负责选择版本。
- 提交 `pnpm-lock.yaml`，确保不同机器解析出相同的依赖树。
- 使用 Node.js 24.22.0，并通过 `.nvmrc` 与 `engines.node` 声明版本约束。
- 不使用 npm 或 yarn 生成锁文件，避免多个包管理器并存造成锁文件漂移。

## 影响

- 新开发者需要启用 Corepack，或显式安装项目指定的 pnpm 版本。
- CI 与本地环境使用同一套安装命令（`pnpm install`），减少环境差异。
- 依赖安装可复现性由 `packageManager`、Node 版本和 `pnpm-lock.yaml` 共同保证。
