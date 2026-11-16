# ADR 0008：worktree 任务分支采用“持久分支 + 临时 fallback”

- 状态：已接受
- 日期：2026-11-16
- 修订：ADR 0005 的任务分支交付边界
- 关系：ALCY-50 尚未合入的 ADR 0007 提出“平台任务分支 + 交付分支”两个名字；本 ADR 与其冲突时以本 ADR 为准

## 背景

项目使用 `worktree` 执行模式后，不同 Issue 可以并发执行，Multica 为每个任务创建独立工作树，并沿用平台任务分支作为同一 Issue 后续轮次的续写依据。这个模型解决了并发覆盖和目录互斥，但没有定义平台无法复用持久分支时应该怎么办。

实际记录暴露了两个问题：

- ALCY-51 的 fallback 分支 `agent/deepseek-pro/alcy-51-d9d0e4c5d03c` 基于持久分支 `agent/deepseek-pro/alcy-51` 的 tip 创建，但提交停留在 fallback 上；主检出还停在 fallback 分支，导致后续任务分支继续继承未合并的任务 tip。
- ALCY-52 的 fallback 已被 `agent/deepseek-pro/alcy-52` 的合并提交包含，但 fallback ref 仍然存在。两个 agent 前缀不同的持久分支说明：不能简单地把 fallback 名称去掉 task id 后缀来推断目标。

同时，仓库原有约定要求另建 `<type>/<issue-key>-<slug>` 交付分支，这与“一个 Issue 一条持久分支”冲突；ALCY-50 提议的双分支命名同样会分散交付结果。仓库需要一条可执行、可验证的收敛规则，而不是继续依赖人工记忆。

## 决策

- 同一 Issue 只有一条持久任务分支，即 Multica 分配并跨轮次复用的 `agent/<agent>/<issue-key>`。持久分支是唯一交付对象，不再在 `worktree` 模式创建交付别名。
- 平台无法复用持久分支时创建的 `agent/<agent>/<issue-key>-<task-id 后 12 位>` 是临时 fallback。fallback 必须包含创建时持久分支的提交；有效工作可以暂时提交在 fallback 上，但交付前必须合并回持久分支。
- 收敛方向固定为 fallback → 持久分支。持久分支是 fallback 的祖先时优先 fast-forward；持久分支已经前进时允许普通 merge commit。禁止 rebase fallback、禁止 force、禁止把持久分支 reset 到 fallback、禁止自动更新 `main`。
- 新增幂等命令 `node scripts/finalize-task-branch.mjs`（也提供 `pnpm finalize:branch`）。它默认以当前分支为 fallback，支持 `--fallback`、`--target` 和 `--dry-run`：
  - 目标分支优先使用 `--target`；否则在 `agent/*/<issue-key>` 中解析。存在多个候选时，只有唯一一个已包含 fallback tip 的候选才能自动采用，否则停止并要求显式指定。
  - 合并前检查持久分支和 fallback 的工作树：有未提交改动或正在 merge/rebase/cherry-pick 时停止。
  - 只有 `git merge-base --is-ancestor <fallback-tip> <persistent-tip>` 成功、相关工作树干净且没有进行中的 Git 操作时，才删除本地 fallback ref。
  - 删除前输出 fallback SHA，并给出 `git branch <fallback> <sha>` 恢复命令。只删除本地 ref，不删除远端 fallback。
  - fallback 正被干净工作树占用时，先把该工作树切回持久分支再删除；无法安全切换时只完成合并并报告“待删除”，由下一次安全的 finalize 继续。
- `pre-push` 守卫拒绝推送尚未合并到持久分支的 fallback，并提示先执行 finalize；`pre-commit` 仍允许在 fallback 上提交。
- `local_directory` 的任务分支从主检出的当前 HEAD 派生，而不是从固定 `origin/main`。因此开始新任务前，主检出必须干净且停在 `main`；如果继承到其他任务分支，停止并报告，不能把未合并任务当作新任务基线。
- ADR 0005 的 `main` 合并授权规则保持不变：任务完成、测试通过或进入评审都不构成合并授权。

## 备选方案

- 保留“持久分支 + 交付分支”两个名字：审查命名更熟悉，但同一 Issue 仍会出现两条长期 ref，无法解决本次问题。
- 由 finalize 自动删除远端 fallback 或强推持久分支：清理更彻底，但会重写已共享历史，并可能破坏 Multica 的归属记录，因此不采用。
- 只等待 Multica 平台修复、不在仓库侧兜底：能解决根因，但当前无法阻止未合并 fallback 被静默推送。仓库侧守卫先提供可见的失败闭环，平台依赖作为残余风险记录。

## 影响

- 评审者只需要检查一条持久分支；fallback 上的提交必须能从持久分支到达，删除 fallback 前会留下 SHA。
- 任务交付多了一个 finalize 步骤；未合并的 fallback 推送会在本地 pre-push 失败。该守卫无法阻止平台在 hook 运行前创建 fallback ref，只能阻止它被静默交付。
- 删除当前工作树正在使用的 fallback 存在平台归属记录风险。实现按“先合并、可安全切换才删除”处理；无法确认时保留下一次处理，不强行 detach。
- 主检出停在非 `main` 分支时，新任务可能继承未合并提交。该问题需要主检出维护纪律或平台提供固定 base ref 能力；本 ADR 先要求执行者发现后停止并报告。
