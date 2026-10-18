# Lighthouse 性能预算

在 GitHub Actions 中选择 **Lighthouse CI → Run workflow** 手动运行；工作流需先合入默认分支才会显示手动入口。配置位于 [`.lighthouserc.cjs`](../.lighthouserc.cjs)，流程位于 [`lighthouse.yml`](../.github/workflows/lighthouse.yml)。它不自动随 push 或 PR 执行，也不部署产物。

CI 使用 Node 25、pnpm 9.15.0 和项目 `corepack pnpm build` 生成生产产物，直接运行 `.output/server/index.mjs`。前端与只读夹具仅监听 runner 的 `127.0.0.1:4173/4174`，不需要后端、数据库或 secrets。Lighthouse 通过 `npx --yes --package=@lhci/cli@0.15.1` 调用，不修改项目依赖或锁文件；浏览器复用现有 Playwright 锁定的 Chromium。

采集默认 Nexus 主题的首页 `/`、文章详情 `/articles/1`、闪念列表 `/flash`。文章与闪念显式开启现有演示仓储；[CI 辅助脚本](../scripts/lighthouse/ci.mjs)仅提供站点资料和匿名会话两个只读接口，未知接口与写入请求返回错误。采集前用独立浏览器上下文检查 HTTP 200、站点资料、客户端就绪和实际内容，避免把错误页、空白页或资料降级页当成性能样本。此检查不更改 Lighthouse 的存储状态、动画或资源加载。

| 预算项             | 每个 URL 的门槛           | 初始取值依据                                                                                         |
| ------------------ | ------------------------- | ---------------------------------------------------------------------------------------------------- |
| Performance        | 三次移动端结果中位数 ≥ 70 | 当前页面包含主题壳层、水合、Markdown、图片与首访动效，先设定回归底线；70 仍属有待改善，长期目标为 90 |
| Accessibility      | 三次结果中位数 ≥ 90       | 已有语义控件、可访问名称与键盘支持，应维持较高自动审计得分；不代替读屏和键盘人工验收                 |
| SEO                | 三次结果中位数 ≥ 90       | 已有 canonical、描述、robots 等基础契约，避免常规索引能力退化                                        |
| 页面状态与可索引性 | 每次均通过                | 错误响应或 noindex 不能靠其他审计得分抵消                                                            |

这些数值是**尚待首次 CI 采样核对的初始门槛，不是已测得的当前分数**。性能分档参考 [Lighthouse 评分说明](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)，中位数聚合使用 [LHCI 官方配置](https://googlechrome.github.io/lighthouse-ci/docs/configuration.html)的 `aggregationMethod: median`。保留 Lighthouse 默认移动设备、模拟网络和 CPU 节流，每页执行三次，任何预算不达标均令工作流失败。不要通过关闭断言、屏蔽图片、关闭动画或放宽超时使其通过；先检查原始报告定位原因，预算调整需要记录实测依据。

报告和服务日志保存为 `lighthouse-<run_id>-<run_attempt>` Actions artifact，保留 14 天；断言失败仍会导出 HTML/JSON，采集失败时保留已有原始报告及日志。不使用临时公开报告托管。工作区产物位于 `.lighthouseci/` 与 `.artifacts/lighthouse/`，均不入库。

本预算只衡量受控演示内容的前端：闪念演示数据在客户端初始化，不代表真实 API 的 SSR、NestJS/PostgreSQL、正式数据量或 Dock/Aurora 主题表现。现有演示图片保留 Unsplash 外链，字体构建也依赖外部资源；第三方网络与 runner 负载可能影响结果。维护者应先手动运行、审阅三页报告并建立基线，再决定是否增加三主题矩阵或 PR 门禁。
