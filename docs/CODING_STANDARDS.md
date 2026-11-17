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
- `pnpm build:pages`：使用 `/cesium-project/` 基路径构建 Pages 产物，并由 `index.html` 生成 `404.html`。
- `pnpm check:pages`：通过本地静态服务器和 Playwright 检查 Pages 入口、子路由回退及 Cesium 静态资源路径。
- `pnpm verify:pages`：依次执行 `build:pages` 与 `check:pages`，由 Pages 部署 workflow 调用。

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

## Git 分支与交付

- 一个 Issue 只有一条持久任务分支 `agent/<agent>/<issue-key>`；每条执行命令使用一条基于该持久分支的 task 分支 `agent/<agent>/<issue-key>-<task-id 后 12 位>`。只读调查、问答和评审不创建分支。
- `worktree` 模式下，持久任务分支是唯一交付对象；task 分支是本次命令的临时写入口。不得创建 `<type>/<issue-key>-<slug>` 交付别名。`in_place` 模式直接使用一条任务分支。
- task 分支执行期间不删除。每次 commit 后，`post-commit` hook 通过 `scripts/run-post-commit.mjs` 调用 `node scripts/finalize-task-branch.mjs --after-commit`，把 task 分支 tip 合并回持久分支；合并成功后 task 分支仍保留，供下一轮审计和最终统一清理。
- 下一次提交的 `pre-commit` 会先检查主检出中遗留的旧 task 分支；若主检出干净，就先合并回持久分支并切回持久分支。执行 agent 仍必须在结束前手动提交，不能依赖平台代提交后的 hook 恢复。
- finalize 优先 fast-forward；持久分支已前进时允许普通 merge commit。禁止 rebase task 分支、禁止 force、禁止 reset 持久分支、禁止自动更新 `main`。发生冲突或持久分支工作树不干净时停止，不自动解决冲突，不删除任何分支。
- 合并成功后，如果主检出停在旧 task 分支且工作树干净，命令会把它切回持久分支，使下一条命令再次从持久分支创建新的 task 分支。主检出不干净时只报告，不 stash、不丢弃改动。
- 目标分支默认优先采用与 task 分支同 agent、同 Issue key 的持久分支；没有同名候选时才检查 `agent/*/<issue-key>`。存在多个候选且无法唯一确定时必须显式传入 `--target`，不能猜测。
- 开始修改前确认工作区干净并执行 `git fetch origin`。`local_directory` 的新命令应让主检出停在对应 Issue 的持久分支，不能从旧 task 分支或未合并提交派生；无法满足时停止并报告。
- 每次有文件改动的执行必须在交付前提交到当前任务分支，覆盖代码、文档和配置。提交应围绕一个完整目的；任务过程中可以保留临时状态，但交付时不得遗留应提交的未提交改动。
- 任务交付时默认只推送持久分支并设置其 upstream，交付分支名和提交哈希。`main` 保持不变，不自动创建 PR，也不自动合并。
- 未合并的 task 分支不得推送；`pre-push` 守卫会拒绝并提示先执行 finalize。已推送的持久分支不因每次交付自动 rebase；只有用户要求同步或明确授权合并时，才按需 rebase 到最新 `origin/main`，解决冲突后重新运行 `pnpm verify`。更新已推送分支最多使用 `git push --force-with-lease origin <分支>`，不得强制推送 `main`，不得使用 `git reset --hard`。
- 只有用户明确回复“issue完成”后，才执行 `node scripts/complete-issue.mjs --base <清理基线> --merge <完成分支> --authorize-main-push`。该命令先清理已合并且已释放的 task 分支，再把完成分支 fast-forward 到远端 `main`，最后更新本地 `main` 并把主检出切换到 `main`。当前执行 turn 的活动 task 分支不能在同一 turn 内删除，必须记录 SHA 并报告为 deferred。
- “issue完成”也是用户对合并 `main` 的明确授权，但 `complete-issue` 仍要求显式传入 `--authorize-main-push`。命令要求完成分支已包含最新 `origin/main`、本地 `main` 没有分叉、相关主检出不脏；任一前置条件失败时不得推送，也不能把 Issue 改为 `done`。
- `main` 推送会触发 `.github/workflows/pages.yml`，由 workflow 完成 GitHub Pages 构建和部署。命令成功并触发部署后，执行 agent 才把 Issue 状态改为 `done`；Pages 的实际部署状态以 GitHub Actions 记录为准。

