# ADR 0010：Issue 完成必须验证 Pages 实际发布

- 状态：已接受
- 日期：2026-11-19
- 修订：ADR 0009 中“push 成功并触发 workflow 后即可标为 done”的边界

## 背景

用户在 ALCY-59 中回复“issue完成”后，Issue 被标为 `done`，但执行过程只改变了 Issue 状态，
没有把完成分支合入 `main`。Pages workflow 只监听 `main` push，因此线上站点仍是旧版本。现有
`complete-issue` 也只负责清理与 push，无法区分“workflow 已触发”和“Pages 已实际发布本次提交”。

对用户而言，“issue完成”表示产品验收已经完成，并同时授权发布；它不表示部署已经成功。平台或仓库
hook 也无法自行观察用户评论并启动发布，因此执行 agent 必须在收到该独立评论后运行完整完成流程。

## 决策

- 独立回复“issue完成”是明确的发布授权，不再要求二次确认；每次触发都必须执行完整完成流程，不能
  只修改 Issue 状态。
- `complete-issue` 默认从当前持久分支或当前 task 分支自动解析完成分支。无法唯一解析时必须在修改
  ref 前失败；显式 `--base` / `--merge` 仅作为历史清理或覆盖入口。
- 完成流程先收敛 task 分支，再清理已合并且已释放的 task 分支。`main` 仍只允许 fast-forward，
  本地主检出和相关持久分支必须干净。
- Pages 专用构建在产物根目录写入 `version.json`，至少包含 `GITHUB_SHA`（本地构建回退到 Git
  `HEAD`）和构建时间。Pages workflow 必须显式把 `github.sha` 传给构建。
- 推送后按目标 SHA 查询精确的 GitHub Actions workflow run，并等待其完成。运行失败、未出现或
  API 不可用时命令失败；不得把“已触发”推断为成功。
- workflow 成功后，命令继续读取带缓存穿透参数的线上 `version.json`。只有其中的 `commit` 与目标
  SHA 完全一致，才认定发布完成；CDN 延迟在明确超时内重试。
- 重复执行“issue完成”是安全且幂等的：远端 `main` 已指向目标提交时不重复 push，但仍重新执行
  workflow 与线上版本校验。
- 命令成功后才把 Issue 标为 `done`；任何发布或验证失败都保持 `blocked` 并附可操作信息，包括
  Actions 链接或线上版本不一致原因。
- 项目描述必须携带上述完成规则，使后续任务即使更换 agent 或丢失会话也不会遗漏。README、
  `docs/CODING_STANDARDS.md` 与本 ADR 记录完整细节。

## 备选方案

- 只修改项目描述或 README：成本低，但无法阻止 agent 再次把“已触发”当作“已部署”。
- 在 Multica 中增加独立部署状态和部署 agent：约束更强，但会增加一次运行和新的状态机；本轮先用
  单一命令闭合发布责任。
- 继续只用 HTTP 200 判断 Pages 可用：无法识别 CDN 仍返回旧产物，因此不采用。
- 使用 `gh` CLI：当前环境不一定安装，且仍需额外鉴权；改用 Node 原生网络能力和 GitHub REST API。

## 影响

- 完成命令运行时间会覆盖 workflow 构建和部署，通常明显长于一次 Git push；执行 turn 必须在前台
  等待结果，不能提前结束。
- Pages 每次发布都会暴露一个公开版本清单。它只包含非敏感提交元数据。
- GitHub API 鉴权可通过 `GITHUB_TOKEN` / `GH_TOKEN` 或本机 Git 凭据管理器获得；没有可用凭据时
  公开 API 可能限流，此时完成命令应失败并提示配置方式。
- 现有 Pages workflow 的手动重跑仍可用于维护，但不能替代 Issue 完成命令中的提交级校验。
