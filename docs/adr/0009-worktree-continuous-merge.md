# ADR 0009：worktree task 分支持续合并，Issue 完成时统一清理

- 状态：已接受
- 日期：2026-11-17
- 取代：ADR 0008 的“交付前合并并立即删除”流程
- 关联：ALCY-56

## 背景

ADR 0008 要求 task 分支在每次交付前合并回持久分支并立即删除。实际执行 ALCY-55 时，第二次任务使用了
`agent/deepseek-pro/alcy-55-6e4f1bdc5a0d`，提交停留在该 task 分支，持久分支
`agent/deepseek-pro/alcy-55` 仍停在旧 tip。下一次任务又继承了未合并的 task 分支，基线继续分叉。

仓库 hook 无法观察 Multica 的 turn 结束时刻，但 Git 可以在 commit 完成后执行 hook。新的流程把“合并”和
“删除”拆开：每次 commit 后持续把 task 分支合并到持久分支，但保留 task 分支；只有用户明确回复
“issue完成”后才统一删除。

## 决策

- 每个 Issue 有一条持久分支 `agent/<agent>/<issue-key>`。同一 Issue 的每条命令使用一条基于该持久分支的
  task 分支，名称为 `agent/<agent>/<issue-key>-<task-id 后 12 位>`。
- task 分支完成后不立即删除。`post-commit` hook 调用
  `node scripts/run-post-commit.mjs`，再由它执行
  `node scripts/finalize-task-branch.mjs --after-commit`，把当前 task 分支的 tip 合并进持久分支。
- `pre-commit` 会检查主检出是否仍停在旧 task 分支；若工作树干净，先把它合并回对应持久分支并切回持久分支。
  这同时兜底平台在 turn 末尾自动提交、从而没有运行 `post-commit` 的情况。
- 合并优先 fast-forward；持久分支已前进时允许普通 merge commit。发生冲突或持久分支工作树不干净时停止，
  保留 task 分支和全部提交，不自动解决冲突。
- 合并成功后保留 task 分支 ref。若主检出停在 task 分支且工作树干净，同步命令会把主检出切回持久分支，
  使下一次任务从持久分支的当前 tip 派生。
- 下一次命令仍创建新的 task 分支，不从旧 task 分支继续；旧 task 分支只作为本轮执行的审计记录。
- 用户明确回复“issue完成”后，先执行：

  ```bash
  node scripts/cleanup-task-branches.mjs --base agent/<agent>/<issue-key> --dry-run
  node scripts/cleanup-task-branches.mjs --base agent/<agent>/<issue-key>
  ```

  清理命令只删除已合并到持久分支、且不被工作树占用的本地 task 分支。全部检查通过后才删除；任一分支
  未合并或仍被占用时，整次清理失败且不删除任何 task 分支。

- 清理成功后，执行者才把 Issue 状态改为 `done`。清理失败时保留 Issue 的评审状态并报告失败原因。
- 不自动更新 `main`、不删除远端分支、不 force push、不 rebase task 分支、不 reset 持久分支。
- `pre-push` 继续拒绝推送尚未合并到持久分支的 task 分支，作为 hook 失败时的第二道保护。

## 自动化的边界

仓库 hook 在每次 commit 后运行，而不是在 Multica 真正结束 turn 时运行。对只有一次最终提交的任务，两者等价；
对多次中间提交的任务，持久分支会更早收到已提交内容，但 task 分支仍保留，最终清理仍由“issue完成”明确触发。
仓库无法替平台判断 Issue 是否完成，也不能替用户发送完成指令，因此不把 `post-commit` 描述成平台级 turn hook。
平台若在 turn 结束时代提交且按运行时约定跳过 Git hooks，本次不会触发自动合并；下一次手动 commit 的
`pre-commit` 会先恢复主检出中的旧 task 分支。交付 agent 仍必须在结束前手动提交，不能依赖这种事后恢复。

## 备选方案

- 继续在交付前手动执行 finalize 并立即删除：步骤更少，但已经证明会因漏执行而让持久分支长期落后。
- 只依赖 `pre-push`：当前任务不一定推送，不能覆盖本地交付路径。
- 删除 task 分支后再开始下一任务：减少 ref 数量，但平台归属记录和工作树可能仍引用旧 ref，且失去本轮审计记录。
- 由仓库直接修改 Multica daemon：超出本仓库边界，也会把平台行为耦合到项目脚本。

## 影响

- 正常执行期间每个 Issue 可以同时看到持久分支和一条或多条 task 分支；评审应查看持久分支。
- task 分支会暂时保留到用户确认 Issue 完成，分支数量增加是预期行为。
- 主检出若停在旧 task 分支，同步命令会尝试安全切回持久分支；主检出不干净时只完成合并并提示，不会丢弃改动。
- 清理命令是删除操作，必须先 dry-run；输出记录每个 task 分支删除前的 SHA，可用
  `git branch <name> <sha>` 恢复。
