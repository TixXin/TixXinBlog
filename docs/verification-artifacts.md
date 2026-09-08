# 验收产物管理

Git 保存可维护的源码和文字结论。批量截图、录屏、trace、性能采样、原始测试报告及运行日志仅保留本地，避免每次验收持续增大仓库。

## 存放约定

| 内容 | 位置 | 是否提交 |
| --- | --- | --- |
| 网站实际使用的图片、字体等素材 | `src/frontend/web-blog/public/` 等正式资源目录 | 是 |
| README 预览图、经过选择的文档插图 | `docs/img/` | 是 |
| 正式回归脚本、验收结论、覆盖范围、已知限制 | `tests/`、`docs/` 中对应模块 | 是 |
| 新的截图、录屏、trace、日志、机器报告 | `.playwright-mcp/` 或 `.artifacts/<任务>/` | 否 |
| 既有本地验收档案 | `docs/**/evidence/`、`docs/git-validation/` | 否 |
| Playwright 默认报告与结果 | `test-results/`、`playwright-report/`、`blob-report/` | 否 |

不要全局忽略 `*.png`、`*.webp` 或 `*.json`，以免漏掉产品素材及配置。不要通过 `git add -f` 提交已忽略的验收产物。确实需要纳入正式文档的图片，应选择少量代表图并放入 `docs/img/`，不能整批复制测试输出。

报告里的本地产物使用代码路径标注，以仓库根目录为起点；远程页面和新检出不会拥有这些文件，因此不使用图片嵌入或普通超链接假装它们已随仓库发布。报告必须用文字独立说明结果、覆盖范围及限制。

## 复验和分享

持续维护的前端回归位于 [tests/e2e](../src/frontend/web-blog/tests/e2e/)，配置见 [playwright.config.ts](../src/frontend/web-blog/playwright.config.ts) 与 [playwright.motion.config.ts](../src/frontend/web-blog/playwright.motion.config.ts)。历史 `evidence/reproduce/` 是依赖当时本机路径及已关闭隔离实例的实验快照，保留本地，不作为可持续运行的测试入口。

复验使用独立构建目录及项目隔离测试流程，新的运行结果写入忽略目录。已有 [CI](../.github/workflows/ci.yml) 在失败时通过 Actions artifact 上传 `.playwright-mcp/e2e-results`，保留 5 天；需要分享其他验收结果时使用任务附件或明确配置的 CI artifact。上传前检查截图、日志和 trace 是否含账号、凭据或私有内容。

## 2026-09-08 清理记录

本次停止跟踪 813 个本地验收文件，工作区文件合计约 221 MiB，包括 650 张截图和 9 段录屏，其余为日志、采样、机器报告及一次性实验脚本。文件仍在原本机路径，文字报告、两份 findings 清单、正式回归源码、README 的 5 张预览图及网站头像均保留。

| 原目录 | 文件数 |
| --- | ---: |
| `docs/motion-audit/evidence/` | 402 |
| `docs/motion-remediation/evidence/` | 324 |
| `docs/content-navigation-fix/evidence/` | 42 |
| `docs/page-regions/evidence/` | 40 |
| `docs/git-validation/` | 5 |

核查时远程 `main` 位于 `d37aed1`，其中已有 773 个产物。它们通过新的清理提交从当前版本移除；已发布历史保持不变，因此本次不会缩小既有 Git 历史，也不等于从远程彻底删除旧文件。

尚未发布的验收提交 `a27c4f6` 新增了另外 40 个产物；先建立并验证本地 bundle 备份，再将该提交修订为 `07fb7a2`，只移除产物，保留代码、测试、文字和此前模块提交。备份位于被忽略的 `.codex/git-artifact-cleanup/unpublished-before.bundle`，依赖已发布基点 `d37aed1`。清理后的待推送历史不会引入这 40 个产物。本次没有推送或强制推送。

清理核验：813 个本地文件的 SHA-256 与清理前一致；索引和待推送的新对象均无上述产物；828 个忽略与素材保留检查、438 个仓库内文档链接检查通过。产品及正式测试源码与清理前一致，两份问题清单的结论保留，`git diff --check` 和项目凭据扫描通过。此次仅调整版本控制与文档，没有重跑产品 Lint、构建或浏览器测试；此前产品验收结果仍见各模块原报告。
