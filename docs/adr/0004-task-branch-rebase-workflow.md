# ADR 0004：任务分支采用 rebase 后 fast-forward 合入 main

- 状态：已接受
- 日期：2026-11-05

## 背景

项目需要在隔离的任务分支上完成改动，同时让 `main` 保持可追溯的线性历史。此前通过普通 merge commit 合入任务分支，会在 `main` 上保留额外的合并节点；团队希望任务完成后先 rebase 到最新 `main`，再合入。

## 决策

- 除只读调查外，每个 Issue 使用一个任务分支，分支名采用 `<type>/<issue-key>-<slug>`。
- 任务开始前确认工作区干净，从最新的 `origin/main` 创建分支；`main` 有未提交改动时停止并询问。
- 完成后在任务分支执行 `git rebase origin/main`，由执行任务的 agent 解决冲突，并在 rebase 后重新运行 `pnpm verify`。
- 验证通过后，将任务分支 fast-forward 合入本地 `main`，再推送 `main`；不产生 merge commit。
- 保留本地任务分支，不因合入完成而自动删除。
- 不使用强推绕过冲突，也不绕过 `main` 的远端保护规则。

## 备选方案

- 普通 merge commit：保留完整分支拓扑，但会在 `main` 上增加合并节点。
- 推送任务分支并通过 PR 的 Rebase and merge 合入：适合需要远端评审的团队流程，但当前约定允许验证通过后直接合入 `main`。

## 影响

- `main` 的历史保持线性，方便阅读和回溯。
- rebase 会改写任务分支的提交 ID；已共享的任务分支需要谨慎处理，不能强推 `main`。
- rebase 冲突由执行任务的 agent 处理，解决后必须重新验证，不能把未验证的变体合入 `main`。
- 本地任务分支会持续保留，便于追查，但需要定期人工清理。