### 本地 Git 守卫

- `simple-git-hooks` 的 `pre-commit` 调用 `scripts/check-git-branch.mjs pre-commit`，阻止在 `main` 或 detached HEAD 上创建提交；随后仍执行暂存区密钥扫描。
- `pre-commit` 在分支检查通过后还会同步主检出中遗留的已提交 task 分支，避免平台跳过 hook 的代提交长期不收敛。
- `post-commit` 通过 `scripts/run-post-commit.mjs` 调用 `scripts/finalize-task-branch.mjs --after-commit`，自动把当前 task 分支合并到持久分支并保留 task 分支。
- `pre-push` 调用 `scripts/check-git-branch.mjs pre-push`，阻止任何更新远端 `main` 的推送（包括删除 `main`），并拒绝推送尚未合并到持久分支的 task 分支。
- 用户明确授权合并后，执行合并操作时可临时设置 `ALLOW_MAIN_GIT_UPDATE=1` 和非空 `MAIN_GIT_UPDATE_REASON`。守卫会打印授权原因；操作结束后立即清除变量。
- 不得通过 `git commit --no-verify` 或 `git push --no-verify` 绕过守卫，因为这会同时绕过安全检查。需要绕过时只使用上述带原因的环境变量，并在交付说明中写明授权来源。

task 分支持续合并示例：

```bash
node scripts/finalize-task-branch.mjs --fallback agent/deepseek-pro/alcy-51-d9d0e4c5d03c --dry-run
node scripts/finalize-task-branch.mjs --fallback agent/deepseek-pro/alcy-51-d9d0e4c5d03c
```

正常提交会由 `post-commit` 自动执行上一步。目标分支存在多个候选时必须显式指定：

```bash
node scripts/finalize-task-branch.mjs --fallback <fallback> --target agent/<agent>/<issue-key>
```

用户回复“issue完成”后，先用 dry-run 核对清理、main 更新和本地主检出计划：

```bash
node scripts/complete-issue.mjs --base agent/<agent>/<issue-key> --merge agent/<agent>/<issue-key> --dry-run
```

确认后执行：

```bash
node scripts/complete-issue.mjs --base agent/<agent>/<issue-key> --merge agent/<agent>/<issue-key> --authorize-main-push
```

需要同时清理多条历史基线时可重复 `--base`，例如
`--base agent/deepseek-pro/alcy-55 --merge agent/deepseek-pro/alcy-56`。当前活动 task 分支会作为
deferred 保留，工作树释放后再运行不带 `--keep-current` 的清理命令。

### 显式合并授权

- 只有用户在具体 Issue 或评论中明确要求合并或回复“issue完成”时，才可更新 `main`；任务完成、测试通过或 Issue 进入评审都不构成合并授权。
- 合并前确认 task 分支已收敛到完成分支，并在完成分支合入最新 `origin/main` 后重新运行 `pnpm verify`。`complete-issue` 只接受可直接 fast-forward 的 `main`；分叉时必须先人工同步和验证，不能自动覆盖。
- `complete-issue` 在推送阶段设置带原因的 `ALLOW_MAIN_GIT_UPDATE=1`，通过本地守卫后推送；不得改用 `--no-verify`。若远端保护规则拒绝推送，停止并报告，不绕过保护。
- 合并成功后保留本地持久任务分支。当前活动 task 分支作为 deferred 记录，工作树释放后再删除。

### 远端 main 保护（人工配置项）

- 正常变更通过任务分支与 PR 汇入；禁止强推和删除 `main`；直接 fast-forward 推送 `main` 只用于取得明确授权后的合并。
- 当前仓库约定不要求 agent 修改 GitHub 分支保护设置。仓库管理员需在 GitHub 中人工确认上述保护已启用，并把实际状态作为交付风险记录。

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
