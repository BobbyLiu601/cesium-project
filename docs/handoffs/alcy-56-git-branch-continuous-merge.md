# ALCY-56 Git 分支持续合并 Handoff

## 目标

把旧的“task 分支交付前合并并立即删除”流程改成：

- 每条命令从一个 Issue 的持久分支创建一条 task 分支；
- task 分支提交后自动合并回持久分支，但暂时不删除；
- 下一条命令再从持久分支创建新的 task 分支；
- 用户明确回复“issue完成”后，统一删除该持久分支下的 task 分支，再把 Issue 置为已完成。

## 实现

- `post-commit` hook 通过 `scripts/run-post-commit.mjs` 调用 `scripts/finalize-task-branch.mjs --after-commit`。
- `pre-commit` 会先同步主检出中遗留的旧 task 分支，兜底平台跳过 hook 的代提交。
- finalize 默认只合并并保留 task 分支；只有显式传入 `--delete` 才尝试删除。
- 合并前若主检出停在旧 task 分支且工作树干净，会把主检出切回持久分支，供下一任务派生。
- `scripts/cleanup-task-branches.mjs` 在“issue完成”后按持久分支批量清理已合并的 task 分支。
- `pre-push` 继续拒绝推送未合并的 task 分支。
- ADR 0009 取代 ADR 0008 中“交付前立即删除”的部分。

## 使用流程

task 分支提交后不需要手工删除。需要立即验证时执行：

```bash
node scripts/finalize-task-branch.mjs --fallback <task-branch> --dry-run
node scripts/finalize-task-branch.mjs --fallback <task-branch>
```

用户回复“issue完成”后执行：

```bash
node scripts/cleanup-task-branches.mjs --base agent/<agent>/<issue-key> --dry-run --keep-current
node scripts/cleanup-task-branches.mjs --base agent/<agent>/<issue-key> --keep-current
```

“issue完成”评论本身也占用一条活动 task 分支。`--keep-current` 会保留该分支并删除其余已释放分支；
平台释放工作树后再运行一次不带 `--keep-current` 的命令即可清空。清理失败时保留 Issue 的评审状态并报告原因。

## 自动化边界

Multica 没有向仓库提供 turn 结束 hook。仓库能在 commit 后自动合并，但不能判断用户何时确认 Issue 已完成，
因此“issue完成”的清理和状态变更仍由接收该评论的 agent 执行。`post-commit` 对中间提交也会合并；task 分支
始终保留，最终结果以持久分支为准。

## 安全条件

- 冲突、持久分支工作树不干净或目标分支无法唯一确定时停止，不删除任何分支。
- 清理前必须验证每个 task 分支 tip 已包含在持久分支中。
- 清理只删除本地 ref，不删除远端分支，不改 `main`，不 force push。
- 删除输出包含 SHA 和 `git branch <name> <sha>` 恢复命令。
