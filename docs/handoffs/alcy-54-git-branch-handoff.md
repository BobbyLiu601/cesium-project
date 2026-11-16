# ALCY-54 Git 分支收敛 Handoff

## 目标

修复 `worktree` 模式下同一 Issue 出现多条长期分支的问题：保留一条持久任务分支，把平台因无法复用该分支而创建的 fallback 作为临时分支，交付前自动合并回持久分支并删除本地 ref。

## 已确认决策

- 同一 Issue 只有一条持久任务分支 `agent/<agent>/<issue-key>`；它是唯一交付对象，不再创建 `<type>/<issue-key>-<slug>` 交付别名。
- 平台 fallback 命名为 `agent/<agent>/<issue-key>-<task-id 后 12 位>`，允许存在，但必须包含创建时的持久分支提交。
- 合并方向固定为 fallback → 持久分支；优先 fast-forward，持久分支已前进时允许普通 merge commit。
- 只有持久分支包含 fallback tip、相关工作树干净且没有进行中的 Git 操作时，才删除本地 fallback ref；删除前记录 SHA。
- 不自动更新 `main`、不删除远端 fallback、不 force、不 rebase fallback、不 reset 持久分支。
- `local_directory` 任务分支从主检出 HEAD 派生；开始新任务前主检出必须干净且停在 `main`。

## 交付内容

- `docs/adr/0008-worktree-task-branch-lifecycle.md`：持久分支、临时 fallback、finalize 与守卫的决策记录。
- `docs/CODING_STANDARDS.md`：替换双分支/交付别名约定，补充 fallback 生命周期与主检出基线要求。
- `GLOSSARY.md`：补充 worktree、持久任务分支、临时 fallback、分支收敛术语。
- `scripts/finalize-task-branch.mjs`：幂等收敛命令，支持 `--fallback`、`--target`、`--dry-run`。
- `scripts/lib/task-branches.mjs`：fallback 识别、持久分支解析、祖先关系与 Git 调用共享逻辑。
- `scripts/check-git-branch.mjs`：`pre-push` 新增“拒绝推送未合并 fallback”。
- `scripts/__tests__/finalize-task-branch.test.mjs`、`scripts/__tests__/check-git-branch.test.mjs`：覆盖快进、merge commit、冲突、脏工作树、已合并、目标缺失/歧义、幂等和守卫行为。

## 执行步骤

1. 先 dry-run 确认 fallback、持久分支和 SHA：

   ```bash
   node scripts/finalize-task-branch.mjs --fallback <fallback> --dry-run
   ```

2. 目标分支无法唯一解析时显式传入：

   ```bash
   node scripts/finalize-task-branch.mjs --fallback <fallback> --target agent/<agent>/<issue-key>
   ```

3. 执行收敛；命令会合并 fallback 并在安全时删除本地 ref：

   ```bash
   node scripts/finalize-task-branch.mjs --fallback <fallback> --target agent/<agent>/<issue-key>
   ```

4. 验证持久分支包含 fallback 原 tip，且 fallback ref 已删除：

   ```bash
   git merge-base --is-ancestor <fallback-sha> <persistent-branch>
   git show-ref --verify --quiet refs/heads/<fallback> # 应返回非零
   ```

## 现有分支处置

- ALCY-51：持久分支 `agent/deepseek-pro/alcy-51` 原 tip `09c8563`；fallback `agent/deepseek-pro/alcy-51-d9d0e4c5d03c` tip `0d33d20`。执行 finalize 后持久分支快进到 `0d33d20`，主检出切回持久分支，fallback 本地 ref 删除。
- ALCY-52：持久分支 `agent/deepseek-pro/alcy-52` tip `f8c4df0` 已包含 fallback `agent/deepseek-flash/alcy-52-a67a5dd71989` 的 tip `ea67b0f`；执行 finalize 后只删除本地 fallback ref。

## 验收

- fallback 上的提交都能从持久任务分支到达；删除前 SHA 已记录。
- 未合并 fallback 的 `git push` 被 `pre-push` 拒绝，并提示先执行 finalize。
- 正常持久任务分支仍可提交和推送；`main` 保护规则不变。
- `pnpm test` 中 finalize 与 Git 守卫测试通过；交付前运行 `pnpm verify`。

## 残余风险

- Multica 可能在仓库 hook 运行前就创建 fallback 工作树和分支；仓库守卫只能阻止其被静默推送，不能阻止 ref 被平台创建。
- 删除正在被工作树使用、且与 Multica 归属记录相关的 fallback 可能影响后续续写。finalize 只在能安全切回持久分支时删除；否则保留并报告 `待删除`，由下一次安全执行继续。
- `local_directory` 当前没有固定 base ref 配置；主检出停在其他任务分支时，新任务仍可能继承未合并提交。本 Issue 先通过规范要求执行者停止并报告，长期需要平台提供固定基线能力。
- `agent/deepseek-flash/alcy-52` 与 `agent/deepseek-pro/alcy-52` 是同一 Issue 不同 agent 的持久分支候选；target 解析在多个候选无法唯一包含 fallback 时要求显式 `--target`。
